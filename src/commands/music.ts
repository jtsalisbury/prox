import { sendMessage } from '../services/message';
import GuildManager from '../models/GuildManager';
import VoiceManager from '../models/VoiceManager';

import glob from 'glob';
import path from 'path';

import utils from 'util';
import * as _utils from '../services/utils'; // i chose a great name didn't i

import ytsearch from 'youtube-search';

import { Message, TextChannel } from 'discord.js';
import { IBaseCommand, ISongData, ISongQueue } from '../models/IBase';


let ytsearchProm = utils.promisify(ytsearch);

let MusicHandlers = [];

const MUSIC_CTX_ID = "MUSIC_QUEUE";

let verifyChannelPerms = function(message: Message): boolean {
    if (!message.member) {
        return false;
    }

    // Verify that the user is in a voice channel
    let voiceCh = message.member.voice.channel;
    if (!voiceCh) {
        sendMessage('You need to be in a voice channel to play music', message.channel);
        return false;
    }

    return true;
}

let getVoiceManager = function(guildId: string): VoiceManager {
    return GuildManager.getVoiceManager(guildId);
}

let getServerQueue = function(guildId: string): ISongQueue {
    return getVoiceManager(guildId).get(MUSIC_CTX_ID);
}

let getStream = async function(curSong: ISongData): Promise<object> {
    let handler = MusicHandlers[curSong.type];
    if (!handler) {
        console.error('No handler available to play ' + curSong.url);
        return;
    }

    return await handler.getStream(curSong.url);
}

let getRelatedVideo = async function(curSong: ISongData): Promise<ISongData> {
    let handler = MusicHandlers[curSong.type];
    if (!handler) {
        console.error('No handler available to play ' + curSong.url);
        return;
    }

    return await handler.getNext(curSong.url);
}

let playNextSong = async function(guildId: string, channel: TextChannel) {
    let voiceMgr = getVoiceManager(guildId);
    let queue = getServerQueue(guildId);

    if (!queue || !voiceMgr.getConnection()) {
        return;
    }

    // If there's no more songs go ahead and leave
    if (queue.songs.length === 0) {
        voiceMgr.delete(MUSIC_CTX_ID);

        sendMessage('No songs left in the queue', channel);
        return;
    }

    let curSong = <ISongData>queue.songs[0];
    let curSongArtists = Object.keys(curSong.artists);

    // Create a new dispatcher to play our stream
    let streamData = <any>await getStream(curSong);

    // Update the current music stats
    if (curSongArtists.length > 0) {
        updateMusicStats(curSong.artists, {[curSong.title]: 1}, guildId);
    }

    let dispatcher = voiceMgr.getConnection().play(streamData.stream, { 
        type: streamData.type,
        volume: queue.volume / 100
    });
    dispatcher.on('finish', (reason) => {
        queue.songs.shift();

        playNextSong(guildId, channel);
    });
    dispatcher.on('error', err => {
        sendMessage('Dispatcher error: ' + err, channel);
    });
    dispatcher.on('debug', debugInfo => {
        console.log(debugInfo);
    });
    queue.dispatcher = dispatcher;

    // Print the next song
    let nextSong = '';
    if (queue.songs.length > 1) {
        let next = <ISongData>queue.songs[1];

        let artistStr = "";
        let nextSongArtists = Object.keys(next.artists);
        if (nextSongArtists.length > 0) {
            artistStr = `by **${nextSongArtists[0]}**`;
        }

        nextSong = `The next song is **${next.title}** ${artistStr}`;
    } else {
        if (queue.autoplay) {
            let related = await getRelatedVideo(curSong);

            if (typeof(related) == 'string') {
                nextSong = related
            } else {

                queue.songs.push(related); // title, url, autoplay, author

                nextSong = `Autoplay is enabled. The next song will be **${related.title} by ${related.author}** if no songs are added.`;
            }
        } else {
            nextSong = 'There is no song up next';
        }
    }

    // Set the volume logarithmically
    dispatcher.setVolumeLogarithmic(queue.volume / 100);

    let artistStr = "";
    if (curSongArtists.length > 0) {
        artistStr = `by **${curSongArtists[0]}** `;
    }

    sendMessage(`Now playing **${curSong.title}** ${artistStr}at **${queue.volume}%**\n${nextSong}`, channel);
}

// Note: artists, songs can only be tracked if the info is on youtube
function updateMusicStats(newArtistData: object, newSongData: object, guildId: string) {
    //let currentTitles =
    let guild = GuildManager.getGuild(guildId);
    if (guild) {

        // Get the current artist data
        let curArtistData = _utils.resolve(guild, 'statistics.music.artists');
        Object.keys(newArtistData).forEach(artist => {
            if (!artist) {
                return;
            }
            
            // Combine the current artist data
            if (curArtistData[artist]) {
                curArtistData[artist] = curArtistData[artist] + newArtistData[artist]
            } else {
                curArtistData[artist] = newArtistData[artist];
            }
        });

        // Get the current song data
        let curSongData = _utils.resolve(guild, 'statistics.music.songs');
        Object.keys(newSongData).forEach(song => {
            if (!song) {
                return;
            }

            // Combine the current song data
            if (curArtistData[song]) {
                curSongData[song] = curSongData[song] + newSongData[song]
            } else {
                curSongData[song] = newSongData[song];
            }
        });

        guild.markModified('statistics.music');
    }
}

let createNewQueue = async function(message: Message, songs: ISongData[]): Promise<ISongQueue> {
    let voiceMgr = getVoiceManager(message.guild.id);

    // Create a new queue object and add the song
    let queue = <ISongQueue>{
        textChannel: message.channel,
        voiceChannel: message.member.voice.channel,
        dispatcher: null,
        songs: songs,
        volume: 15,
        playing: true,
        autoplay: GuildManager.getGuild(message.guild.id).autoplayEnabled
    };

    if (!voiceMgr.getConnection()) {
        await voiceMgr.joinChannel(message.member.voice.channel);
    }

    voiceMgr.set(MUSIC_CTX_ID, queue);

    return queue;
}

async function getSongs(descriptor: string, type: string) {
    let link = descriptor;
    // todo: cleanup for no matches
    if (descriptor.indexOf('youtube.com') === -1 && descriptor.indexOf('soundcloud.com') === -1 && descriptor.indexOf('spotify.com') === -1) {
        let opts = {
            maxResults: 1,
            key: process.env.YOUTUBE_API
        }
        
        let result = <any>await ytsearchProm(descriptor, opts).catch(err => {
            console.log(err);
        });

        if (result.length === 1) {
            link = result[0].link;
        }
    }

    for (const handlerName in MusicHandlers) {
        let handler = MusicHandlers[handlerName];

        if (handler.isMatch(link)) {
            return await handler.getSongs(link);
        }
    }

    return [];
}


let volume = <IBaseCommand>{};
volume.aliases = ['volume'];
volume.prettyName = 'Set Volume';
volume.help = 'Sets the music volume to a number between 0 and 100';
volume.params = [
    {
        name: 'volume',
        type: 'number'
    }
];
volume.executeViaIntegration = true;
volume.callback = async function(message: Message, volume: number) {
    if (volume < 0 || volume > 100) {
        return 'Invalid number. Volume should be between 0 and 100';
    }

    volume = Math.floor(volume);

    let guildId = message.guild.id;
    let queue = getServerQueue(guildId);
    if (!queue) {
        return 'No active queue';
    }

    queue.volume = volume;
    queue.dispatcher.setVolumeLogarithmic(volume / 100);

    return `The volume has been set to **${volume}%**`
}

let autoplay = <IBaseCommand>{}
autoplay.aliases = ['autoplay'];
autoplay.prettyName = 'Autoplay';
autoplay.help = 'Enable or disable autoplaying of related videos from YouTube';
autoplay.params = [
    {
        name: 'state (enable, disable)',
        type: 'string'
    }
]
autoplay.executeViaIntegration = true;
autoplay.callback = async function(message: Message, state: string) {
    let guild = GuildManager.getGuild(message.guild.id);
    
    // TODO: the following code structure doesn't quite  make sense

    let nextSong: string;
    if (guild.autoplayEnabled) {
        if (state == 'enable') {
            return 'Autoplay is already enabled';
        }

        guild.autoplayEnabled = false;

        let queue = getServerQueue(message.guild.id);
        if (queue) {
            queue.autoplay = false;
        }

        return 'Autoplay is now disabled';
    } else {
        if (state == 'disable') {
            return 'Autoplay is already disabled';
        }

        guild.autoplayEnabled = true;

        let queue = getServerQueue(message.guild.id);

        if (queue) {
            queue.autoplay = true;
        }

        if (queue && queue.songs.length == 1) {  
            let curSong = <ISongData>queue.songs[0];
            let related = await getRelatedVideo(curSong);

            if (typeof(related) == 'string') {
                nextSong = related
            } else {

                queue.songs.push(related); //title, url, autoplay, author

                nextSong = `Autoplay is now enabled. The next song will be **${related.title} by ${related.author}** if no songs are added.`;
            }
        }

        return nextSong;
    }
}

let shuffle = function(songs: ISongData[]) {
    for (let i = songs.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        let temp = songs[i];

        songs[i] = songs[j];
        songs[j] = temp;
    }

    return songs;
}

let play = <IBaseCommand>{};
play.aliases = ['play'];
play.prettyName = 'Play Song';
play.help = 'Stops the current song and plays a new one; maintains active queue. Can provide: Youtube (playlist, video, live stream, search words), SoundCloud (track), Spotify (album, playlist).';
play.params = [
    {
        name: 'link/search criteria',
        type: 'string'
    }
];
play.executeViaIntegration = true;
play.executePermissions = ['SPEAK', 'CONNECT'];
play.callback = async function(message: Message, descriptor: string) {
    // If there's a server queue add the song
    let queue = getServerQueue(message.guild.id);
    if (queue) {
        let songs = await getSongs(descriptor, message.guild.id);

        if (queue.songs.length > 1 && queue.songs[1].autoplay) {
            queue.songs.splice(1, 1);
        }

        // Update the queue to have the playing song at the beginning, the playlist of new songs, followed by the old queue
        queue.songs = [queue.songs[0]].concat(songs, queue.songs.slice(1));

        if (queue && queue.dispatcher) {
            queue.dispatcher.end();
        }

        return `Added ${songs.length} songs to the queue`;
    }

    if (!verifyChannelPerms(message)) {
        return;
    }

    let songs = shuffle(await getSongs(descriptor, message.guild.id));

    // We need to create a new one!
    await createNewQueue(message, songs);

    // Play next song will ping messages for the bot
    playNextSong(message.guild.id, <TextChannel>message.channel);

    return `Added ${songs.length} songs to the queue`;
}

let enqueue = <IBaseCommand>{};
enqueue.aliases = ['add', 'a'];
enqueue.prettyName = 'Queue a Song';
enqueue.help = 'Can provide: Youtube (playlist, video, live stream, search words), SoundCloud (track), Spotify (album, playlist).';
enqueue.params = [
    {
        name: 'link/search criteria',
        type: 'string'
    }
];
enqueue.executeViaIntegration = true;
enqueue.executePermissions = ['SPEAK', 'CONNECT'];
enqueue.callback = async function(message: Message, descriptor: string) {
    // If there's a server queue add the song
    let queue = getServerQueue(message.guild.id);
    if (queue) {
        let songs = await getSongs(descriptor, message.guild.id);    

        if (queue.songs.length > 1 && queue.songs[1].autoplay) {
            queue.songs.splice(1, 1);
        }

        queue.songs = queue.songs.concat(songs);

        if (songs.length === 1) {
            return `**${songs[0].title}** has been added to the queue`;
        }

        return `**${songs.length}** songs have been added to the queue`;
    }

    if (!verifyChannelPerms(message)) {
        return;
    }

    let songs = shuffle(await getSongs(descriptor, message.guild.id));
    
    // We need to create a new one!
    await createNewQueue(message, songs);

    // Play next song will ping messages for the bot
    playNextSong(message.guild.id, <TextChannel>message.channel);
}

let dequeue = <IBaseCommand>{};
dequeue.aliases = ['remove', 'r'];
dequeue.prettyName = 'Dequeue Song';
dequeue.help = 'Removes the next song from the queue';
dequeue.executeViaIntegration = true;
dequeue.callback = async function(message: Message) {
    let guildId = message.guild.id;

    let queue = getServerQueue(guildId);
    if (!queue) {
        return 'No active queue';
    }

    if (queue.songs.length === 1) {
        return 'There are no songs in the queue';
    }

    // Current song is still at index 0, so remove index 1
    queue.songs.splice(1, 1);

    // Info for the user
    let nextSong = 'Removed the next song in the queue\n';
    if (queue.songs.length > 1) {
        nextSong += `The next song is now **${queue.songs[1].title}**`;
    } else {
        nextSong += 'There is no song up next';
    }
    
    return nextSong
}

let skip = <IBaseCommand>{};
skip.aliases = ['skip'];
skip.prettyName = 'Skip Song';
skip.help = 'Skips the currently playing song';
skip.executeViaIntegration = true;
skip.callback = async function(message: Message) {
    let guildId = message.guild.id;

    // Go ahead and end the current stream. This will trigger moving to the next song in the queue.
    let queue = getServerQueue(guildId);
    if (!queue) {
        return 'No active queue';
    }

    queue.dispatcher.end();
}

let stop = <IBaseCommand>{};
stop.aliases = ['stop'];
stop.prettyName = 'Stop Song';
stop.help = 'Clears the queue and stops the currently playing song';
stop.executeViaIntegration = true;
stop.callback = async function(message: Message) {
    let guildId = message.guild.id;

    // Empty the queue and end the stream, this will delete the queue
    let queue = getServerQueue(guildId);
    if (!queue) {
        return 'No active queue';
    }

    queue.songs = [];
    queue.dispatcher.end();

    return 'Cleared the active queue and stopped playing all songs';
}

let clear = <IBaseCommand>{};
clear.aliases = ['clear', 'empty'];
clear.prettyName = 'Clear Queue';
clear.help = 'Clears the queue but keeps playing the current song';
clear.executeViaIntegration = true;
clear.callback = async function(message: Message) {
    let guildId = message.guild.id;

    // Empty the queue
    let queue = getServerQueue(guildId);
    if (!queue) {
        return 'No active queue';
    }

    queue.songs = [];

    return 'Cleared the queue';
}

let pause = <IBaseCommand>{};
pause.aliases = ['pause'];
pause.prettyName = 'Pause Stream';
pause.help = 'Pauses the stream';
pause.executeViaIntegration = true;
pause.callback = async function(message: Message) {
    let guildId = message.guild.id;

    // Pause the stream
    let queue = getServerQueue(guildId);
    if (!queue) {
        return 'No active queue';
    }

    queue.dispatcher.pause();

    return 'The stream has been paused';
}

let resume = <IBaseCommand>{};
resume.aliases = ['resume'];
resume.prettyName = 'Resume Stream';
resume.help = 'Resumes the stream';
resume.executeViaIntegration = true;
resume.callback = async function(message: Message) {
    let guildId = message.guild.id;

    // Resume the stream if it's paused
    let queue = getServerQueue(guildId);
    if (!queue) {
        return 'No active queue';
    }

    if (queue.dispatcher.paused) {
        queue.dispatcher.resume();
    } else {
        return 'The stream isn\'t paused';
    }

    return 'The stream has been resumed';
}

let getQueue = <IBaseCommand>{};
getQueue.aliases = ['queue', 'list'];
getQueue.prettyName = 'Queue';
getQueue.help = 'Prints the first five songs of the queue';
getQueue.executeViaIntegration = true;
getQueue.callback = async function(message: Message) {
    let guildId = message.guild.id;
    
    // Grab the queue
    let queue = getServerQueue(guildId);
    if (!queue) {
        return 'No active queue';
    }

    let queueStr = '';
    if (queue.songs.length > 1) {
        // Loop through the queue so long as we are below five and we have a song
        let i = 1;
        while (i < 5 && queue.songs[i]) {
            queueStr += `**${queue.songs[i].title}**, `

            i += 1;
        }

        // Construct the string
        queueStr = `There are ${queue.songs.length-1} songs in the queue. The first ${i-1} are ` + queueStr.substr(0, queueStr.length - 2); 
    } else {
        queueStr = 'There are no songs in the queue';
    }

    // return string without last comma and space
    return queueStr
}

export let initialize = function(client) {
    glob.sync(__dirname + '/../music_handlers/*.js').forEach(async file => {
        let required = await import(path.resolve(file));
        let handler = required.default;

        MusicHandlers[handler.getName()] = handler;

        console.log(`Music handler loaded: ${handler.getName()}`)
    });
}

export let commands = [enqueue, dequeue, getQueue, clear, play, stop, pause, resume, skip, volume, autoplay];
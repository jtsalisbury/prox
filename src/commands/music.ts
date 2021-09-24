import { sendMessage } from '../services/message';
import GuildManager from '../models/GuildManager';
import VoiceManager from '../models/VoiceManager';

import glob from 'glob';
import path from 'path';

import utils from 'util';
import * as _utils from '../services/utils'; // i chose a great name didn't i
import logger from '../services/logger';

import fetch, { Headers } from 'node-fetch';
import xmlParse from 'fast-xml-parser';
import {decode as htmlDecode} from 'html-entities'

import ytsearch from 'youtube-search';

import { Message, TextChannel, MessageEmbed } from 'discord.js';
import { IBaseCommand, ISongData, ISongQueue } from '../models/IBase';
import { Transform, TransformCallback, TransformOptions } from 'stream'

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
        logger.error('No handler available to play ' + curSong.url);
        return;
    }

    return await handler.getStream(curSong.url);
}

let getRelatedVideo = async function(curSong: ISongData, guildId: string): Promise<ISongData> {
    let handler = MusicHandlers[curSong.type];
    if (!handler) {
        logger.error('No handler available to play ' + curSong.url);
        return;
    }

    let queue = getServerQueue(guildId);

    return await handler.getNext(curSong.url, queue.recent);
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
        logger.info(debugInfo);
    });
    queue.dispatcher = dispatcher;

    // Print the next song
    let nextSong = '';
    if (queue.songs.length > 1) {
        let next = <ISongData>queue.songs[1];

        let artistStr = "";
        let nextSongArtists = Object.keys(next.artists);
        if (nextSongArtists.length > 0) {
            artistStr = `${nextSongArtists[0]}`;
        }

        nextSong = `${next.title} by ${artistStr}`;
    } else {
        if (queue.autoplay) {
            let related = await getRelatedVideo(curSong, guildId);

            if (typeof(related) == 'string') {
                nextSong = related
            } else {

                queue.songs.push(related); // title, url, autoplay, author

                nextSong = `${related.title} by ${related.author}`;
            }
        } else {
            nextSong = 'Nothing';
        }
    }

    // Set the volume logarithmically
    dispatcher.setVolumeLogarithmic(queue.volume / 100);

    let artistStr = "";
    if (curSongArtists.length > 0) {
        artistStr = `${curSongArtists[0]}`;
    }
    
    // Only keep 5 songs in the most recent played
    if (queue.recent.length > 5) {
        queue.recent.splice(0, 1)
    }
    queue.recent.push(curSong.title)

    let response = new MessageEmbed().setAuthor('Prox Music Player')
                      .setTitle(`Now playing`)
                      .setDescription(`${curSong.title} by ${artistStr}`)
                      .addFields({name: 'Next up', value: nextSong, inline: true})
                      .addFields({name: 'Volume', value: queue.volume + '%', inline: true})
                      .addFields({name: 'Autoplay', value: queue.autoplay ? 'Enabled' : 'Disabled', inline: true});

    if (curSong.thumbnail) {
        response.setThumbnail(curSong.thumbnail)
    }

    channel.send(response);
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
        recent: [],
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
            key: process.env.YOUTUBE_API,
            type: 'video,playlist'
        }
        
        let result = <any>await ytsearchProm(descriptor, opts).catch(err => {
            logger.error(err);
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
volume.category = 'Music';
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
autoplay.category = 'Music';
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
            let related = await getRelatedVideo(curSong, message.guild.id);

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
play.category = 'Music';
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
}
let radio = <IBaseCommand>{};
radio.aliases = ['radio'];
radio.prettyName = 'Play a Radio Station';
radio.help = 'Search for and plays an internet radio station (try !radio inhailer)';
radio.category = 'Music';
radio.params = [
    {
        name: 'search for station',
        type: 'string'
    }
];
radio.executeViaIntegration = true;
radio.executePermissions = ['SPEAK', 'CONNECT'];
radio.callback = async function(message: Message, descriptor: string) {
    let mesg_fifo : Message[] = [];
    interface NowPlaying {
        title: string;
        artist: string;
        albumArtUrl: string;
    }
    let currentlyPlaying: NowPlaying;
    interface Station {
        bitrate: any;
        image: string;
        subtext: string;
        //title of station
        text: string;
        streamDownloadURL: string,
        //link to m3u file
        URL: string,
    }
    class SpliceMetadata extends Transform {
        private META_INT : number = null;
        private byteCounter: number = 0;
        private iterator: number = 0;
        private tempBuffer: string = "";
        private updateFn: (song) => void = null;
        constructor(META_INT: number, fn: (song) => void, opts?: TransformOptions) {
            super({ ...opts})
            this.META_INT = META_INT;
            this.updateFn = fn;
        }
        /**
         * Metadata comes in this format " StreamTitle='Artist - Song';"
         * This function splits the song and artist into a readable format
         * @param raw Metadata coming straight from the buffer 
         */
        private extractSongTitle(raw: string): NowPlaying | string {
            let np: NowPlaying = {title: null, artist: null, albumArtUrl: null};
            let rawProc : string = raw.split(`StreamTitle='`)[1].split("';")[0];
            let numOfDash = rawProc.replace(/[^-]/g, "").length;
            // If there's more than one dash, we don't know if its part of the song title
            // or splitting the artist and song, so lets just return a string and be easy 
            if(numOfDash > 1){
                return rawProc;
            }
            else if (numOfDash == 1) {
                let splitData = rawProc.split('-');
                np.title = splitData[1].trim();
                np.artist = splitData[0].trim();
                return np;
            }
            else {
                return null;
            }
        }
        _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback) {
            let hexArray = chunk.toString('hex').match(/.{2}/g);
            let filteredChunk: string = ''; 
            chunk.forEach((byte, index) => {
                if(this.byteCounter === this.META_INT) {
                    this.byteCounter = 0;
                    this.iterator = byte * 16;
                }
                else if(this.iterator > 0) {
                    this.iterator--;
                    if(byte !== 0) {
                        this.tempBuffer += String.fromCharCode(byte);
                    }
                    if(this.iterator === 0) {
                        this.updateFn(this.extractSongTitle(this.tempBuffer));
                        this.tempBuffer = "";
                    }
                }
                else {
                    filteredChunk += hexArray[index];
                    this.byteCounter++;
                }
            })
            this.push(Buffer.from(filteredChunk, 'hex'));
        callback();
        }
    }
    async function getAlbumArt(search: NowPlaying) {
        let searchString: string = encodeURIComponent(`${search.artist} ${search.title}`)
        let searchResult = await fetch(`https://itunes.apple.com/search?term=${searchString}`);
        let result = await searchResult.json();
        search.albumArtUrl = result.results[0]?.artworkUrl100 ? result.results[0].artworkUrl100 : '';
        return search;
    }
    async function updateCurrentPlaying(song: NowPlaying | string) {
        if(song !== null) {
            if(typeof song !== 'string') {
                song = await getAlbumArt(song);
                const responseMessage = new MessageEmbed()
                .setAuthor('Prox Radio Player')
                .setTitle(`Now Playing`)
                .setThumbnail(song.albumArtUrl)
                .addFields({name: 'Artist', value: song.artist}, 
                        {name: 'Song', value: song.title})
                mesg_fifo.push(await message.channel.send(responseMessage));  
            }
            else {
                const responseMessage = new MessageEmbed()
                .setAuthor('Prox Radio Player')
                .setTitle(`Now Playing`)
                .setDescription(song);
                mesg_fifo.push(await message.channel.send(responseMessage));  
            }  
        }
        if(mesg_fifo.length == 7) {
            mesg_fifo.shift().delete();
        }
    }
    // If there's a server queue add the song
    let queue = getServerQueue(message.guild.id);
    if (queue) {
            //stop queue
            queue.songs = [];
            queue.dispatcher.end();
    }

    if (!verifyChannelPerms(message)) {
        return;
    }
    let voiceMgr = getVoiceManager(message.guild.id);

    //First search for a station
    // these stations aren't returned by the api, but I want them so stupid special cases
    let chosenStation: Station = {} as Station;
    if(descriptor.toLowerCase() == 'triple j') {
        chosenStation.streamDownloadURL = 'https://live-radio01.mediahubaustralia.com/2TJW/mp3/stream/1/';
        chosenStation.text = 'triple j';
        chosenStation.subtext = 'The best new music from Australia and around the world.';
        chosenStation.image = 'https://cdn-radiotime-logos.tunein.com/s25508g.png';
    }
    else if(descriptor.toLowerCase() == 'double j') {
        chosenStation.streamDownloadURL = 'http://live-radio02.mediahubaustralia.com/DJDW/mp3/';
        chosenStation.text = 'double j';
        chosenStation.subtext = 'A mix of your favourite music, new tunes and the stories behind the music.';
        chosenStation.image = 'https://www.abc.net.au/cm/rimage/9990024-1x1-large.jpg?v=2';
    }
    else {
        let searchResultRaw = await fetch(`https://opml.radiotime.com/Search.ashx?query=${descriptor}`);
        let searchResultsText = await searchResultRaw.text();
        let searchResult = xmlParse.parse(searchResultsText, {ignoreAttributes: false, attributeNamePrefix: ''})["opml"];
        if(searchResult.head.status === 200) {
            for(let i = 0; i < searchResult.body.outline.length; i++) {
                let result = searchResult.body.outline[i];
                if(result.type === 'audio' && result.item === 'station') {
                    chosenStation = result;
                    break;
                }
            };
        }
        //Search results return a m3u file, which is a
        //playlist text file with each new line being a 
        //potential stream URL or another m3u file (inception)
        let m3uResponse = await fetch(chosenStation.URL);
        let m3uText: string = await m3uResponse.text();
        m3uText = m3uText.trimEnd();
        let potentialStreams: string[] = m3uText.split('\n');
        for(let i = 0; i < potentialStreams.length; i++) {
            let stream: string = potentialStreams[i];
            let fileExt = stream.substring(stream.length - 3)
            if(fileExt !== ".m3u" && fileExt !== "pls") {
                chosenStation.streamDownloadURL = stream;
                break;
            }
        }
    }
    let song: ISongData[] = [{
        title: `RADIO: ${chosenStation.text}`,
        url: chosenStation.URL, 
        artists: {},
        type: 'Radio'
    }];
    queue = await createNewQueue(message, song);
    let audioStream = await fetch(chosenStation.streamDownloadURL, {headers: new Headers({'Icy-Metadata': '1'})});
    let spliceMetadata = new SpliceMetadata(parseInt(audioStream.headers.get('icy-metaint')), updateCurrentPlaying);
    audioStream.body.pipe(spliceMetadata);
    let dispatcher = voiceMgr.getConnection().play(spliceMetadata);
    dispatcher.setVolumeLogarithmic(queue.volume / 100);
    queue.dispatcher = dispatcher;
    const responseMessage = new MessageEmbed()
                            .setAuthor('Prox Radio Player')
                            .setTitle(`Tuned to: ${chosenStation.text}`)
                            .setDescription(htmlDecode(chosenStation.subtext))
                            .setThumbnail(chosenStation.image)
                            .addFields({name: 'Bitrate', value: chosenStation.bitrate, inline: true}, 
                                       {name: 'Volume', value: queue.volume, inline: true})

    message.channel.send(responseMessage);
}

let enqueue = <IBaseCommand>{};
enqueue.aliases = ['add', 'a'];
enqueue.prettyName = 'Queue a Song';
enqueue.help = 'Can provide: Youtube (playlist, video, live stream, search words), SoundCloud (track), Spotify (album, playlist).';
enqueue.category = 'Music';
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
dequeue.category = 'Music';
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
skip.category = 'Music';
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
clear.category = 'Music';
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
pause.category = 'Music';
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
resume.category = 'Music';
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
getQueue.category = 'Music';
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

        logger.info(`Music handler loaded: ${handler.getName()}`)
    });
}

export let commands = [enqueue, dequeue, getQueue, clear, play, stop, pause, resume, skip, volume, autoplay, radio];
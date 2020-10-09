let MessageService = require('@services/message');
let EventService = require('@services/events');
let GuildManager = require('@models/GuildManager');

const ytdl = require('ytdl-core-discord');
const ytlist = require('youtube-playlist');
const ytsearch = require('youtube-search');
const scdl = require("soundcloud-downloader");

const utils = require('util');
const _utils = require('@services/utils'); // i chose a great name didn't i

const ytsearchProm = utils.promisify(ytsearch);

const MUSIC_CTX_ID = "MUSIC_QUEUE";

let verifyChannelPerms = function(message) {
    if (!message.member) {
        return false;
    }

    // Verify that the user is in a voice channel
    let voiceCh = message.member.voice.channel;
    if (!voiceCh) {
        MessageService.sendMessage('You need to be in a voice channel to play music', message.channel);
        return false;
    }

    return true;
}

let getVoiceManager = function(guildId) {
    return GuildManager.getVoiceManager(guildId);
}

let getServerQueue = function(guildId) {
    return getVoiceManager(guildId).get(MUSIC_CTX_ID);
}

let getStream = async function(url) {
    if (url.indexOf('youtube.com') !== -1) {
        let stream = await ytdl(url, {
            highWaterMark: 2500000,
            filter: 'audioandvideo' 
        });

        return { stream: stream, type: 'opus' };
    }

    if (url.indexOf('soundcloud.com') !== -1) {
        let stream = await scdl.downloadFormat(url, scdl.FORMATS.OPUS, process.env.SOUNDCLOUD_API);

        return { stream: stream, type: 'ogg/opus' };
    }
}

let getRelatedVideo = async function(url) {
    if (url.indexOf('youtube.com') !== -1) {
        let songInfo = await ytdl.getInfo(url);
            
        if (songInfo.related_videos.length > 0) {
            let related = songInfo.related_videos[0];

            let moreInfo = await ytdl.getInfo(`https://www.youtube.com/watch?v=${related.id}`);
            let artists = [];

            // Get the artist
            if (moreInfo.videoDetails.media.artist) {
                let newArtists = moreInfo.videoDetails.media.artist.split(',');
                newArtists.forEach(artist => {
                    artist = artist.trim();

                    artists[artist] = artists[artist] ? artists[artist] + 1 : 1;
                })
            }

            return {
                title: related.title,
                url: `https://www.youtube.com/watch?v=${related.id}`,
                author: related.author,
                autoplay: true,
                artists: artists
            };
        } else {
            return 'No related videos available';
        }
    }

    if (url.indexOf('soundcloud.com') !== -1) {
        return 'Autoplay is enabled, but not supported with SoundCloud';
    }
}

let playNextSong = async function(guildId, channel) {
    let voiceMgr = getVoiceManager(guildId);
    let queue = getServerQueue(guildId);

    if (!queue || !voiceMgr.getConnection()) {
        return;
    }

    // If there's no more songs go ahead and leave
    if (queue.songs.length === 0) {
        voiceMgr.delete(MUSIC_CTX_ID);

        MessageService.sendMessage('No songs left in the queue', channel);
        return;
    }

    let curSong = queue.songs[0];

    // Create a new dispatcher to play our stream
    let streamData = await getStream(curSong.url);

    // Update the current music stats
    if (curSong.artists.length > 0) {
        updateMusicStats(curSong.artists, [curSong.title], guildId);
    }

    let dispatcher = voiceMgr.getConnection().play(streamData.stream, { type: streamData.type });
    dispatcher.on('finish', (reason) => {
        queue.songs.shift();

        playNextSong(guildId, channel);
    });
    dispatcher.on('error', err => {
        MessageService.sendMessage('Dispatcher error: ' + err, channel);
    });
    dispatcher.on('debug', debugInfo => {
        console.log(debugInfo);
    });
    queue.dispatcher = dispatcher;

    // Print the next song
    let nextSong = '';
    if (queue.songs.length > 1) {
        nextSong = `The next song is **${queue.songs[1].title}**`;
    } else {
        if (queue.autoplay) {
            let related = await getRelatedVideo(curSong.url);

            if (typeof(related) == 'string') {
                nextSong = related
            } else {

                queue.songs.push(related); //title, url, autoplay, author

                nextSong = `Autoplay is enabled. The next song will be **${related.title} by ${related.author}** if no songs are added.`;
            }
        } else {
            nextSong = 'There is no song up next';
        }
    }

    // Set the volume logarithmically
    dispatcher.setVolumeLogarithmic(queue.volume / 100);

    MessageService.sendMessage(`Now playing **${curSong.title}** at **${queue.volume}%**\n${nextSong}`, channel);
}

// Note: artists, songs can only be tracked if the info is on youtube
function updateMusicStats(newArtistData, newSongData, guildId) {
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


let createNewQueue = async function(message, songs) {
    let voiceMgr = getVoiceManager(message.guild.id);

    // Create a new queue object and add the song
    let queue = {
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

async function getSongs(descriptor, guildId) {
    let link = descriptor;
    if (descriptor.indexOf('youtube.com') === -1 && descriptor.indexOf('soundcloud.com') === -1) {
        let opts = {
            maxResults: 1,
            key: process.env.YOUTUBE_API
        }
        
        let result = await ytsearchProm(descriptor, opts).catch(err => {
            console.log(err);
        });

        if (result.length === 1) {
            link = result[0].link;
        }
    }
    
    let songs = [];

    if (link.indexOf('channel') !== -1) {
        return [];
    }

    // YouTube link
    if (link.indexOf('youtube.com') !== -1) {
        let links = [];
        
        // Determine whether we are dealing with a playlist or not
        if (link.indexOf('&list=') !== -1 || link.indexOf('playlist') !== -1) {
            // Query YouTube to get all the songs in the playlist
            let result = await ytlist(link, ['name', 'url']);
            result.data.playlist.forEach(songInfo => {
                links.push(songInfo.url);
            });
        } else {
            links.push(link);
        }
        
        for (let i = 0; i < links.length; i++) {
            let link = links[i];

            // Grab the info for our one song we want to add
            let songInfo = await ytdl.getInfo(link);
            let artists = [];

            // Get the artist
            if (songInfo.videoDetails.media.artist) {
                let newArtists = songInfo.videoDetails.media.artist.split(',');
                newArtists.forEach(artist => {
                    artist = artist.trim();

                    artists[artist] = artists[artist] ? artists[artist] + 1 : 1;
                })
            }

            songs.push({
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url,
                artists: artists
            });
        };
        
    } else if (link.indexOf('soundcloud.com') !== -1) {
        let songInfo = await scdl.getInfo(link, process.env.SOUNDCLOUD_API);

        songs.push({
            title: songInfo.title,
            url: link,
            artists: [songInfo.user.full_name]
        });

    } else {
        return [];
    }

    return songs;
}


let volume = {};
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
volume.callback = function(message, volume) {
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

    return `The volume has been set to **${volume}**`
}

let autoplay = {}
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
autoplay.callback = async function(message, state) {
    let guild = GuildManager.getGuild(message.guild.id);
    
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
            let related = await getRelatedVideo(queue.songs[0].url);

            if (typeof(related) == 'string') {
                nextSong = related
            } else {

                queue.songs.push(related); //title, url, autoplay, author

                nextSong = `Autoplay is now enabled. The next song will be **${related.title} by ${related.author}** if no songs are added.`;
            }
        }

        return 'Autoplay is now enabled';
    }
}


let play = {};
play.aliases = ['play'];
play.prettyName = 'Play Song';
play.help = 'Stops the current song and plays a new one; maintains active queue. Can provide a YouTube/SoundCloud link, or search words for YouTube';
play.params = [
    {
        name: 'link/search criteria',
        type: 'string'
    }
];
play.executeViaIntegration = true;
play.executePermissions = ['SPEAK', 'CONNECT'];
play.callback = async function(message, descriptor) {
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

    let songs = await getSongs(descriptor, message.guild.id);    

    // We need to create a new one!
    await createNewQueue(message, songs);

    // Play next song will pring messages for the bot
    playNextSong(message.guild.id, message.channel);

    return `Added ${songs.length} songs to the queue`;
}

let enqueue = {};
enqueue.aliases = ['add', 'a'];
enqueue.prettyName = 'Queue a Song';
enqueue.help = 'Queue a song from YouTube';
enqueue.params = [
    {
        name: 'link/search criteria',
        type: 'string'
    }
];
enqueue.executeViaIntegration = true;
enqueue.executePermissions = ['SPEAK', 'CONNECT'];
enqueue.callback = async function(message, descriptor) {
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

    let songs = await getSongs(descriptor, message.guild.id);    

    // We need to create a new one!
    await createNewQueue(message, songs);

    // Play next song will pring messages for the bot
    playNextSong(message.guild.id, message.channel);
}

let dequeue = [];
dequeue.aliases = ['remove', 'r'];
dequeue.prettyName = 'Dequeue Song';
dequeue.help = 'Removes the next song from the queue';
dequeue.executeViaIntegration = true;
dequeue.callback = function(message) {
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

let skip = {};
skip.aliases = ['skip'];
skip.prettyName = 'Skip Song';
skip.help = 'Skips the currently playing song';
skip.executeViaIntegration = true;
skip.callback = function(message) {
    let guildId = message.guild.id;

    // Go ahead and end the current stream. This will trigger moving to the next song in the queue.
    let queue = getServerQueue(guildId);
    if (!queue) {
        return 'No active queue';
    }

    queue.dispatcher.end();
}

let stop = {};
stop.aliases = ['stop'];
stop.prettyName = 'Stop Song';
stop.help = 'Clears the queue and stops the currently playing song';
stop.executeViaIntegration = true;
stop.callback = function(message) {
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

let clear = {};
clear.aliases = ['clear', 'empty'];
clear.prettyName = 'Clear Queue';
clear.help = 'Clears the queue but keeps playing the current song';
clear.executeViaIntegration = true;
clear.callback = function(message) {
    let guildId = message.guild.id;

    // Empty the queue
    let queue = getServerQueue(guildId);
    if (!queue) {
        return 'No active queue';
    }

    queue.songs = [];

    return 'Cleared the queue';
}

let pause = {};
pause.aliases = ['pause'];
pause.prettyName = ['Pause Stream'];
pause.help = 'Pauses the stream';
pause.executeViaIntegration = true;
pause.callback = function(message) {
    let guildId = message.guild.id;

    // Pause the stream
    let queue = getServerQueue(guildId);
    if (!queue) {
        return 'No active queue';
    }

    queue.dispatcher.pause();

    return 'The stream has been paused';
}

let resume = {};
resume.aliases = ['resume'];
resume.prettyName = 'Resume Stream';
resume.help = 'Resumes the stream';
resume.executeViaIntegration = true;
resume.callback = function(message) {
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

let getQueue = {};
getQueue.aliases = ['queue', 'list'];
getQueue.prettyName = 'Queue';
getQueue.help = 'Prints the first five songs of the queue';
getQueue.executeViaIntegration = true;
getQueue.callback = function(message) {
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

module.exports.addHooks = function(client) {
    // Hook to see if we should stop playing music when everyone leaves the channel
    client.on("voiceStateUpdate", function(oldState, newState){
        try {
            let queue = getServerQueue(oldState.guild.id);
            if (!queue) {
                return;
            }

            // Our bot left!
            /*if (oldState.member.displayName == "Prox" && newState.connection == null) {
                queue.songs = [];
                
                MessageService.sendMessage('We left the channel from another context, ending the queue', queue.textChannel);
                
                queue.connection.dispatcher.end();
            }*/
            
        } catch(e) {}    
    });
}

module.exports.commands = [enqueue, dequeue, getQueue, clear, play, stop, pause, resume, skip, volume, autoplay];
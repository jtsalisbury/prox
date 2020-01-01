const ytdl = require('ytdl-core');
let serverQueues = new Map();

let verifyChannelPerms = function(message) {
    let voiceCh = message.member.voiceChannel;
    if (!voiceCh) {
        global.cbot.sendError('You need to be in a voice channel to play music');
    }

    let perms = voiceCh.permissionsFor(message.client.user);
    if (!perms.has('CONNECT') || !perms.has('SPEAK')) {
        global.cbot.sendError('I need permission to join and speak here!');
    }
}

let getServerQueue = function(guildId) {
    let queue = serverQueues.get(guildId);
    if (!queue) {
        global.cbot.sendError('No active queue');
    }

    return queue;
}

let verifyChannelMembers = function(guildId) {
    let queue = getServerQueue(guildId);

    if (queue.connection.channel.members.length === 1) {
        queue.connection.channel.leave();
        serverQueues.delete(guildId);
        global.cbot.sendError('No members left in the channel, leaving');
    }
}

let playNextSong = function(guildId, channel) {
    let queue = serverQueues.get(guildId);

    // If there's no more songs go ahead and leave
    if (queue.songs.length === 0) {
        queue.connection.channel.leave();
        serverQueues.delete(guildId);

        return;
    }

    verifyChannelMembers(guildId);
    let curSong = queue.songs[0];

    let stream = ytdl(curSong.url, {
        filter: 'audioonly'
    });
    stream.on('error', err => {
        global.cbot.sendError(err);
    });

    let dispatcher = queue.connection.playStream(stream);
    dispatcher.on('end', (reason) => {
        queue.songs.shift();

        playNextSong(guildId, channel);
    })
    dispatcher.on('error', err => {
        global.cbot.sendError(err);
    });

    let nextSong = '';
    if (queue.songs.length > 1) {
        nextSong = `The next song is **${queue.songs[1].title}**`;
    } else {
        nextSong = 'There is no song up next';
    }

    dispatcher.setVolumeLogarithmic(queue.volume / 5);

    global.cbot.sendMessage(`Now playing **${curSong.title}**\n${nextSong}`, channel);
}

let createNewQueue = async function(message, song) {
    // Create a new queue object and add the song
    let queue = {
        textChannel: message.channel,
        voiceChannel: message.member.voiceChannel,
        connection: null,
        songs: [song],
        volume: 5,
        playing: true
    };

    // Try to join the voice channel
    let conn = await message.member.voiceChannel.join();
    queue.connection = conn;

    // Add the guild queue to the map
    serverQueues.set(message.guild.id, queue);
}


let play = {};
play.aliases = ['play'];
play.prettyName = 'Play Song';
play.help = 'Stops the current song and plays a new one; maintains active queue';
play.params = [
    {
        name: 'song link',
        type: 'string'
    }
];
play.callback = async function(message, link) {
    verifyChannelPerms(message);

    let songInfo = await ytdl.getInfo(link);
    let song = {
        title: songInfo.title,
        url: songInfo.video_url
    }

    // If there's a server queue add the song
    let queue = serverQueues.get(message.guild.id);
    if (queue) {
        // Add the song to the beginning of the queue and stop playing the current song
        queue.songs.splice(1, 0, song)
        queue.connection.dispatcher.end();
       
        return;
    }

    // We need to create a new one!
    await createNewQueue(message, song);

    // Play next song will pring messages for the bot
    playNextSong(message.guild.id, message.channel);
}

let enqueue = {};
enqueue.aliases = ['enqueue'];
enqueue.prettyName = 'Queue a Song';
enqueue.help = 'Queue a song from YouTube';
enqueue.params = [
    {
        name: 'song link',
        type: 'string'
    }
];
enqueue.callback = async function(message, link) {
    verifyChannelPerms(message);

    let songInfo = await ytdl.getInfo(link);
    let song = {
        title: songInfo.title,
        url: songInfo.video_url
    }

    // If there's a server queue add the song
    let queue = serverQueues.get(message.guild.id);
    if (queue) {
        queue.songs.push(song);

        return `**${song.title}** has been added to the queue`;
    }

    // We need to create a new one!
    await createNewQueue(message, song);

    // Play next song will pring messages for the bot
    playNextSong(message.guild.id, message.channel);
}

let dequeue = [];
dequeue.aliases = ['dequeue'];
dequeue.prettyName = 'Dequeue Song';
dequeue.help = 'Removes the next song from the queue';
dequeue.callback = function(message) {
    let guildId = message.guild.id;

    verifyChannelPerms(message);

    let queue = getServerQueue(guildId);

    if (queue.songs.length === 1) {
        global.cbot.sendError('There are no songs in the queue');
    }

    // Current song is still at index 0, so remove index 1
    queue.songs.splice(1, 1);

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
skip.callback = function(message) {
    let guildId = message.guild.id;

    verifyChannelPerms(message);

    let queue = getServerQueue(guildId);
    queue.connection.dispatcher.end();
}

let stop = {};
stop.aliases = ['stop'];
stop.prettyName = 'Stop Song';
stop.help = 'Clears the queue and stops the currently playing song';
stop.callback = function(message) {
    let guildId = message.guild.id;

    verifyChannelPerms(message);

    let queue = getServerQueue(guildId);
    queue.songs = [];
    queue.connection.dispatcher.end();

    return 'Cleared the active queue and stopped playing all songs';
}

let clear = {};
clear.aliases = ['clear'];
clear.prettyName = 'Clear Queue';
clear.help = 'Clears the queue but keeps playing the current song';
clear.callback = function(message) {
    let guildId = message.guild.id;

    verifyChannelPerms(message);

    let queue = getServerQueue(guildId);
    queue.songs = [];

    return 'Cleared the queue';
}

let pause = {};
pause.aliases = ['pause'];
pause.prettyName = ['Pause Stream'];
pause.help = 'Pauses the stream';
pause.callback = function(message) {
    let guildId = message.guild.id;

    verifyChannelPerms(message);

    let queue = getServerQueue(guildId);
    queue.connection.dispatcher.pause();

    return 'The stream has been paused';
}

let resume = {};
resume.aliases = ['resume'];
resume.prettyName = 'Resume Stream';
resume.help = 'Resumes the stream';
resume.callback = function(message) {
    let guildId = message.guild.id;

    verifyChannelPerms(message);

    let queue = getServerQueue(guildId);
    if (queue.connection.dispatcher.paused) {
        queue.connection.dispatcher.resume();
    } else {
        global.cbot.sendError('The stream isn\'t paused');
    }

    return 'The stream has been resumed';
}

let getQueue = {};
getQueue.aliases = ['queue'];
getQueue.prettyName = 'Queue';
getQueue.help = 'Prints the first five songs of the queue';
getQueue.callback = function(message) {
    let guildId = message.guild.id;

    verifyChannelPerms(message);

    let queue = getServerQueue(guildId);
    let queueStr = 'First few songs of the queue are ';
    if (queue.songs.length > 1) {
        let i = 1;
        while (i < 5) {
            queueStr += `**${queue.songs[i].title}**, `

            if (!queue.songs[i + 1]) {
                break;
            }

            i += 1;
        }

        queueStr = queueStr.substr(0, queueStr.length - 2); 
    } else {
        queueStr = 'There are no songs in the queue';
    }

    // return string without last comma and space
    return queueStr
}

module.exports.commands = [enqueue, dequeue, getQueue, clear, play, stop, pause, resume, skip];
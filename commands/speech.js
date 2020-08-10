/*let EventEmitter = require('@services/events');
let _utils = require('@services/utils');
let fs = require('fs');
let GuildManager = require('@models/GuildManager');
let { Transform } = require('stream');

let speechCache = new Map();

function buffToChan(buff) {
    let convBuff = Buffer.alloc(buff.length / 2);

    for (i = 0; i < convBuff.length / 2; i++) {
        let toInt16 = buff.readUInt16LE(i * 4);
        convBuff.writeUInt16LE(toInt16, i * 2);
    }

    return convBuff;
}

async function createSpeechInstance(guildId, channel, connection) {
    let data = {
        channel: channel,
        connection: connection
    }
    
    if (!connection) {
        data.connection = await channel.join();
    }

    speechCache.set(guildId, data);
}

let join = {};
join.aliases = ['join'];
join.prettyName = 'Join Voice Channel';
join.help = 'Joins a voice channel and prepares cbot to listen for voice input';
join.callback = async function (message) {
    if (speechCache.get(message.guild.id)) {
        return 'Already actively listening for speech input';
    }

    if (message.member.voice.channel) {
        createSpeechInstance(message.guild.id, message.member.voice.channel, null);

        return 'Listening for voice input';
    }

    return 'You need to be in a voice channel to use this!';
}

let leave = {};
leave.aliases = ['leave'];
leave.prettyName = 'Leave Voice Channel';
leave.help = 'Leaves a voice channel';
leave.callback = function (message) {
    let data = speechCache.get(message.guild.id);
    if (data) {
        console.log(data);
        data.channel.leave();
        return 'No longer listening for voice input';
    }

    return 'Not actively listening!';
}

let speechClient;
module.exports.addHooks = function(client) {
    /*client.on('ready', () => {
        // Generate new google application credentials
        let content = new Buffer(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64');
        content = content.toString('ascii');

        fs.writeFile(process.env.GOOGLE_APPLICATION_CREDENTIALS, content, function(err) {
            if (err) {
                console.log(err);
            }
        });

        speechClient = new GoogleSpeech.SpeechClient();
    });

    client.on('speaking', (user, speaking) => {
        if (!speaking) {
            return;
        }

        let guild = GuildManager.
    })
}

module.exports.addHooks = function(client) {
    // Hook to see if we should stop playing music when everyone leaves the channel
    client.on("voiceStateUpdate", function(oldState, newState){
        try {
            let cache = speechCache.get(oldState.guild.id);
            if (!cache) {
                if (oldState.member.displayName == "cbot" && newState.channel) {
                    createSpeechInstance(newState.guild.id, newState.channel, newState.connection);
                }

                return;
            }

            // Our bot left!
            if (oldState.member.displayName == "cbot" && newState.connection == null) {
                cache.songs = [];
                
                MessageService.sendMessage('We left the channel from another context, no longer listening for voice input', queue.textChannel);
                
                queue.connection.dispatcher.end();
            }
            
        } catch(e) {}    
    });
}

module.exports.commands = [join, leave];*/
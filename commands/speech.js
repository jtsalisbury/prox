let EventEmitter = require('@services/events');
let _utils = require('@services/utils');
let fs = require('fs');
let GuildManager = require('@models/GuildManager');
let GoogleSpeech = require('@google-cloud/speech');
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

class ConvertTo1ChannelStream extends Transform {
    constructor(source, options) {
        super(options)
    }
  
    _transform(data, encoding, next) {
        next(null, buffToChan(data))
    }
}

let join = {};
join.aliases = ['join'];
join.prettyName = 'Join Voice Channel';
join.help = 'Joins a voice channel';
join.callback = async function (message) {
    if (message.member.voice.channel) {
        await message.member.voice.channel.join();

        speechCache.set(message.guild.id, message.member.voice.channel);

        return 'Listening for voice input';
    }

    return 'You need to be in a voice channel to use this!';
}

let leave = {};
leave.aliases = ['leave'];
leave.prettyName = 'Leave Voice Channel';
leave.help = 'Leaves a voice channel';
leave.callback = function (message) {
    let ch = speechCache.get(message.guild.id);
    if (ch) {
        ch.leave();
        return 'No longer listening for voice input';
    }

    return 'Not actively listening';
}

let setReply = {};
setReply.aliases = ['setreply'];
setReply.prettyName = 'Set Reply Channel';
setReply.help = 'Sets the current text channel to reply in';
setReply.callback = function (message) {
    let id = message.channel.id;

    let guild = GuildManager.getGuild(message.guild.id);
    guild.speech.replyChannelId = id;

    return 'Speech reply channel set!';
}

let speechClient;
module.exports.addHooks = function(client) {
    client.on('ready', () => {
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

module.exports.commands = [join, leave, setReply];
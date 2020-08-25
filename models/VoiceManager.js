const SpeechInterpreter = require("@models/SpeechInterpreter");
let MessageService = require('@services/message');
const utils = require('@services/utils');

class VoiceManager {
    constructor() {
        this.data = new Map();
        
        this.channel;
        this.connection;

        this.speechContext;

        this.interpreter = new SpeechInterpreter();
    }

    inChannel() {
        return this.channel && this.connection;
    }

    async joinChannel(channel) {
        if (this.inChannel()) {
            this.leaveChannel();
        }

        console.log('joining channel...');

        this.connection = await channel.join();

        this.connection.on('speaking', (user, speaking) => {
            console.log('speaking update for ' + user.username);
            if (!speaking) {
                return;
            } 

            let GuildManager = require('@models/GuildManager');
            let guild = GuildManager.getGuild(channel.guild.id);
            if (!guild.allowSpeechRecognition.includes(user.id)) {
                return;
            }
 
            console.log('listening to ' + user.username);

            // Get an audio stream
            let audio = this.connection.receiver.createStream(user, { mode: 'pcm' });

            this.interpreter.interpret(audio).then(async response => {
                let guildId = channel.guild.id;
                let GuildManager = require('@models/GuildManager');

                let guildState = GuildManager.getGuild(guildId);
                
                if (!guildState) {
                    return;
                }

                if (typeof(response) != 'string' || response.length == 0) {
                    return;
                }

                let validStarters = ['bot', 'hey bot', 'hey cbot'];
                for (let i = 0; i < validStarters.length; i++) {
                    let starter = validStarters[i];

                    if (response.substr(0, starter.length) == starter) {
                        response = '!' + response.substr(starter.length + 1);
                        break;
                    }
                }

                if (response.substr(0, 1) != '!') {
                    return;
                }

                if (guildState.externalMessageChannelId && guildState.externalMessageChannelId.length > 0) {
                    MessageService.messageChannelById(response, channel.guild, guildState.externalMessageChannelId);
                }

            }).catch(err => {
                console.log("Error when parsing audio: " + err);
            });
        })

        this.channel = channel;
        this.speechContext = {};
    }

    leaveChannel() {
        this.channel.leave();
        this.connection = null;

        this.data = new Map();
    }

    getSpeechContext() {
        return this.speechContext;
    }

    getConnection() {
        return this.connection;
    }

    set(id, data) {
        this.data.set(id, data);
    }

    get(id) {
        return this.data.get(id);
    }

    delete(id) {
        this.data.delete(id);
    }
}

module.exports = VoiceManager;
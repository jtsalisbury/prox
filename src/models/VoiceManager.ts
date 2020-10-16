import SpeechInterpreter from './SpeechInterpreter';
import { messageChannelById } from '../services/message';
import { User, VoiceChannel, VoiceConnection } from 'discord.js';
import logger from '../services/logger';

export default class VoiceManager {
    private data: Map<any, any>;
    private channel: VoiceChannel;
    private connection: VoiceConnection;
    private interpreter: SpeechInterpreter;

    constructor() {
        this.data = new Map();
        this.interpreter = new SpeechInterpreter();
    }

    public inChannel(): boolean {
        return this.channel != null && this.connection != null;
    }

    public async joinChannel(channel: VoiceChannel) {
        if (this.inChannel()) {
            this.leaveChannel();
        }

        logger.info('joining channel...');

        this.connection = await channel.join();

        this.connection.on('speaking', async (user: User, speaking: boolean) => {
            if (!speaking) {
                return;
            } 

            let GuildManager = (await import('./GuildManager')).default;
            let guild = GuildManager.getGuild(channel.guild.id);
            if (!guild.allowSpeechRecognition.includes(user.id)) {
                return;
            }

            // Get an audio stream
            let audio = this.connection.receiver.createStream(user, { mode: 'pcm' });

            this.interpreter.interpret(audio).then(async response => {
                let guildId = channel.guild.id;

                let guildState = GuildManager.getGuild(guildId);
                
                if (!guildState) {
                    return;
                }

                if (typeof(response) != 'string' || response.length == 0) {
                    return;
                }

                let validStarters = ['bot', 'hey bot', 'hey prox'];
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
                    messageChannelById(response, channel.guild, guildState.externalMessageChannelId);
                }

            }).catch(err => {
                logger.error("Error when parsing audio: " + err);
            });
        })

        this.channel = channel;
    }

    public leaveChannel() {
        this.channel.leave();
        this.connection = null;

        this.data = new Map();
    }

    public getChannel(): VoiceChannel {
        return this.channel;
    }

    public getConnection(): VoiceConnection {
        return this.connection;
    }

    public set(id: any, data: any) {
        this.data.set(id, data);
    }

    public get(id: any): any {
        return this.data.get(id);
    }

    public delete(id: any) {
        this.data.delete(id);
    }
}
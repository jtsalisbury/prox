import mongoose from 'mongoose';
import VoiceManager from './VoiceManager';
import IntegrationManager from './IntegrationManager';
import logger from '../services/logger';

class GuildManager {
    private guildCache: Map<string, mongoose.Document>;
    private voiceCache: Map<string, object>;
    private integrationCache: Map<string, object>;
    private guildSchema: mongoose.Schema;
    private Guild: any;

    constructor() {
        this.guildCache = new Map();
        this.voiceCache = new Map();
        this.integrationCache = new Map();
    }

    public async connect() {
        try {
            await mongoose.connect(process.env.MONGODB_STRING, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
                
            mongoose.connection.on('error', async () => {
                mongoose.connection.close();
                await this.connect();
            });

            this.guildSchema = new mongoose.Schema({
                guildId: mongoose.Schema.Types.String,
                restrictions: [{
                    channelId: mongoose.Schema.Types.String,
                    type: mongoose.Schema.Types.String,
                    canPost: mongoose.Schema.Types.Boolean
                }],
                reactions: [{
                    messageContains: mongoose.Schema.Types.String,
                    reactWith: mongoose.Schema.Types.String
                }],
                autoActions: [{
                    userAction: mongoose.Schema.Types.String,
                    performAction: mongoose.Schema.Types.String
                }],
                events: [{
                    title: mongoose.Schema.Types.String,
                    description: mongoose.Schema.Types.String,
                    channelId: mongoose.Schema.Types.String,
                    messageChannelId: mongoose.Schema.Types.String,
                    messageId: mongoose.Schema.Types.String,
                    date: mongoose.Schema.Types.Date,
                    creatorId: mongoose.Schema.Types.String,
                    eventPassed: mongoose.Schema.Types.Boolean
                }],
                statistics: mongoose.Schema.Types.Mixed,
                externalMessageChannelId: mongoose.Schema.Types.String,
                integrations: [{
                    channelId: mongoose.Schema.Types.String,
                    signature: mongoose.Schema.Types.String,
                    integrationName: mongoose.Schema.Types.String,
                    syncMessages: mongoose.Schema.Types.Boolean,
                    integrationId: mongoose.Schema.Types.Number
                }],
                allowSpeechRecognition: [],
                autoplayEnabled: mongoose.Schema.Types.Mixed
            });

            this.Guild = mongoose.model('Guild', this.guildSchema);
        } catch (err) {
            logger.error('Connection error: ' + err);
        }
    }

    public addGuild(guildId: string, newGuild = false) {
        return new Promise((resolve, reject) => {
            if (newGuild) {
                let newGuild = new this.Guild({
                    guildId: guildId,
                    restrictions: [],
                    reactions: [],
                    autoActions: [],
                    statistics: {},
                    events: [],
                    integrations: []
                });

                this.voiceCache.set(guildId, new VoiceManager());

                newGuild.save();
                this.guildCache.set(guildId, newGuild);
                resolve(newGuild);
            } else {
                this.Guild.findOne({ guildId: guildId }, async (err, res) => {
                    if (err) {
                        logger.error(err);
                        return;
                    }

                    if (!res) {
                        let newGuild = await this.addGuild(guildId, true);
                        resolve(newGuild);
                        return;
                    }

                    this.voiceCache.set(guildId, new VoiceManager());

                    res.integrations.forEach(int => {
                        IntegrationManager.addIntegration(guildId, int);
                    });

                    this.guildCache.set(guildId, res);
                    resolve(res);
                });
            }
        })
    }

    public removeGuild(guildId: string) {
        this.guildCache.set(guildId, null);
        this.Guild.deleteOne({ guildId: guildId }, (err) => {
            if (err) {
                logger.error(err);
            }
        });
    }

    public getGuild(guildId): any {
        return this.guildCache.get(guildId);
    }

    public getVoiceManager(guildId): VoiceManager {
        return <VoiceManager>this.voiceCache.get(guildId);
    }

    public getIntegrationManager(guildId): object {
        return this.integrationCache.get(guildId);
    }
}

export default new GuildManager();
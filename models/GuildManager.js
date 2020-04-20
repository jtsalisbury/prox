let mongoose = require('mongoose');

class GuildManager {
    constructor() {
        this.guildCache = new Map();
    }

    async connect() {
        try {
            await mongoose.connect(process.env.MONGODB_STRING, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
                
            mongoose.connection.on('error', async () => {
                mongoose.connection.disconnect();
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
                speech: [{
                    whitelistedUsers: [],
                    replyChannelId: mongoose.Schema.Types.String
                }],
                statistics: mongoose.Schema.Types.Mixed
            });

            this.Guild = mongoose.model('Guild', this.guildSchema);
        } catch (err) {
            console.error('Connection error: ' + err);
        }
    }

    addGuild(guildId, newGuild = false) {
        if (newGuild) {
            let newGuild = new this.Guild({
                guildId: guildId,
                restrictions: [],
                reactions: [],
                autoActions: [],
                statistics: {}
            });

            newGuild.save();
            this.guildCache.set(guildId, newGuild);
        } else {
            this.Guild.findOne({ guildId: guildId }, (err, res) => {
                if (err) {
                    console.log(err);
                    return;
                }

                this.guildCache.set(guildId, res);
            });
        }
    }

    removeGuild(guildId) {
        this.guildCache.set(guildId, null);
        this.Guild.deleteOne({ guildId: guildId }, (err) => {
            if (err) {
                console.log(err);
            }
        });
    }

    getGuild(guildId) {
        return this.guildCache.get(guildId);
    }

    //TODO: Some sort of getGuildValue where a string is passed that resolves to a location
}

module.exports = new GuildManager();
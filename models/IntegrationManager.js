

class IntegrationManager {
    constructor() {
        this.integrationCache = new Map();
    }

    addIntegration(guildId, integration) {
        if (process.env.DEBUG_MODE) {
            console.log(integration.signature);
        }

        this.integrationCache.set(integration.signature, {
            guildId: guildId, 
            channelId: integration.channelId,
            sync: integration.syncMessages,
            name: integration.integrationName,
            connections: {} 
        });
    }

    getIntegration(signature) {
        return this.integrationCache.get(signature);
    }

    getAll() {
        return this.integrationCache;
    }
}

module.exports = new IntegrationManager();
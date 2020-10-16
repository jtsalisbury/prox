import logger from "../services/logger";

class IntegrationManager {
    private integrationCache: Map<string, any> = null;

    constructor() {
        this.integrationCache = new Map();
    }

    public addIntegration(guildId, integration) {
        if (process.env.DEBUG_MODE) {
            logger.info(integration.signature);
        }

        this.integrationCache.set(integration.signature, {
            guildId: guildId, 
            channelId: integration.channelId,
            sync: integration.syncMessages,
            name: integration.integrationName,
            connections: {} 
        });
    }

    public getIntegration(signature) {
        return this.integrationCache.get(signature);
    }

    public getAll() {
        return this.integrationCache;
    }
}

export default new IntegrationManager();
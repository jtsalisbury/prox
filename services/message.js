let _utils = require('@services/utils');

let IntegrationManager, GuildManager, CommandHandler;

module.exports = {};

module.exports.initialize = function() {
    GuildManager = require('@models/GuildManager');
    CommandHandler = require('@models/CommandHandler');
    IntegrationManager = require('@models/IntegrationManager');
}

module.exports.process = async function(message, external = false) {
    if (!GuildManager || !CommandHandler || !IntegrationManager) {
        return;
    }

    if (message.author) {
        // Loop through our cache of integrations to sync messages
        // We only do this if we have a valid author (message from discord!)
        IntegrationManager.getAll().forEach(integration => {
            let intNameLen = integration.name.length;
            // If we don't want to sync messages OR the message was from our bot and the integration name matches the prefix
            if (!integration.sync || (message.author.bot && message.content.substr(0, intNameLen + 2) == `[${integration.name}]`)) {
                return;
            }

            // For this channel, if the integration matches, go ahead and send it!
            if (message.channel.id == integration.channelId) {
                for (let socketId in integration.connections) {
                    console.log('Sending integration message to ' + integration.name + ' with message ' + message.content);
                    integration.connections[socketId].emit('message', {
                        sender: message.author.username, 
                        content: message.content 
                    });
                }
            }
        });
    }

    if (!message.channel.permissionsFor(message.guild.me).has('SEND_MESSAGES', false)) {
        return;
    }

    if (process.env.DEBUG_MODE == 'true') {
        if (message.guild.id != '659852554754064410') {
            return;
        }
    }

    // Our client needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    let content = message.content;
    if (content.substring(0, 1) == '!') {
        let parts = _utils.parseLine(content.substr(1));
        let alias = parts[0].toLowerCase();

        parts.shift();

        let response = null;
        try {
            response = await CommandHandler.executeCommand(alias, message, parts, external);
        } catch (e) {
            console.error(e);
            return 'Error processing command, contact administrator';
        }

        // If we should print a message
        if (response) {
            return response;
        }
    }

    // Record the number of times a user messages
    let guild = GuildManager.getGuild(message.guild.id);
    if (guild) {
        if (!message.author) {
            return;
        }

        let userId = message.author.id;
        let messages = _utils.resolve(guild, 'statistics.messages');

        // Update the count
        let newCount = 1;
        if (messages[userId]) {
            newCount += messages[userId];
        }

        // Set it and save!
        messages[userId] = newCount;
        guild.markModified('statistics.messages');
    }
}

module.exports.sendMessage = function(string, target) {
    return target.send(string, { split: true });
}

module.exports.sendCommandError = function(command, alias, target) {
    if (command) {
        return target.send(`Usage: ${_utils.cmdHelp(command, alias)}`, { split: true });
    }
}

module.exports.messageChannelById = function(string, guild, id) {
    let ch = guild.channels.cache.get(id);

    if (ch) {
        ch.send(string, { split: true });
    } 
}
import * as _utils from './utils';

import CommandHandler from '../models/CommandHandler';
import GuildManager from '../models/GuildManager';
import IntegrationManager from '../models/IntegrationManager';

import logger from '../services/logger';
import Command from '../models/Command';

import { Message, MessageEmbed, TextChannel, User } from 'discord.js';

/**
 * Handles the processing of a Discord Message, including execution of the command
 * @param message, the Discord Message
 * @param external, whether the message was sent via an integration
 */
export async function processMessage(message: Message, external = false): Promise<void | string> {
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

            let content = message.content;
            // mark all mentions as the actual username of the person
            message.mentions.users.array().forEach((entry: User) => {
                content = content.replace(`<@!${entry.id}>`, '@' + entry.username);
            });

            // For this channel, if the integration matches, go ahead and send it!
            if (message.channel.id == integration.channelId) {
                for (let socketId in integration.connections) {
                    logger.info('Sending integration message to ' + integration.name + ' with message ' + message.content);
                    integration.connections[socketId].emit('message', {
                        sender: message.author.username, 
                        guild: message.guild.name,
                        content: content 
                    });
                }
            }
        });
    }

    // Make sure we can respond in the channel
    let channel = <TextChannel>message.channel;
    if (message.guild && !channel.permissionsFor(message.guild.me).has('SEND_MESSAGES', false)) {
        if (message.content.substring(0, 1) == '!' && !message.author.bot) {
            this.sendMessage('I don\'t have permission to send messages in this channel', message.author);
        }
        return;
    }

    // Our client needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    let content = message.content;
    if (content.substring(0, 1) == '!') {
        let parts = _utils.parseLine(content.substr(1));
        let alias = parts[0].toLowerCase();

        parts.shift();

        // Try to process our command
        let response = null;
        try {
            response = await CommandHandler.executeCommand(alias, message, parts, external);
        } catch (e) {
            logger.error(e);
        }

        // If we should print a message
        if (response) {
            return response;
        }
    }

    if (!message.guild) {
        return;
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

/**
 * Send a message to a channel or user
 * @param string, the message to send
 * @param target, the TextChannel or user
 */
export function sendMessage(string: string | MessageEmbed, target) {
    return target.send(string, { split: true });
}

/**
 * Sends a formatted string to a target
 * @param command, the Command
 * @param alias, the command alias 
 * @param target, the TextChannel or user
 */
export function sendCommandError(command: Command, alias: string, target) {
    if (command) {
        return target.send(`Usage: ${_utils.cmdHelp(command, alias)}`, { split: true });
    }
}

/**
 * Searches the guild for a channel by its id, and sends a message to it
 * @param string, the message
 * @param guild, the guild
 * @param id, the channel id
 */
export function messageChannelById(message: string, guild, id) {
    let ch = guild.channels.cache.get(id);

    if (ch) {
        ch.send(message, { split: true });
    } 
}
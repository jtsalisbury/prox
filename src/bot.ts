import dotenv from 'dotenv';
dotenv.config();

import * as Discord from 'discord.js';
let client = new Discord.Client();

import glob from 'glob';
import path from 'path';

import EventService from './services/events';
import CommandHandler from './models/CommandHandler';
import GuildManager from './models/GuildManager';
import { processMessage, sendMessage } from './services/message';

import initializeWeb from './bot-web';
import { IBaseCommand } from './models/IBase';

import logger from './services/logger';

logger.info('Loading param types...');

let paramTypes = {};

// Load param types (bool, string, etc)
glob.sync(__dirname + '/param_types/*.js').forEach(async file => {
    let paramClass = await import(path.resolve(file));
    let paramType = new paramClass.default();

    logger.debug(`Found param type of ${paramType.getParamType()}`);
    paramTypes[paramType.getParamType()] = paramType;
});

logger.info('Loading commands...');

// Load commands 
glob.sync(__dirname + '/commands/*.js').forEach(async file => {
    let required = await import(path.resolve(file));

    if (!required.commands) {
        return;
    }

    let commands = null;
    if (typeof required.commands === 'function') {
        // we need to pass the bot as an argument. the function should immediately return the commands
        commands = required.commands(CommandHandler);
    } else {
        commands = required.commands;
    }
    if (required.initialize) {
        required.initialize(client);
    }

    // Loop through the commands and register them!
    commands.forEach((cmdData: IBaseCommand) => {
        let cmd = CommandHandler.registerCommand(
            cmdData.aliases,
            cmdData.prettyName,
            cmdData.help,
            cmdData.category,
            cmdData.callback,
            cmdData.userPermissions,
            cmdData.executePermissions,
            cmdData.executeViaIntegration
        );

        logger.info(`Loaded ${cmdData.prettyName}`);

        // Don't forget parameters!
        if (cmdData.params) {
            cmdData.params.forEach(paramData => {
                let paramType = paramTypes[paramData.type];
                if (!paramType) {
                    logger.error('Invalid param type (' + paramData.type +') with \'' + paramData.name + '\' for ' + cmd.getName() + ' - this will cause errors');
                    return;
                }

                let createdParam = Object.create(paramType);
                Object.assign(createdParam, paramData);

                cmd.addParam(createdParam);
            });
        }
    });
})

// Register a new client
client.login(process.env.DISCORD_TOKEN);

// We are ready!
client.on('ready', async () => {
    logger.info('Connected');
    logger.info('Logged in as: ' + client.user.username + ' - (' + client.user.id + ')');

    client.user.setActivity('!help for commands');

    await GuildManager.connect();

    logger.info('Loading guilds...');

    // Make sure we get up to date documents on each guild
    let guildPromises = [];
    client.guilds.cache.array().forEach(guild => {
        logger.info(`Guild ${guild.id} loaded`);
        guildPromises.push(GuildManager.addGuild(guild.id));
    });

    // Once we've got all the data, fire an event
    Promise.all(guildPromises).then((guilds) => {
        EventService.emit('prox.guildsLoaded', guilds);
    })
});

client.on('voiceStateUpdate', (oldState: Discord.VoiceState, newState: Discord.VoiceState) => {
    let guildId = newState.guild.id;
    let voiceMgr = GuildManager.getVoiceManager(guildId);
    
    // If everyone left our voice channel, and we're connected, disconnect
    if (voiceMgr.inChannel() && voiceMgr.getChannel().members.size == 1) {
        voiceMgr.leaveChannel();
    }
});

// Save every five minutes
let guilds = [];

EventService.on('prox.guildsLoaded', async function (loaded) {
    guilds = loaded;
    function saveGuilds() {
        logger.info('Saving guilds...');
        guilds.forEach(guild => {
            if (!guild) {
                return;
            }

            guild.save();
        });

        setTimeout(saveGuilds, 300000);
    }
    setTimeout(saveGuilds, 300000);

    // Initialize web handler
    initializeWeb(client);
});

// We joined a guild
client.on('guildCreate', async guild => {
    let newGuild = await GuildManager.addGuild(guild.id, true);
    EventService.emit('prox.guildAdded', newGuild);
    guilds.push(newGuild);

    logger.info(`Joined new guild ${guild.id}`);
});

// We left a guild
client.on('guildDelete', (guild: any) => {
    // Make sure we update any cache systems that may hold the doc
    GuildManager.removeGuild(guild.id)
    EventService.emit('prox.guildRemoved', guild.id);
    guilds.forEach((guilds, index) => {
        if (guild.guildId == guild.id) {
            guilds.splice(index, 1);
            logger.info(`Left guild ${guild.id}`);
        }
    })
});

// We have a new message
client.on('message', async message => {
    let response = await processMessage(message);

    if (response) {
        sendMessage(response, message.channel);
    }
});
require('dotenv').config();
require('module-alias/register')

let Discord = require('discord.js');
let client = new Discord.Client();

let glob = require('glob');
let path = require('path');
let logger = require('winston');

let _utils = require('@services/utils');

let EventService = require('@services/events');
let CommandHandler = require('@models/CommandHandler');
let GuildManager = require('@models/GuildManager');
let MessageService = require('@services/message');

glob.sync('./commands/*.js').forEach(file => {
    let required = require(path.resolve(file));
    let commands = null;
    if (typeof required.commands === 'function') {
        // we need to pass the bot as an argument. the function should immediately return the commands
        commands = required.commands(CommandHandler);
    } else {
        commands = required.commands;
    }
    if (required.addHooks) {
        required.addHooks(client);
    }

    // Loop through the commands and register them!
    commands.forEach(cmdData => {
        let cmd = CommandHandler.registerCommand(
            cmdData.aliases,
            cmdData.prettyName,
            cmdData.help,
            cmdData.callback,
            cmdData.userPermissions,
            cmdData.executePermissions
        );

        // Don't forget parameters!
        if (cmdData.params) {
            cmdData.params.forEach(paramData => {
                cmd.addParam(paramData.name, paramData.type, paramData.optional == undefined ? false : paramData.optional, paramData.default);
            });
        }
    });
})

logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Register a new client
client.login(process.env.DISCORD_TOKEN);

// We are ready!
client.on('ready', async () => {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(client.user.username + ' - (' + client.user.id + ')');

    await GuildManager.connect();

    client.guilds.cache.array().forEach(guild => {
        if (process.env.DEBUG_MODE) {
            if (guild.id == '659852554754064410') {
                GuildManager.addGuild(guild.id);
            }
        }
    });
});

client.on('guildCreate', guild => {
    if (process.env.DEBUG_MODE) {
        if (guild.id != '659852554754064410') {
            return;
        }
    }

    GuildManager.addGuild(guild.id, true);
});

client.on('guildDelete', guild => {
    if (process.env.DEBUG_MODE) {
        if (guild.id != '659852554754064410') {
            return;
        }
    }

    GuildManager.removeGuild(guild.id);
});

// We have a new message
client.on('message', async message => {
    if (message.author.bot) {
        return;
    }
    
    if (!message.channel.permissionsFor(message.guild.me).has('SEND_MESSAGES', false)) {
        return;
    }

    if (process.env.DEBUG_MODE) {
        if (message.guild.id != '659852554754064410') {
            return;
        }
    }

    let guild = GuildManager.getGuild(message.guild.id);

    if (guild && guild.statistics) {
        EventService.emit('updateStats', message.guild.id, 'message', guild.statistics.message ? guild.statistics.message + 1 : 1);
    }

    // Our client needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    let content = message.content;
    if (content.substring(0, 1) == '!') {
        let parts = _utils.parseLine(content.substr(1));
        let alias = parts[0].toLowerCase();

        parts.shift();

        let response = await CommandHandler.executeCommand(alias, message, parts);

        // If we should print a message
        if (response) {
            MessageService.sendMessage(response, message.channel);
        }
    }
});
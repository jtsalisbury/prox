require('dotenv').config();

let Discord = require('discord.js');
let client = new Discord.Client();

let glob = require('glob');
let path = require('path');
let logger = require('winston');

let CommandHandler = require('./classes/CommandHandlerClass');
let _utils = require('./utils/utils');

global.cbot = new CommandHandler();
glob.sync('./commands/*.js').forEach(file => {
    let required = require(path.resolve(file));
    let commands = null;
    if (typeof required === 'function') {
        // we need to pass the bot as an argument. the function should immediately return the commands
        commands = required(global.cbot);
    } else {
        commands = required.commands;
    }

    // Loop through the commands and register them!
    commands.forEach(cmdData => {
        let cmd = global.cbot.registerCommand(
            cmdData.aliases,
            cmdData.prettyName,
            cmdData.help,
            cmdData.callback
        );

        // Don't forget parameters!
        if (cmdData.params) {
            cmdData.params.forEach(paramData => {
                cmd.addParam(paramData.name, paramData.type);
            });
        }

        // And roles!
        if (cmdData.roles) {
            cmdData.roles.forEach(role => {
                cmd.restrictTo(role);
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

// Log tht we are ready!
client.on('ready', function () {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(client.username + ' - (' + client.id + ')');
});

// We have a new message
client.on('message', async message => {
    // Our client needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    let content = message.content;
    if (content.substring(0, 1) == '!') {
        let parts = _utils.parseLine(content.substr(1));
        let cmd = parts[0].toLowerCase();

        parts.shift();

        // Set the active command and execute the handler
        try {
            global.cbot.setActiveCommand(cmd, message);
            let response = await global.cbot.executeCommand(message, parts);

            // If we should print a message
            if (response) {
                message.channel.send(response);
            }
        } catch (e) {
            // Error handling from all the way to the command scope
            message.channel.send(e.message);
        }
    }
});
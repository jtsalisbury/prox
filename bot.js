require('dotenv').config();
require('module-alias/register');

let express = require('express');
let app = express();

let GithubWebHook = require('express-github-webhook');
let bodyParser = require('body-parser');

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

    // Make sure we get up to date documents on each guild
    let guildPromises = [];
    client.guilds.cache.array().forEach(guild => {
        if (process.env.DEBUG_MODE == 'true') {
            if (guild.id == '659852554754064410') {
                guildPromises.push(GuildManager.addGuild(guild.id));
            }
        } else {
            guildPromises.push(GuildManager.addGuild(guild.id));
        }
    })

    // Once we've got all the data, fire an event
    Promise.all(guildPromises).then((guilds) => {
        EventService.emit('cbot.guildsLoaded', guilds);
    })
});

// Save every five minutes
let guilds = [];

EventService.on('cbot.guildsLoaded', function (loaded) {
    guilds = loaded;
    function saveGuilds() {
        console.log('Saving guilds...');
        guilds.forEach(guild => {
            if (!guild) {
                return;
            }

            guild.save();
        });

        setTimeout(saveGuilds, 300000);
    }
    saveGuilds();
})

// We joined a guild
client.on('guildCreate', async guild => {
    if (process.env.DEBUG_MODE == 'true') {
        if (guild.id != '659852554754064410') {
            return;
        }
    }

    let newGuild = await GuildManager.addGuild(guild.id, true);
    EventService.emit('cbot.guildAdded', newGuild);
    guilds.push(newGuild);
});

// We left a guild
client.on('guildDelete', guild => {
    if (process.env.DEBUG_MODE == 'true') {
        if (guild.id != '659852554754064410') {
            return;
        }
    }

    // Make sure we update any cache systems that may hold the doc
    GuildManager.removeGuild(guild.id)
    EventService.emit('cbot.guildRemoved', guild.id);
    guilds.forEach((guilds, index) => {
        if (guild.guildId == guild.id) {
            guilds.splice(index, 1);
        }
    })
});

// We have a new message
client.on('message', async message => {
    if (message.author.bot) {
        return;
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

        let response = await CommandHandler.executeCommand(alias, message, parts);

        // If we should print a message
        if (response) {
            MessageService.sendMessage(response, message.channel);
        }
    }

    // Record the number of times a user messages
    let guild = GuildManager.getGuild(message.guild.id);
    if (guild) {
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
});

// GitHub webhook handlers
let webhookHandler = GithubWebHook({ path: '/hooks', secret: process.env.GITHUB_SECRET });

app.use(bodyParser.json());
app.use(webhookHandler);

// Status updates
app.get('/', (req, res) => {
    res.send('Server is up!');
});

webhookHandler.on('pull_request', (repo, data) => {
    if (!client) {
        return;
    }

    if (data.action != 'opened') {
        return;
    }

    // Get data for the message
    let user = data.pull_request.user.login;
    let prUrl = data.pull_request.html_url;
    let message = `**GitHub**: A new pull request has been opened by ${user}.\nView here: ${prUrl}`;
    
    // Loop through all guilds and send the message
    client.guilds.cache.array().forEach(guild => {
        let guildState = GuildManager.getGuild(guild.id)

        if (!guildState) {
            return;
        }

        if (guildState.externalMessageChannelId && guildState.externalMessageChannelId.length > 0) {
            MessageService.messageChannelById(message, guild, guildState.externalMessageChannelId);
        }
    })
});

// Start our express server
if (process.env.DEBUG_MODE) {
    let server = app.listen(9000, process.env.DEBUG_IP, () => {
        var host = server.address().address;
        var port = server.address().port;
        
        console.log('Listening at %s:%s', host, port)
    })
} else {
    let server = app.listen(process.env.PORT, () => {
        var host = server.address().address;
        var port = server.address().port;
        
        console.log('Listening at %s:%s', host, port)
    })
}

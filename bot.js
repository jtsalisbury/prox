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

let ws = require('ws');

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
            cmdData.executePermissions,
            cmdData.executeViaIntegration
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

// Helper function to process a message
let processMessage = async function(message, external = false) {
    if (message.author) {
        // Loop through our cache of integrations to sync messages
        // We only do this if we have a valid author (message from discord!)
        integrationCache.forEach(integration => {
            let intNameLen = integration.name.length;
            // If we don't want to sync messages OR the message was from our bot and the integration name matches the prefix
            if (!integration.sync || (message.author.bot && message.content.substr(0, intNameLen + 2) == `[${integration.name}]`)) {
                return;
            }

            // For this channel, if the integration matches, go ahead and send it!
            if (message.channel.id == integration.channelId) {
                for (let socketId in integration.connections) {
                    integration.connections[socketId].emit('message', {
                        sender: message.author.username, 
                        content: message.content 
                    });
                }
            }
        });
    }

    if (message.author && message.author.bot) {
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

        let response = await CommandHandler.executeCommand(alias, message, parts, external);

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

// We have a new message
client.on('message', async message => {
    let response = await processMessage(message);

    if (response) {
        MessageService.sendMessage(response, message.channel);
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
    let message = `**GitHub**: A new pull request has been opened by ${user}.\nView here: <${prUrl}>`;
    
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

// Identify our integrations by hashing their secrets, then syncing them to the guild id they're a part of
let integrationCache = new Map();
EventService.on('cbot.guildsLoaded', guilds => {
    guilds.forEach(guild => {
        guild.integrations.forEach(integration => {
            integrationCache.set(integration.signature, {
                guildId: guild.guildId,
                channelId: integration.channelId, 
                sync: integration.syncMessages,
                name: integration.integrationName,
                connections: {} 
            });
        })
    })
});

// Cache integrations and connections
EventService.on('cbot.integrationAdded', data => {
    if (process.env.DEBUG_MODE) {
        console.log(data.integration.signature);
    }
    integrationCache.set(data.integration.signature, {
        guildId: data.guildId, 
        channelId: data.channelId,
        sync: data.integration.syncMessages,
        name: data.integration.integrationName,
        connections: {} 
    });
});

// For use with validation integrations via HTTP
app.get('/auth', async (req, res) => {
    let token = req.header('X-CBOT-Signature');
    if (!token || !integrationCache.get(token.toLowerCase)) {
        res.status(500).send(JSON.stringify({
            response: "token not set"
        }));
        return 
    }

    res.status(200).send(JSON.stringify({
        response: 'valid authorization'
    }));
});

// Helper which wraps processMessage to handle integrations via HTTP and socket connections
let handleIntegration = async function(token, sender, message) {
    // Verify fields set
    // Note: Content-type: application/json needs set
    if (!sender || !message) {
        return false;
    }

    // Verify authorization 
    if (token.length == 0 || integrationCache.get(token) == undefined) {
        return false;
    }

    // Verify the guild exists
    let guild = GuildManager.getGuild(integrationCache.get(token).guildId);
    if (!guild) {
        return false;
    }

    // Get the integration data
    let intData = integrationCache.get(token);
    if (!intData) {
        return false;
    }

    // Verify discord guild exists
    let discordGuild = client.guilds.cache.array().find(element => element.id == guild.guildId);
    if (!discordGuild) {
        return false;
    }

    // Verify discord channel exists
    let discordChannel = discordGuild.channels.cache.array().find(element => element.id == intData.channelId);
    if (!discordChannel) {
        return false;
    }

    MessageService.sendMessage(`[${intData.name}] **${sender}:** `+ message, discordChannel);

    // Construct a *somewhat* correct message object
    let msgObj = {
        channel: discordChannel,
        guild: discordGuild,
        content: message
    }

    let resMsg = await processMessage(msgObj, true);   

    if (resMsg) {
        MessageService.sendMessage(resMsg, discordChannel);
    }

    return resMsg ? resMsg : "none";
}

// Process messages TO our bot via HTTP
app.post('/message', async (req, res) => {
    let token = req.header('X-CBOT-Signature');

    if (token) {
        token = token.toLowerCase();
    }

    let result = await handleIntegration(token, req.body.sender, req.body.message);
    if (!result) {
        res.status(500).send();
        return;
    }

    res.status(200).send(JSON.stringify({
        response: result
    }));
});

// Socket connections
const server = require("http").createServer(app);
const io = require("socket.io")(server);
require("socketio-auth")(io, {
    authenticate: (socket, data, callback) => {
        let token = data.signature;

        if (token) {
            token = token.toLowerCase();
        }

        console.log("Client authenticating with " + token);

        // Need to verify that the token is valid
        if (!token || integrationCache.get(token) == undefined ) {
            console.log("Client failed to authenticate");
            return callback(new Error('token not valid or guilds not loaded'));
        }

        return callback(null, true);
    },
    postAuthenticate: (socket, data) => {
        // Store the authorization on the socket so we don't have to constantly send it
        socket.authorization = data.signature.toLowerCase();

        // Add our new socket in our integrations cache
        // Since we've already verified the token exists, we can just use it
        let intData = integrationCache.get(socket.authorization);

        intData.connections[socket.id] = socket;

        // Handle when we get a new message from a client
        socket.on("message", async (data) => {
            let result = await handleIntegration(socket.authorization, data.sender, data.content);

            if (!result) {
                socket.emit("response", {
                    success: false, 
                    error: "unable to perform request"
                });
                return;
            }

            socket.emit("response", {
                success: true,
                content: result
            });
        });

        console.log('Socket connection established');
    },
    disconnect: (socket) => {
        if (!socket.authorization) {
            return;
        }

        // Cleanup the cache
        let token = socket.authorization;
        let intData = integrationCache.get(token.toLowerCase());

        if (intData == undefined) {
            return;
        }

        delete intData.connections[socket.id];

        console.log('Socket connection terminated');
    },
    timeout: (process.env.DEBUG_MODE ? 'none' : 1000)
})

server.listen(process.env.PORT);
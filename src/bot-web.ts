import express from 'express';
import cors from 'cors';
let app = express();
app.use(cors());
app.options('*', cors())

import GithubWebHook from 'express-github-webhook';
import bodyParser from 'body-parser';

import GuildManager from './models/GuildManager';
import IntegrationManager from './models/IntegrationManager';
import { messageChannelById, sendMessage, processMessage } from './services/message';
import CommandHandler from './models/CommandHandler';
import { addMinecraftEmoji } from './services/utils';

import logger from './services/logger';

import server from 'http'
import { GuildEmojiManager, Message, MessageEmbed, TextChannel } from 'discord.js';

// We need to initialize this after our client has been initiated
export default function initializeWeb(client) {
    // Process messages TO our bot via HTTP
    app.post('/message', async (req, res) => {
        logger.info('HTTP message received');
        logger.info(req);
        let token = req.header('X-PROX-Signature');

        if (token) {
            token = token.toLowerCase();
        }

        // Try and process the command
        let result = await handleIntegration(token, req.body.sender, req.body.message, req.body);
        if (!result) {
            res.status(500).send();
            return;
        }

        // Successfully handled!
        res.status(200).send(JSON.stringify({
            response: result
        }));
    });

    // Returns a JSON structure of all available commands
    app.get('/help', async (req, res) => {
        let commands = CommandHandler.getCommands();

        let results = [];
        commands.forEach((cmdObj) => {
            results.push({
                prettyName: cmdObj.getName(),
                help: cmdObj.getHelp(),
                category: cmdObj.getCategory(),
                aliases: cmdObj.getAliases(),
                params: cmdObj.getParams(),
                userPermissions: cmdObj.getUserPermissions(),
                botPermissions: cmdObj.getExecPermissions(),
                canExecuteExternally: cmdObj.getExternal()
            });
        });

        res.status(200).send(JSON.stringify(results));
    });

    // For use with validation integrations via HTTP
    app.get('/auth', async (req, res) => {
        let token = req.header('X-PROX-Signature');
        if (!token || !IntegrationManager.getIntegration(token.toLowerCase)) {
            logger.info("Token not set")
            res.status(500).send(JSON.stringify({
                response: 'token not set'
            }));
            return 
        }
            
        logger.info("Authorization confirmed")
        res.status(200).send(JSON.stringify({
            response: 'valid authorization'
        }));
    });

    // GitHub webhook handlers
    let webhookHandler: any = GithubWebHook({ path: '/hooks', secret: process.env.GITHUB_SECRET });

    app.use(bodyParser.json());
    app.use(webhookHandler);

    // Status updates
    app.get('/', (req, res) => {
        res.send('Prox is up!');
    });

    // When GitHub sends a pull request
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

        logger.info(message);
        
        // Loop through all guilds and send the message
        client.guilds.cache.array().forEach(guild => {
            let guildState = GuildManager.getGuild(guild.id)

            if (!guildState) {
                return;
            }

            if (guildState.externalMessageChannelId && guildState.externalMessageChannelId.length > 0) {
                messageChannelById(message, guild, guildState.externalMessageChannelId);
            }
        })
    });

    // Helper which wraps processMessage to handle integrations via HTTP and socket connections
    let handleIntegration = async function(token, sender, message, extraData) {
        // Verify fields set
        // Note: Content-type: application/json needs set
        if (!sender || !message) {
            return false;
        }

        // Verify authorization 
        if (token.length == 0 || IntegrationManager.getIntegration(token) == undefined) {
            return false;
        }

        // Verify the guild exists
        let guild = GuildManager.getGuild(IntegrationManager.getIntegration(token).guildId);
        if (!guild) {
            return false;
        }

        // Get the integration data
        let intData = IntegrationManager.getIntegration(token);
        if (!intData) {
            return false;
        }

        // Verify discord guild exists
        let discordGuild = client.guilds.cache.array().find(element => element.id == guild.guildId);
        if (!discordGuild) {
            return false;
        }

        // Verify discord channel exists
        let discordChannel: TextChannel = discordGuild.channels.cache.array().find(element => element.id == intData.channelId);
        if (!discordChannel) {
            return false;
        }

        let content = `[${intData.name}] **${sender}:** `+ message;
  
        // currently support only for minecraft
        if (extraData.emoji && extraData.emoji == 'minecraft') {
            let emojiName = intData.name + '_' + sender;
            let found = discordChannel.guild.emojis.cache?.find(e => e.name == emojiName);

            if (!found) {
                found = await addMinecraftEmoji(discordChannel.guild.emojis, emojiName, sender);
            }

            content = `[${intData.name}] ${found} **${sender}:** `+ message;
        }

        const embed = new MessageEmbed();
        embed.setDescription(content);

        if (extraData.color) {
            embed.setColor(extraData.color);
        }

        logger.info(content);
        logger.info(extraData);

        sendMessage(content, discordChannel);
                
        // Construct a *somewhat* correct message object
        let msgObj = <Message>{
            channel: discordChannel,
            guild: discordGuild,
            content: message
        }

        let resMsg = await processMessage(msgObj, true);   

        if (resMsg) {
            sendMessage(resMsg, discordChannel);
        }

        return resMsg ? resMsg : 'none';
    }

    // Socket connections
    let serv = server.createServer(app);
    let io = require('socket.io')(serv);

    io.on('connection', (socket) => {
        logger.info('New socket connected');

        socket.on('authentication', (obj) => {
            logger.info('Attempting auth');

            let token = obj.signature;

            if (token) {
                token = token.toLowerCase();
            }

            logger.info('Client authenticating with ' + token);

            // Need to verify that the token is valid
            if (!token || IntegrationManager.getIntegration(token) == undefined ) {
                logger.info('Client failed to authenticate');

                socket.emit('unauthorized', 'Incorrect token or integration not setup');
                return;
            }

            socket.authorization = token;

            // Add our new socket in our integrations cache
            // Since we've already verified the token exists, we can just use it
            let intData = IntegrationManager.getIntegration(socket.authorization);

            intData.connections[socket.id] = socket;

            // Handle when we get a new message from a client
            socket.on('message', async (data) => {
                let result = await handleIntegration(socket.authorization, data.sender, data.content, data);

                if (!result) {
                    socket.emit('response', {
                        success: false, 
                        error: 'unable to perform request'
                    });
                    return;
                }

                socket.emit('response', {
                    success: true,
                    content: result
                });
            });

            socket.emit('authenticated')
            logger.info('Socket connection established');
        })

        socket.on('disconnect', (socket) => {
            if (!socket.authorization) {
                return;
            }

            // Cleanup the cache on disconnect
            let token = socket.authorization;
            let intData = IntegrationManager.getIntegration(token.toLowerCase());

            if (intData == undefined) {
                return;
            }

            delete intData.connections[socket.id];

            logger.info('Socket connection terminated');
        })
    })

    serv.listen(process.env.PORT);
    logger.info('Listening on port ' + process.env.PORT);
}
module.exports = function(client) {
    let express = require('express');
    let app = express();

    let GithubWebHook = require('express-github-webhook');
    let bodyParser = require('body-parser');

    let GuildManager = require('@models/GuildManager');
    let IntegrationManager = require('@models/IntegrationManager');
    let MessageService = require('@services/message');
    let CommandHandler = require('@models/CommandHandler');

    let logger = require('winston');

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

    app.get('/help', async (req, res) => {
        let commands = CommandHandler.getCommands();

        let results = [];
        commands.forEach((cmdObj) => {
            results.push({
                prettyName: cmdObj.getName(),
                help: cmdObj.getHelp(),
                aliases: cmdObj.getAliases(),
                params: cmdObj.getParams(),
                userPermissions: cmdObj.getUserPermissions(),
                botPermissions: cmdObj.getExecPermissions(),
                canExecuteExternally: cmdObj.getExternal()
            });
        });

        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

        res.status(200).send(JSON.stringify(results));
    });

    // For use with validation integrations via HTTP
    app.get('/auth', async (req, res) => {
        let token = req.header('X-CBOT-Signature');
        if (!token || !IntegrationManager.getIntegration(token.toLowerCase)) {
            res.status(500).send(JSON.stringify({
                response: 'token not set'
            }));
            return 
        }

        res.status(200).send(JSON.stringify({
            response: 'valid authorization'
        }));
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

    // Helper which wraps processMessage to handle integrations via HTTP and socket connections
    let handleIntegration = async function(token, sender, message) {
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

        let resMsg = await MessageService.process(msgObj, true);   

        if (resMsg) {
            MessageService.sendMessage(resMsg, discordChannel);
        }

        return resMsg ? resMsg : 'none';
    }

    // Socket connections
    const server = require('http').createServer(app);
    const io = require('socket.io')(server);
    require('socketio-auth')(io, {
        authenticate: (socket, data, callback) => {
            let token = data.signature;

            if (token) {
                token = token.toLowerCase();
            }

            logger.info('Client authenticating with ' + token);

            // Need to verify that the token is valid
            if (!token || IntegrationManager.getIntegration(token) == undefined ) {
                logger.info('Client failed to authenticate');
                return callback(new Error('token not valid or guilds not loaded'));
            }

            return callback(null, true);
        },
        postAuthenticate: (socket, data) => {
            // Store the authorization on the socket so we don't have to constantly send it
            socket.authorization = data.signature.toLowerCase();

            // Add our new socket in our integrations cache
            // Since we've already verified the token exists, we can just use it
            let intData = IntegrationManager.getIntegration(socket.authorization);

            intData.connections[socket.id] = socket;

            // Handle when we get a new message from a client
            socket.on('message', async (data) => {
                let result = await handleIntegration(socket.authorization, data.sender, data.content);

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

            console.log('Socket connection established');
        },
        disconnect: (socket) => {
            if (!socket.authorization) {
                return;
            }

            // Cleanup the cache
            let token = socket.authorization;
            let intData = IntegrationManager.getIntegration(token.toLowerCase());

            if (intData == undefined) {
                return;
            }

            delete intData.connections[socket.id];

            console.log('Socket connection terminated');
        },
        timeout: (process.env.DEBUG_MODE ? 'none' : 1000)
    })

    server.listen(process.env.PORT);
}
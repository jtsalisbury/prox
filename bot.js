let Discord = require('discord.io');
let logger = require('winston');

require('dotenv').config();

let CommandHandler = require('./classes/CommandHandlerClass');
let _utils = require('./utils/utils');

logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Register a new bot
let bot = new Discord.Client({
   token: process.env.DISCORD_TOKEN,
   autorun: true
});

// Log tht we are ready!
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});

// We have a new message
bot.on('message', async function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
        let parts = _utils.parseLine(message.substr(1));
        let cmd = parts[0].toLowerCase();

        parts.shift();

        // Set the active command and execute the handler
        try {
            cbot.setActiveCommand(cmd);
            let response = await cbot.executeCommand(userID, parts);

            // If we should print a message
            if (response) {
                bot.sendMessage({
                    to: channelID,
                    message: response
                });
            }
            
        } catch (e) {
            // Error handling from all the way to the command scope
            bot.sendMessage({
                to: channelID,
                message: e.message
            });
        }
    }
});

// Create a new handler
let cbot = new CommandHandler();

// Begin registering commands
cbot.registerCommand("ping", 'Ping', 'Yo', function() {
    let that = "test";

    return "Pong!";
});

cbot.registerCommand("kys", 'Kill Yourself', 'OOf', function() {
    return ":cry: :gun:";
});

cbot.registerCommand('gimme', 'Gimme', 'Gimme a random meme', async function() {
    let res = await _utils.HTTPGet('https://meme-api.herokuapp.com/gimme', {});

    return `${res.title}\n${res.url}`;
});

let codes = ["ar", "bg", "zhCN", "zhTW", "hr", "cs", "da", "nl", "en", "et", "tl", "fi", "fr", "de", "el", "iw", "hi", "hu", "is", "id", "ga", "it", "ja", "ko", "la", "lv", "lt", "mk", "mt", "no", "fa", "pl", "pt", "ro", "ru", "sr", "sk", "si", "es", "sv", "th", "tr", "vi"];
cbot.registerCommand("translate", "Translate", `Translate using keys from one lang to another\nCodes can be one of ${codes.join()}` , async function(msg, src, dest, text) {
	if (codes.indexOf(src) === -1 || codes.indexOf(dest) === -1) {
        return;
    }

    let url = "https://frengly.com/frengly/data/translateREST";
    let payload = {
        src: src,
        dest: dest,
        text: text,
        email: process.env.TRANSLATE_EMAIL,
        password: process.env.TRANSLATE_PASSWORD
    }

    let response = await _utils.HTTPPost(url, payload);

    let translation = response.translation;

    return `"${text}" translated to ${dest} is "${translation}"`;
}).addParam('translate from', 'string').addParam('translate to', 'string').addParam('text', 'string');

cbot.registerCommand('define', 'Define', 'Defines a term or string provided', async function(user, term) {
    let url = `http://api.urbandictionary.com/v0/define?term=${term}`;

    let result = await _utils.HTTPGet(url);
    let def = result['list'][0];

    if (!def) {
        return 'No definition found :&(';
    } else {
        return `Definition: ${def['definition']} \nExample: ${def['example']}`
    }
}).addParam('term', 'string');

cbot.registerCommand('search', 'Search', 'Searches Google for the first result and returns the link', async function(user, term) {
    let getUrl = `https://contextualwebsearch-websearch-v1.p.rapidapi.com/api/Search/WebSearchAPI?autoCorrect=true&pageNumber=1&pageSize=10&q=${term}&safeSearch=false`
    let headers = {
        "x-rapidapi-host": "contextualwebsearch-websearch-v1.p.rapidapi.com",
	    "x-rapidapi-key": process.env.SEARCH_APIKEY
    }
    let result = await _utils.HTTPGet(getUrl, headers);

    if (!result) {
        return 'No results found :&(';
    }

	return `We found ${result.totalCount} results. The first one was ${result.value[0].url}`;
}).addParam('term', 'string');

let constructParamHelp = function(cmdObj) {
    let helpStr = "";
    
    cmdObj.getParams().forEach(param => {
        helpStr += `<${param.name} (${param.type})> `;
    });

    return helpStr;
};
cbot.registerCommand('help', 'Help', 'Prints a list of the commands and their purpose', function(user) {
    let commands = cbot.getCommands();

    // Generate a help string with the alias, help and param string
    let helpStr = "A list of available commands can be found below.\nTo view parameters for a command, type !help <command alias>\n\n";
    for (let cmdAlias in commands) {
        let cmdObj = commands[cmdAlias];
        let paramHelp = constructParamHelp(cmdObj);

        helpStr += `${cmdObj.getName()}: ${cmdObj.getHelp()}\nCalled with: !${cmdAlias} ${paramHelp}\n\n`;
    }

    // Send a PM to the user
    bot.sendMessage({
        to: user,
        message: helpStr
    });
});

cbot.registerCommand('cmdhelp', 'CMD Help', 'Prints detailed information about a command', function(user, command) {
    let helpStr = "A list of available commands can be found below.\n\n";
    
    if (!cbot.isValidCommand(command)) {
        return 'No command found with that alias :&(';
    }

    // Generate the help string for this single command
    let cmdObj = cbot.getCommand(command);
    let paramHelp = constructParamHelp(cmdObj);

    helpStr += `${cmdObj.getName()}: ${cmdObj.getHelp()}\nCalled with: !${command} ${paramHelp}\n\n`;
    
    // Send a PM to the user
    bot.sendMessage({
        to: user,
        message: helpStr
    });
}).addParam('command', 'string')

/*
let voteInfo = {};
cbot.registerCommand('createVote', 'Create Vote', 'Create a new vote', function(user, title, options) {

}).addParam('title', 'string').addParam('options', 'string');

cbot.registerCommand('endVote', 'End Vote', 'Ends a vote', function(user) {

}).addParam('voteId', 'number');

cbot.registerCommand('endAllVotes', 'End All Vote', 'Ends all active votes', function(user) {

});

cbot.registerCommand('vote', 'Vote', 'Cast a ballot in an active vote!', function(user, option) {

}).addParam('voteId', 'number').addParam('option', 'string');*/
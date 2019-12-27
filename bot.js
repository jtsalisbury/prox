let Discord = require('discord.js');
let bot = new Discord.Client();
let logger = require('winston');

let {evaluate} = require('mathjs');

require('dotenv').config();

let CommandHandler = require('./classes/CommandHandlerClass');
let _utils = require('./utils/utils');

const ROLES = {
    ADMIN: 'Administrator',
    MOD: 'Moderator'
}

logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Register a new bot
bot.login(process.env.DISCORD_TOKEN);

// Log tht we are ready!
bot.on('ready', function () {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});

// We have a new message
bot.on('message', async message => {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    let content = message.content;
    if (content.substring(0, 1) == '!') {
        let parts = _utils.parseLine(content.substr(1));
        let cmd = parts[0].toLowerCase();

        parts.shift();

        // Set the active command and execute the handler
        try {
            cbot.setActiveCommand(cmd, message);
            let response = await cbot.executeCommand(message, parts);

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

// Create a new handler
let cbot = new CommandHandler();

// Begin registering commands
cbot.registerCommand("ping", 'Ping', 'Yo', function() {
    return "Pong!";
});

cbot.registerCommand("kys", 'Kill Yourself', 'OOf', function() {
    return ":cry: :gun:";
});

cbot.registerCommand('say', 'Say', 'Make the bot say something!', function(message, term) {
    message.channel.bulkDelete([message]);

    if (term.indexOf('!') > -1) {
        throw new Error('You can\'t send a message to call another command!');
    }

    return term;
}).addParam('term', 'string');

cbot.registerCommand('gimme', 'Gimme', 'Gimme a random meme', async function() {
    let res = await _utils.HTTPGet('https://meme-api.herokuapp.com/gimme', {});

    return `${res.title}\n${res.url}`;
});

cbot.registerCommand(['calculate', 'calc'], 'Calculate', 'Evaluate a math expression', function(message, expression) {
    let result = evaluate(expression);

    return expression + ' = ' + result;
}).addParam('expression', 'string');

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

cbot.registerCommand('define', 'Define', 'Defines a term or string provided', async function(message, term) {
    let url = `http://api.urbandictionary.com/v0/define?term=${term}`;
    let result = await _utils.HTTPGet(url);
    let def = result['list'][0];

    if (!def) {
        return 'No definition found :&(';
    } else {
        return `Definition: ${def['definition']} \nExample: ${def['example']}`
    }
}).addParam('term', 'string');

cbot.registerCommand('search', 'Search', 'Searches Google for the first result and returns the link', async function(message, term) {
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
cbot.registerCommand('help', 'Help', 'Prints a list of the commands and their purpose', function(message) {
    let commands = cbot.getCommands();

    // Generate a help string with the alias, help and param string
    let helpStr = "A list of available commands can be found below.\nTo view parameters for a command, type !help <command alias>\n\n";
    for (let cmdAlias in commands) {
        let cmdObj = commands[cmdAlias];
        let paramHelp = constructParamHelp(cmdObj);

        helpStr += `${cmdObj.getName()}: ${cmdObj.getHelp()}\nCalled with: !${cmdAlias} ${paramHelp}\n`;
        
        let restrictions = cmdObj.getRestricted();
        if (restrictions.length > 0) {
            helpStr += 'Restricted to: ' + restrictions.join(', ') + '\n';
        }

        helpStr += '\n';
    }

    // Send a PM to the user
    message.member.send(helpStr);
});

cbot.registerCommand('cmdhelp', 'CMD Help', 'Prints detailed information about a command', function(message, command) {
    let helpStr = "A list of available commands can be found below.\n\n";
    
    if (!cbot.isValidCommand(command)) {
        return 'No command found with that alias :&(';
    }

    // Generate the help string for this single command
    let cmdObj = cbot.getCommand(command);
    let paramHelp = constructParamHelp(cmdObj);

    helpStr += `${cmdObj.getName()}: ${cmdObj.getHelp()}\nCalled with: !${command} ${paramHelp}\n`;
    let restrictions = cmdObj.getRestricted();
    if (restrictions.length > 0) {
        helpStr += 'Restricted to: ' + restrictions.join(', ') + '\n';
    }
    helpStr += '\n';
    
    // Send a PM to the user
    message.member.send(helpStr);
}).addParam('command', 'string')

// TODO: Test this
cbot.registerCommand('kick', 'Kick', 'Kick a user', async function(message, target, reason) {
    let member = message.mentions.members.first() || message.guild.members.get(target);
    if (!member) {
        throw new Error('Not a valid member!');
    }
    if (!member.kickable) {
        throw new Error('This user can\'t be kicked :&(');
    }

    await member.kick(reason);

    return `${member.user.tag} has been kicked by ${message.author.tag} because: ${reason}`; 
}).addParam('target', 'string').addParam('reason', 'string').restrictTo(ROLES.ADMIN).restrictTo(ROLES.MOD);

cbot.registerCommand('purge', 'Purge', 'Removes the last (up to) 100 messages', async function(message, count) {
    if (count < 2 || count > 100) {
        throw new Error('Please provide a number between 2 and 100');
    }

    let messages = await message.channel.fetchMessages({limit: count});
    message.channel.bulkDelete(messages);
}).addParam('count', 'number').restrictTo(ROLES.ADMIN).restrictTo(ROLES.MOD);

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
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

let bot = new Discord.Client({
   token: process.env.DISCORD_TOKEN,
   autorun: true
});

bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});

bot.on('message', async function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
        let parts = _utils.parseLine(message.substr(1));
        let cmd = parts[0];

        parts.shift();
        
        let hasBeenActivated = cbot.setActiveCommand(cmd);
        if (hasBeenActivated) {
            try {
                let response = await cbot.executeCommand(parts);

                if (response) {
                    bot.sendMessage({
                        to: channelID,
                        message: response
                    });
                }
            } catch (e) {
                bot.sendMessage({
                    to: channelID,
                    message: e.message
                });
            }
        }
     }
});

let cbot = new CommandHandler();

cbot.registerCommand("ping", 'Ping', 'Yo', function(args) {
    let that = "test";

    return "Pong!";
});

cbot.registerCommand("kys", 'Kill Yourself', 'OOf', function(args) {
    return ":cry: :gun:";
});

let codes = ["ar", "bg", "zhCN", "zhTW", "hr", "cs", "da", "nl", "en", "et", "tl", "fi", "fr", "de", "el", "iw", "hi", "hu", "is", "id", "ga", "it", "ja", "ko", "la", "lv", "lt", "mk", "mt", "no", "fa", "pl", "pt", "ro", "ru", "sr", "sk", "si", "es", "sv", "th", "tr", "vi"];
cbot.registerCommand("translate", "Translate", "Translate using keys from one lang to another" , async function(src, dest, text) {
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

cbot.registerCommand('define', 'Define', 'Defines a term or string provided', async function(term) {
    let url = `http://api.urbandictionary.com/v0/define?term=${term}`;

    let result = await _utils.HTTPGet(url);
    let def = result['list'][0];

    if (!def) {
        return 'No definition found :&(';
    } else {
        return `Definition: ${def['definition']} \nExample: ${def['example']}`
    }
}).addParam('term', 'string');

cbot.registerCommand('search', 'Search', 'Searches Google for the first result and returns the link', async function(term) {
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
import * as _utils from '../services/utils';
import minecraft from 'minecraft-server-util';
import logger from '../services/logger';
import { IBaseCommand } from '../models/IBase';
import { Message, TextChannel } from 'discord.js';

let ping = <IBaseCommand>{};
ping.aliases = ['ping'];
ping.prettyName = 'Ping';
ping.help = 'Pings Prox';
ping.category = 'Misc';
ping.executeViaIntegration = true;
ping.callback = async function() {
    return 'Pong!';
};

let git = <IBaseCommand>{};
git.aliases = ['git'];
git.prettyName = 'GitHub';
git.help = 'View this on GitHub';
git.category = 'Misc';
git.executeViaIntegration = true;
git.callback = async function() {
    return 'Interested in contributing? Find the project at https://github.com/jtsalisbury/prox';
};

let gimme = <IBaseCommand>{};
gimme.aliases = ['gimme'];
gimme.prettyName = 'Gimme';
gimme.help = 'Gimme a random meme';
gimme.category = 'Misc';
gimme.executeViaIntegration = true;
gimme.callback = async function() {
    let res: any = await _utils.HTTPGet('https://meme-api.herokuapp.com/gimme', {});

    return `${res.title}\n${res.url}`;
};

let say = <IBaseCommand>{};
say.aliases = ['say'];
say.prettyName = 'Say';
say.help = 'Make the bot say something!';
say.category = 'Misc';
say.executeViaIntegration = true;
say.params = [
    {
        name: 'string',
        type: 'string'
    }
];
say.callback = async function(message: Message, string: string) {
    let channel = <TextChannel>message.channel;
    channel.bulkDelete([message]);

    if (string.indexOf('!') > -1) {
        return 'You can\'t send a message to call another command!';
    }

    return string;
}

let insult = <IBaseCommand>{};
insult.aliases = ['insult'];
insult.prettyName = 'Insult';
insult.help = 'Generate an insult';
insult.category = 'Misc';
insult.executeViaIntegration = false;
insult.params = [
    {
        name: 'user',
        type: 'string',
        optional: true
    }
];
insult.callback = async function(message: Message, user?: string) {
    // Grab insult
    let res: any = await _utils.HTTPGet('https://insult.mattbas.org/api/insult');

    // Determine if a user was passed
    if (message.mentions.users.size > 0) {
        let id = message.mentions.users.values().next().value.id;

        res = '<@' + id + '>, ' + res.charAt(0).toLowerCase() + res.substring(1);
    } else if (user) {
        res = user + ', ' + res.charAt(0).toLowerCase() + res.substring(1);
    }

    return res;
}

let compliment = <IBaseCommand>{};
compliment.aliases = ['compliment'];
compliment.prettyName = 'Compliment';
compliment.help = 'Generate a compliment';
compliment.category = 'Misc';
compliment.executeViaIntegration = false;
compliment.params = [];
compliment.callback = async function(message: Message) {
    // Grab compliment
    let res: any = await _utils.HTTPGet('https://complimentr.com/api');

    if (!res.compliment) {
        return;
    }

    return res.compliment.substr(0, 1).toUpperCase() + res.compliment.substr(1);
}


let trump = <IBaseCommand>{};
trump.aliases = ['trump'];
trump.prettyName = 'Trump';
trump.help = 'Gets a random Trump quote';
trump.category = 'Misc';
trump.executeViaIntegration = false;;
trump.callback = async function(message: Message) {
    let res: any = await _utils.HTTPGet('https://api.whatdoestrumpthink.com/api/v1/quotes/random');

    if (!res || !res.message) {
        return 'No quotes found';
    }

    return `**Donald Trump:** ${res.message}`;
}

let summit = <IBaseCommand>{};
summit.aliases = ['summit'];
summit.prettyName = 'summit';
summit.help = 'Ping summit.nhacks.dev';
summit.category = 'Misc';
summit.executeViaIntegration = false;;
summit.callback = async function(message: Message) {
    try {
        let result = await minecraft.status('summit.nhacks.dev', { port: 25585 });

        if (result && result.onlinePlayers != null) {
            return 'Summit is up!';
        }
    } catch (e) {
        logger.error(e);
    }

    return 'Summit is down!';
}

export let commands = [ping, git, gimme, say, insult, compliment, trump, summit];
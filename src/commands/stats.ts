import EventEmitter from '../services/events';
import * as _utils from '../services/utils';
import GuildManager from '../models/GuildManager';
import { IBaseCommand } from '../models/IBase';
import { Message } from 'discord.js';

let getStat = <IBaseCommand>{};
getStat.aliases = ['stat', 'stats'];
getStat.prettyName = 'Get Stats';
getStat.help = 'Gets the requested highest stats for (messages, usage, artists, songs, married, fucked, killed)';
getStat.params = [{
    name: 'statistic',
    type: 'string'
}]
getStat.executeViaIntegration = true;
getStat.callback = async function (message: Message, stat: string) {
    stat = stat.toLowerCase();

    if (!['messages', 'usage', 'artists', 'songs', 'married', 'fucked', 'killed'].includes(stat)) {
        return 'Invalid statistic';
    }

    let guild = GuildManager.getGuild(message.guild.id);
    if (!guild.statistics) {
        return 'Nothing has been tracked for that yet';
    }

    let path = guild.statistics;
    if (stat == 'artists' || stat == 'songs') {
        path = path.music;
    }

    if (stat == 'married' || stat == 'fucked' || stat == 'killed') {
        path = path.mfk;
    }

    let allStats = [];
    if (!path || !path[stat]) {
        return 'Nothing has been tracked for that yet';
    }

    Object.entries(path[stat]).forEach(entry => {
        allStats.push({item: entry[0], count: entry[1]});
    })

    let top5 = allStats.sort((a, b) => {
        return b.count - a.count;
    }).slice(0, 5);

    top5 = top5.map((data) => {
        let combined = '';
        if (['messages', 'married', 'fucked', 'killed'].includes(stat)) {
            combined += `<@${data.item}>`
        } else {
            combined += data.item;
        }

        return combined + ' with **' + data.count + '**';
    })

    return `The top 5 for ${stat} are: ${top5.join(', ')}`;
}

EventEmitter.on('updateStats', (guildId, statName, itemValue) => {
    let guild = GuildManager.getGuild(guildId);
    guild.statistics[statName] = _utils.resolve(guild, statName, itemValue);
    guild.markModified('statistics');
});

export let commands = [getStat];
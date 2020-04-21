let EventEmitter = require('@services/events');
let _utils = require('@services/utils');
let GuildManager = require('@models/GuildManager');

let getStat = {};
getStat.aliases = ['stat', 'stats'];
getStat.prettyName = 'Get Stats';
getStat.help = 'Gets the requested highest stats for (messages, usage, artists, songs)';
getStat.params = [{
    name: 'statistic',
    type: 'string'
}]
getStat.callback = function (message, stat) {
    stat = stat.toLowerCase();

    if (!['messages', 'usage', 'artists', 'songs'].includes(stat)) {
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
        if (stat == 'messages') {
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

module.exports.commands = [getStat];
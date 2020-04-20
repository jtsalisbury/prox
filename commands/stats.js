let EventEmitter = require('@services/events');
let _utils = require('@services/utils');
let GuildManager = require('@models/GuildManager');

let getStat = {};
getStat.aliases = ['stats'];
getStat.prettyName = 'Get Stats';
getStat.help = 'Gets the requested stats';
getStat.callback = function (message) {

}

EventEmitter.on('updateStats', (guildId, statName, itemValue) => {
    let guild = GuildManager.getGuild(guildId);
    guild.statistics[statName] = _utils.resolve(guild, statName, itemValue);
    guild.markModified('statistics');
    guild.save();
});

module.exports.commands = [getStat];
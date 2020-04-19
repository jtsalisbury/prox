let EventEmitter = require('@services/events');
let GuildManager = require('@models/GuildManager');

let getStat = {};
getStat.aliases = ['stats'];
getStat.prettyName = 'Get Stats';
getStat.help = 'Gets the requested stats';
getStat.callback = function(message) {

}

EventEmitter.on('updateStats', (guildId, statName, itemValue) => {
    let guild = GuildManager.getGuild(guildId);
    guild.statistics[statName] = itemValue;
    guild.markModified('statistics');
    guild.save();
});

module.exports.commands = [getStat];
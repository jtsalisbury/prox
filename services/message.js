module.exports = {};

module.exports.sendMessage = function(string, target) {
    return target.send(string, { split: true });
}

module.exports.messageChannelById = function(string, guild, id) {
    let ch = guild.channels.cache.get(id);

    if (ch) {
        ch.send(string, { split: true });
    }
}
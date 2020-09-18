let member = {};
member.name = 'member';
member.convert = function(value, member) {
    if (!value) return;

    if (value.startsWith('<@') && value.endsWith('>')) {
        value = value.slice(2, -1);

        if (value.startsWith('!')) {
            value = value.slice(1);
        }

        return members.cache.get(value);
    }
}

module.exports.params = [member];
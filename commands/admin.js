let ROLES = require('../utils/utils').getRoles();

let kick = {};
kick.aliases = ['kick'];
kick.prettyName = 'Kick';
kick.help = 'Kick a user';
kick.params = [
    {
        name: 'target',
        type: 'string'
    },
    {
        name: 'reason',
        type: 'string'
    }
];
kick.roles = [ROLES.ADMIN, ROLES.MOD];
kick.callback = async function(message, target, reason) {
    let member = message.mentions.members.first() || message.guild.members.get(target);
    if (!member) {
        return 'Not a valid member';
    }
    if (!member.kickable) {
        return 'This user can\'t be kicked';
    }

    await member.kick(reason);

    return `${member.user.tag} has been kicked by ${message.author.tag} because: ${reason}`; 
}

let purge = {};
purge.aliases = ['purge'];
purge.prettyName = 'Purge';
purge.help = 'Remove the last (up to) 100 messages';
purge.params = [
    {
        name: 'count',
        type: 'number'
    }
];
purge.roles = [ROLES.ADMIN, ROLES.MOD];
purge.callback = async function(message, count) {
    if (count < 2 || count > 100) {
        return 'Please provide a number between 2 and 100';
    }

    let messages = await message.channel.fetchMessages({limit: count});
    message.channel.bulkDelete(messages);
}

module.exports.commands = [kick, purge];
let ROLES = require('@services/utils').getRoles();
let GuildManager = require('@models/GuildManager');

let defaultMessage = {};
defaultMessage.aliases = ['setext'];
defaultMessage.prettyName = 'Set External Message Channel';
defaultMessage.help = 'Sets the default message channel for external messages';
defaultMessage.userPermissions = ['MANAGE_GUILD'];
defaultMessage.executeViaIntegration = false;
defaultMessage.callback = async function(message) {
    let guild = await GuildManager.getGuild(message.guild.id);

    if (guild) {
        guild.externalMessageChannelId = message.channel.id;

        return 'Successfully updated external message channel';
    }

    return 'The guild manager could not find the guild';
}

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
        type: 'string',
        optional: true,
        default: 'No reason provided'
    }
];
kick.userPermissions = ['KICK_MEMBERS'];
kick.executePermissions = ['KICK_MEMBERS'];
kick.executeViaIntegration = false;
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
        type: 'number',
        optional: true,
        default: 2
    }
];
purge.userPermissions = ['MANAGE_MESSAGES'];
purge.executePermissions = ['MANAGE_MESSAGES'];
purge.executeViaIntegration = false;
purge.callback = async function(message, count) {
    if (count < 2 || count > 100) {
        return 'Please provide a number between 2 and 100';
    }

    let messages = await message.channel.fetchMessages({limit: count});
    message.channel.bulkDelete(messages);
}

module.exports.commands = [defaultMessage, kick, purge];
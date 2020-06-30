let MessageService = require('@services/message');
let GuildManager = require('@models/GuildManager');
let EventService = require('@services/events');

let crypto = require('crypto');

// Create a hash service

let add = {};
add.aliases = ['addint'];
add.prettyName = 'Add Integration';
add.executeViaIntegration = false;
add.help = 'Adds an integration';
add.userPermissions = ['MANAGE_GUILD'];
add.params = [
    {
        name: 'sync messages',
        type: 'boolean',
        optional: true,
        default: false
    },
    {
        name: 'sync IP',
        type: 'string',
        optional: true
    },
    {
        name: 'sync Port',
        type: 'number',
        optional: true
    }
];
add.callback = async function(message, sync, ip, port) {
    if (sync && (!ip || ip.length == 0)) {
        return "Sync requires a full IP and Port";
    }

    if (!sync) {
        sync = false;
        ip = "";
        port = -1;
    }

    let guild = await GuildManager.getGuild(message.guild.id);
    let randomString = Math.random().toString(36).slice(-8);

    let shasum = crypto.createHash('sha1')
    shasum.update(randomString);
    let signature = shasum.digest('hex');

    if (guild) {
        guild.integrations.push({
            integrationId: guild.integrations.length + 1,
            channelId: message.channel.id,
            signature: signature,
            syncMessages: sync,
            syncIP: ip,
            syncPort: port
        });

        MessageService.sendMessage(`We've added your integration. Please use this secret (sha1 hash, hex digest) in your X-CBOT-Signature header.\nSecret: ${randomString}\n**Please delete this message once you have saved your secret.**`, message.author);

        EventService.emit('cbot.integrationAdded', {integration: guild.integrations[guild.integrations.length -  1], guildId: guild.guildId});

        return 'Successfully added an integration with id = ' + guild.integrations.length;
    }

    return 'The guild manager could not find the guild';
}

module.exports.commands = [add];

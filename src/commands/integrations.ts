import GuildManager from '../models/GuildManager';
import IntegrationManager from '../models/IntegrationManager';
import MessageService from '../services/message';

import crypto from 'crypto';
import { IBaseCommand } from '../models/IBase';
import { Message } from 'discord.js';

let add = <IBaseCommand>{};
add.aliases = ['addint'];
add.prettyName = 'Add Integration';
add.executeViaIntegration = false;
add.help = 'Adds an integration';
add.userPermissions = ['MANAGE_GUILD'];
add.params = [
    {
        name: 'integration name',
        type: 'string'
    },
    {
        name: 'sync messages',
        type: 'bool',
        optional: true,
        default: false
    },
];
add.callback = async function(message: Message, name: string, sync?: boolean) {
    let guild = await GuildManager.getGuild(message.guild.id);
    let randomString = Math.random().toString(36).slice(-8);

    let shasum = crypto.createHash('sha1')
    shasum.update(randomString);
    let signature = shasum.digest('hex');

    if (guild) {
        let intData = {
            integrationId: guild.integrations.length + 1,
            integrationName: name,
            channelId: message.channel.id,
            signature: signature,
            syncMessages: sync
        };

        guild.integrations.push(intData);

        MessageService.sendMessage(`We've added your integration. Please use this secret (sha1 hash, hex digest) with these guidelines:\n> If you're using rest, set it as the X-PROX-Signature.\n> If you're using socket.io, please send it in the authorization event as the signature.\nSecret: ${randomString}\n**Please delete this message once you have saved your secret.**`, message.author);

        IntegrationManager.addIntegration(message.guild.id, intData)

        return 'Successfully added an integration with id = ' + guild.integrations.length + ' named ' + name;
    }

    return 'The guild manager could not find the guild';
}

export let commands = [add];
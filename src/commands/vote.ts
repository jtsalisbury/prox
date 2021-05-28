import { Message, MessageEmbed } from "discord.js";
import { IBaseCommand } from "../models/IBase";

// TODO: Formatting could use a facelift

let create = <IBaseCommand>{};
create.aliases = ['poll'];
create.prettyName = 'Create Poll';
create.help = 'Create a new poll';
create.category = 'Poll';
create.params = [
    {
        name: 'question',
        type: 'string'
    },
    {
        name: 'option 1',
        type: 'string'
    },
    {
        name: 'option 2',
        type: 'string'
    },
    {
        name: 'option 3',
        type: 'string',
        optional: true
    },
    {
        name: 'option 4',
        type: 'string',
        optional: true
    },
    {
        name: 'option 5',
        type: 'string',
        optional: true
    },
    {
        name: 'option 6',
        type: 'string',
        optional: true
    },
    {
        name: 'option 7',
        type: 'string',
        optional: true
    },
    {
        name: 'option 8',
        type: 'string',
        optional: true
    },
    {
        name: 'option 9',
        type: 'string',
        optional: true
    },
    {
        name: 'option 10',
        type: 'string',
        optional: true
    }
];
create.executeViaIntegration = false;

let reactions = [
    "\u0031\u20E3",
    "\u0032\u20E3",
    "\u0033\u20E3",
    "\u0034\u20E3",
    "\u0035\u20E3",
    "\u0036\u20E3",
    "\u0037\u20E3",
    "\u0038\u20E3",
    "\u0039\u20E3",
];
create.callback = async function(message: Message, question: string, ...options) {
    let channelId = message.channel.id;

    let responseStr = '';
    let i = 0;
    options.forEach(providedOption => {
        if (providedOption == null) return;

        responseStr += reactions[i] + ' ' + providedOption + '\n';
        i++;
    })
    
    let response = new MessageEmbed().setAuthor('Poll Question')
                      .setDescription(question)
                      .addFields({name: 'Responses', value: responseStr, inline: true});

    let createdMessage = await message.channel.send(response);
    
    let j = 0;
    options.forEach(providedOption => {
        if (providedOption == null) return;

        createdMessage.react(reactions[j]);
        j++;
    })
}
export let commands = [create];
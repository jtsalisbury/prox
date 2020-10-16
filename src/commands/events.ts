import GuildManager from '../models/GuildManager';
import { sendMessage, messageChannelById } from '../services/message';
import EventService from '../services/events';
import logger from '../services/logger';
import { IBaseCommand } from '../models/IBase';
import { Client, Message } from 'discord.js';

let create: IBaseCommand = <IBaseCommand>{};
create.aliases = ['create'];
create.prettyName = 'Create Event';
create.help = 'Create a new event';
create.params = [
    {
        name: 'title',
        type: 'string'
    },
    {
        name: 'channel name (<= 16 length) ',
        type: 'string'
    },
    {
        name: 'description',
        type: 'string'
    },
    {
        name: 'event date and time (mm/dd/yyyy hh:mm PM EDT), max one year in advance',
        type: 'future datetime'
    }
];
create.executePermissions = ['MANAGE_CHANNELS', 'MANAGE_ROLES', 'MOVE_MEMBERS', 'MANAGE_MESSAGES'];
create.executeViaIntegration = false;
create.callback = async function(message: Message, title: string, channelName: string, description: string, dateTime: Date) {
    if (channelName.length > 16) {
        return 'Channel name is too long! Make sure it\'s less than 16 characters';
    }

    // Verify channel doesn't exist
    let channels = message.guild.channels
    let badVibe = false;
    let createCategory = true;
    let categoryChannel;
    channels.cache.forEach(ch => {
        if (ch.name == channelName) {
            badVibe = true;
        }
        if (ch.name == 'Events') {
            createCategory = false;
            categoryChannel = ch;
        }
    });

    if (badVibe) {
        return 'Channel already exists, try creating another one!';
    }

    // Note that dateTime will be returned in UTC centric date
    let timeStr = dateTime.toString();

    let format = `
    > A new event has been created!
    **${title}**
    Description: ${description}
    Happening on: ${timeStr}\n
    Interested in joining? Reply with ✅ below!
    `;

    let generalMessage = await sendMessage(format, message.channel);
    generalMessage[0].react('✅')

    let guild = GuildManager.getGuild(message.guild.id);

    // Create an Events category
    if (createCategory) {
        categoryChannel = await message.guild.channels.create('Events', {
            type: 'category'
        })
    }

    // Create a new channel for the event
    let newChannel = await message.guild.channels.create(channelName, {
        type: 'text',
        topic: `${description}`,
        parent: categoryChannel,
        permissionOverwrites: [{
            id: message.guild.roles.everyone,
            deny: ['VIEW_CHANNEL']
        },
        {
            id: message.guild.me.id,
            allow: ['VIEW_CHANNEL']
        }]
    });

    // Send a message to the channel about what the event is
    let msg = await sendMessage(`> This channel is for **${title}**\nHappening on: ${timeStr}`, newChannel);
    msg[0].pin();

    // Create the event
    guild.events.push({
        title: title,
        description: description,
        channelId: newChannel.id,
        messageChannelId: message.channel.id,
        messageId: generalMessage[0].id,
        date: dateTime,
        creatorId: message.author.id,
        eventPassed: false
    })

    watchMessage(guild.events[guild.events.length - 1], message.guild);
    manageUserInEventChannel(message.author, newChannel.id, message.guild);
}

let cancel: IBaseCommand = <IBaseCommand>{};
cancel.aliases = ['cancel', 'end'];
cancel.prettyName = 'End or cancel event';
cancel.help = 'End or cancel an event. Must be executed in event channel. Only the creator or admin can end or cancel.'
cancel.executeViaIntegration = false;
cancel.callback = function(message: Message) {
    let guild = GuildManager.getGuild(message.guild.id);

    // Search through events to find a match and delete the channel and event
    guild.events.forEach((event, key) => {
        if (event.channelId == message.channel.id) {
            if (!message.member.hasPermission('ADMINISTRATOR') && message.author.id !== event.creatorId) {
                return 'You don\'t have permission for this';
            }

            guild.events.splice(key, 1);
            message.channel.delete();
        }
    })
}

let leave: IBaseCommand = <IBaseCommand>{};
leave.aliases = ['leave'];
leave.prettyName = 'Leave Event';
leave.help = 'Leave an event. Must be executed in event channel.';
leave.executeViaIntegration = false;
leave.callback = function(message: Message) {
    let guild = GuildManager.getGuild(message.guild.id);

    // Search through events to find a match and remove the user
    guild.events.forEach((event) => {
        if (event.channelId == message.channel.id) {
            manageUserInEventChannel(message.author, message.channel.id, message.guild, false);
        }
    })
}

// ShouldAddOrRemove: true, add user, false: remove them
async function manageUserInEventChannel(user, eventChannelId, guild, shouldAddUser = true) {
    let channel = guild.channels.cache.get(eventChannelId);

    if (channel) {
        // Join the current permissions with the new permissions
        // We can either 1) joining while already in, 2) joining first time, 3) joining after leaving
        let newPerms = [];
        if (shouldAddUser) {
            newPerms.push({
                id: user.id,
                allow: ['VIEW_CHANNEL']
            });
        } else {
            newPerms.push({
                id: user.id,
                deny: ['VIEW_CHANNEL']
            });
        }

        let current = channel.permissionOverwrites;
        let userAlreadyIn = false;
        current.forEach(val => {
            // If the user already has permissions
            if (val.id == user.id ) {
                // If the allow field != 0, we are already in 
                if (val.allow.bitfield != 0) {
                    userAlreadyIn = true;
                }

                return;
            }

            // Push the existing permissions
            newPerms.push({
                id: val.id,
                allow: val.allow,
                deny: val.deny
            })
        })

        // Overwrite the permissions
        await channel.overwritePermissions(newPerms)
        if (shouldAddUser) {
            if (!userAlreadyIn) {
                sendMessage(`Welcome to the event, <@${user.id}>!`, channel);
            }
        } else {
            sendMessage(`<@${user.id}> has left the event`, channel);
        }
    }
}

// Watch the message for any reactions
async function watchMessage(event, guild) {
    let ch = guild.channels.cache.get(event.messageChannelId);
    if (!ch) {
        return;
    }
    
    // Get the first returned result with the message id
    let message = await ch.messages.fetch(event.messageId);

    if (message) {
        // Setup a collector to watch reactions
        // TODO: Proper cleanup of reaction collector after event deletion
        let collector = message.createReactionCollector((reaction) => {
            return reaction.emoji.name === '✅';
        });
        collector.on('collect', (reaction, user) => {
            manageUserInEventChannel(user, event.channelId, guild);
        })
    }
}

module.exports.initialize = function(client: Client) {
    // This is disgusting, I'll get it fixed eventually 
    EventService.on('prox.guildsLoaded', async () => {
        client.guilds.cache.forEach(discordGuild => {
            let guild = GuildManager.getGuild(discordGuild.id);

            if (!guild) {
                return;
            }

            guild.events.forEach(event => {
                watchMessage(event, discordGuild);
            })
        });

        // Setup a handler to check for when an event should execute
        async function checkForEvent() {
            logger.info('Checking event status...');
            let now = new Date();
            client.guilds.cache.forEach(discordGuild => {
                let guild = GuildManager.getGuild(discordGuild.id);

                if (!guild) {
                    return;
                }

                // Search through all the events and see if one has popped up yet
                // If a channel was deleted while the bot was down, it'll be okay. MessageService verifies channel integrity
                guild.events.forEach((event, key) => {
                    if (event.date.getTime() <= now.getTime() && !event.eventPassed) {
                        let message = `@everyone, **${event.title}** is starting now!`;
                        messageChannelById(message, discordGuild, event.channelId);

                        event.eventPassed = true;
                    }
                })
            })

            setTimeout(checkForEvent, 300000); //300000
        }
        checkForEvent();
    })
}

export let commands = [create, leave, cancel]
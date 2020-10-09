let Command = require('@models/Command.js');
let GuildManager = require('@models/GuildManager');
let MessageService = require('@services/message');
let _utils = require('@services/utils');

let glob = require('glob');
let path = require('path');

class CommandHandler {
    constructor() {
        this.commands = new Map(); // reference to command objects
        this.aliasReference = new Map(); // reference aliases to base

        this.paramTypes = {};

        glob.sync('./param_types/*.js').forEach(file => {
            let required = require(path.resolve(file));
        
            if (!required.params) {
                return;
            }

            required.params.forEach(param => {
                if (!param.name || !param.convert) {
                    console.error('Improperly formatted param type');

                    return;
                }

                this.paramTypes[param.name] = param.convert;
            })
        });
    }

    registerCommand (aliases, name, help, cback, userPerms, execPerms, external) {
        let usableAliases = aliases;
        if (!Array.isArray(aliases)) {
            usableAliases = [aliases];
        }

        // Create a new command object
        let cmd = new Command(usableAliases, name, help, cback, userPerms, execPerms, external);

        // Register for each alias
        usableAliases.forEach(alias => {
            this.aliasReference.set(alias, aliases[0]);
        });

        // Only store the command object once, though
        this.commands.set(aliases[0], cmd);

        return cmd;
    }

    // Will return false if either 1) the user doesn't have a specified perm or 2) the bot doesn't
    // The user and bot must have all of each permissions
    canExecute(message, command, isExternal, canBeUsedExternally) {
        if (isExternal && !canBeUsedExternally) {
            return 'This command can\'t be ran from outside of Discord';
        }
        
        // Only non-secure functions are exposed externally
        let userPermsPassed = isExternal ? true : message.member.hasPermission(command.getUserPermissions());
        let clientPermsPassed = message.channel.permissionsFor(message.guild.me).has(command.getExecPermissions(), false);
        
        if (!userPermsPassed) {
            return 'You don\'t have permission for this';
        }
        if (!clientPermsPassed) {
            return 'I don\'t have permission for this';
        }

        return true
    }

    async executeCommand(alias, message, parsedLine, isExternal) {
        let activeCommand = this.getCommand(alias);

        if (!activeCommand) {
            MessageService.sendMessage('No command found with that alias!', message.channel);
            return;
        }

        let canExec = this.canExecute(message, activeCommand, isExternal, activeCommand.getExternal());
        if (canExec !== true) {
            MessageService.sendMessage(canExec, message.channel)
            return;
        }

        let parseIndex = 0;
        let params = activeCommand.getParams();

        // More arguments than there are params
        // Join the remaining arguments and mark it as the last param
        if (parsedLine.length > params.length) {
            let subset = parsedLine.slice(params.length - 1);
            parsedLine[params.length - 1] = subset.join(' ');
        }

        let execParams = [];

        // First, assign each parameter for the command to a value
        let validParams = true;
        params.forEach(paramData => {
            let curVal = parsedLine[parseIndex];

            let converted = this.convertToParamType(paramData.type, curVal, message.guild.members);

            if ((converted === undefined || converted == null) && !paramData.optional) {
                MessageService.sendMessage('Invalid value for ' + paramData.name, message.channel);
                validParams = false;
            } else if ((converted === undefined || converted == null) && paramData.optional) {
                parsedLine[parseIndex] = paramData.default != undefined ? paramData.default : null;
                converted = parsedLine[parseIndex];
            }
            
            // Convert it to an expected type
            execParams.push(converted);

            parseIndex += 1;
        });

        if (!validParams) {
            MessageService.sendCommandError(activeCommand, alias, message.channel);
            return;
        }

        // Finally, execute the command reset the parameters
        let res = await (activeCommand.getCallback())(message, ...execParams);

        // Record the command usage
        let baseAlias = activeCommand.getAliases()[0];
        let guild = GuildManager.getGuild(message.guild.id);
        if (guild) {
            // Get current usage profile
            let currentUsage = _utils.resolve(guild, 'statistics.usage');
            let newCount = 1;
            if (currentUsage[baseAlias]) {
                newCount += currentUsage[baseAlias];
            }

            // Update and save
            currentUsage[baseAlias] = newCount;
            guild.markModified('statistics.usage');
        }

        return res;
    }

    convertToParamType (paramType, value, members) {
        let converter = this.paramTypes[paramType];

        if (!converter) {
            console.error('Attempt to find param type of ' + paramType + ' but was not registered');

            return null;
        }
        
        return converter(value, members);
    }

    isValidCommand (alias) {
        return this.aliasReference.get(alias) !== undefined;
    }

    getCommands() {
        return this.commands;
    }

    getCommand(alias) {
        let baseAlias = this.aliasReference.get(alias);

        if (baseAlias) {
            return this.commands.get(baseAlias);
        }
    }
}

module.exports = new CommandHandler();
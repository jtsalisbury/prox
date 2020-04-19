let Command = require('@models/Command.js');
let GuildManager = require('@models/GuildManager');
let MessageService = require('@services/message');

class CommandHandler {
    constructor() {
        this.commands = new Map(); // reference to command objects
        this.aliasReference = new Map(); // reference aliases to base
    }

    registerCommand (aliases, name, help, cback, userPerms, execPerms) {
        let usableAliases = aliases;
        if (!Array.isArray(aliases)) {
            usableAliases = [aliases];
        }

        // Create a new command object
        let cmd = new Command(usableAliases, name, help, cback, userPerms, execPerms);

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
    canExecute(message, command) {
        let userPermsPassed = message.member.hasPermission(command.getUserPermissions());
        let clientPermsPassed = message.channel.permissionsFor(message.guild.me).has(command.getExecPermissions(), false);

        if (!userPermsPassed) {
            return 'You don\'t have permission for this';
        }
        if (!clientPermsPassed) {
            return 'I don\'t have permission for this';
        }

        return true
    }

    async executeCommand(alias, message, parsedLine) {
        let activeCommand = this.getCommand(alias);

        if (!activeCommand) {
            MessageService.sendMessage('No command found with that alias!', message.channel);
            return;
        }

        let canExec = this.canExecute(message, activeCommand);
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

            if (!curVal && !paramData.optional) {
                MessageService.sendMessage('Failed to find value for ' + paramData.name, message.channel);
                validParams = false;
            } else if (!curVal && paramData.optional) {
                parsedLine[parseIndex] = paramData.default || null;
                curVal = parsedLine[parseIndex];
            }
            
            // Convert it to an expected type
            let converted = this.convertToParamType(paramData.type, curVal);
            execParams.push(converted);

            parseIndex += 1;
        });

        if (!validParams) {
            return;
        }

        // Finally, execute the command reset the parameters
        let res = await (activeCommand.getCallback())(message, ...execParams);

        return res;
        
    }

    convertToParamType (paramType, value) {
        if (paramType === 'number') {
            return Number(value);
        }
        
        return value;
    }

    isValidCommand (alias) {
        return this.aliasReference.get(alias) !== undefined;
    }

    getCommands() {
        return this.commands.values();
    }

    getCommand(alias) {
        let baseAlias = this.aliasReference.get(alias);

        if (baseAlias) {
            return this.commands.get(baseAlias);
        }
    }
}

module.exports = new CommandHandler();
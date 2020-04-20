let Command = require('@models/Command.js');
let GuildManager = require('@models/GuildManager');
let MessageService = require('@services/message');
let _utils = require('@services/utils');

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

            let converted = this.convertToParamType(paramData.type, curVal);

            if (converted === undefined && !paramData.optional) {
                MessageService.sendMessage('Invalid value for ' + paramData.name, message.channel);
                validParams = false;
            } else if (!converted === undefined && paramData.optional) {
                parsedLine[parseIndex] = paramData.default || null;
                curVal = parsedLine[parseIndex];
            }
            
            // Convert it to an expected type
            execParams.push(converted);

            parseIndex += 1;
        });

        if (!validParams) {
            return;
        }

        // Finally, execute the command reset the parameters
        let res = await (activeCommand.getCallback())(message, ...execParams);

        // Record the command usage
        let baseAlias = activeCommand.getAliases()[0];
        let guild = GuildManager.getGuild(message.guild.id);
        if (guild) {
            // Get current usage profile
            let currentUsage = _utils.resolve(guild.statistics, 'usage');
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

    convertToParamType (paramType, value) {
        if (paramType === 'number') {
            return Number(value);
        }

        if (paramType === 'future datetime') {

            // Validate pattern dd/mm/yyyy hh:mm pm/am EST
            if (!/^\d{1,2}\/\d{1,2}\/\d{4}\s\d{2}\:\d{2}\s[apAP]{1}[mM]{1}\s([A-Za-z]+)$/.test(value)) {
                return;
            }

            // Convert to numbers and stuff
            let parts = value.split(' ');
            let dateParts = parts[0].split('/').map(pt => {
                return parseInt(pt, 10);
            });
            let timeParts = parts[1].split(':').map(pt => {
                return parseInt(pt, 10);
            });

            let [day, month, year] = dateParts;
            let [hour, minute] = timeParts;

            // Adjust for leap year
            let daysInMonth = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];
            if (year % 400 == 0 || (year % 100 == 0 && year % 4 == 0)) {
                daysInMonth[1] = 29;
            }

            // Invalid day
            if (day < 0 || day > daysInMonth[month]) {
                return;
            }

            if (parts[2].toLowerCase() == 'pm') {
                hour += 12;
            }

            // Invalid hour
            if (hour < 0 || hour > 24) {
                return;
            }

            // Invalid minute
            if (minute < 0 || minute > 59) {
                return;
            }

            let timeZone = parts[3];

            // Validate each part
            let today = new Date();
            if (year > today.getFullYear() + 1) {
                return;
            }

            let str = `${day} ${month} ${year} ${hour}:${minute}:00 ${timeZone}`;

            // Note, returns dates in UTC
            let dt = new Date(Date.parse(str));

            if (dt.getTime() < today.getTime()) {
                return;
            }

            dt.passedTimezone = timeZone;
            return dt;
        }

        if (paramType == 'string') {
            return value.replace(/[|&`;$%@"<>()+,]/g, "");
        }
        
        return value;
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
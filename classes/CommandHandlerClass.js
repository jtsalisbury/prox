let Command = require('./CommandClass.js');

class CommandHandler {
    constructor(client) {
        this.commands = {};
        this.client = client;

        this.activeCommand = null;
    }

    registerCommand (aliases, name, help, cback) {
        let usableAliases = aliases;
        if (!Array.isArray(aliases)) {
            usableAliases = [aliases];
        }

        // Create a new command object
        let cmd = new Command(usableAliases, name, help, cback);

        // Register the same object for each alias
        usableAliases.forEach(alias => {
            this.commands[alias] = cmd;
        });

        return cmd;
    }

    setActiveCommand (alias, message) {
        if (this.isValidCommand(alias)) {
            this.activeCommand = this.commands[alias];

            if (!this.activeCommand.canExecute(message.member.roles._roles)) {
                this.sendMessage('You don\'t have permission to run this command!', message.channel);
                return false;
            }

            return true;
        } else {
            this.sendMessage('No command found with that alias', message.channel);
            return false;
        }
    }

    convertToParamType (paramType, value) {
        if (paramType === 'number') {
            return Number(value);
        } 
        
        return value;
    }

    async executeCommand(message, parsedLine) {
        if (!this.activeCommand) {
            this.sendMessage('No active command', message.channel);
            return false;
        }

        let parseIndex = 0;
        let params = this.activeCommand.getParams();

        // More arguments than there are params
        // Join the remaining arguments and mark it as the last param
        if (parsedLine.length > params.length) {
            let subset = parsedLine.slice(params.length - 1);
            parsedLine[params.length - 1] = subset.join(' ');
        }

        // First, assign each parameter for the command to a value
        let validParams = true;
        params.forEach(paramData => {
            let curVal = parsedLine[parseIndex];

            if (!curVal && !paramData.optional) {
                this.sendMessage('Failed to find value for ' + paramData.name, message.channel);
                validParams = false;
            } else if (!curVal && paramData.optional) {
                parsedLine[parseIndex] = paramData.default || null;
                curVal = parsedLine[parseIndex];
            }
            
            // Convert it to an expected type
            let converted = this.convertToParamType(paramData.type, curVal);

            this.activeCommand.setParamValue(paramData.name, converted);
            parseIndex += 1;
        });

        if (!validParams) {
            return;
        }

        // Finally, execute the command reset the parameters
        
        let res = await this.activeCommand.execute(message);

        this.activeCommand.resetParams();
        this.activeCommand = null;

        return res;
        
    }

    isValidCommand (alias) {
        return this.commands[alias] !== undefined;
    }

    getCommands() {
        return this.commands;
    }

    getCommand(alias) {
        return this.commands[alias];
    }

    getClient() {
        return this.client;
    }

    sendMessage(str, target) {
        target.send(str, {
            split: true
        });
    }
}

module.exports = CommandHandler;
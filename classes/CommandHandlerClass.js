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

            if (!this.activeCommand.canExecute(message.member.roles)) {
                this.sendError('You don\'t have permission to run this command!');
            }

            return true;
        } else {
            this.sendError('No command found with that alias');
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
            this.sendError('No active command');
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
        params.forEach(paramData => {
            let curVal = parsedLine[parseIndex];

            if (!curVal && !paramData.optional) {
                this.sendError('Failed to find value for ' + paramData.name);
            } else if (!curVal && paramData.optional) {
                parsedLine[parseIndex] = paramData.default || null;
                curVal = parsedLine[parseIndex];
            }
            
            // Convert it to an expected type
            let converted = this.convertToParamType(paramData.type, curVal);

            this.activeCommand.setParamValue(paramData.name, converted);
            parseIndex += 1;
        });

        // Validate that each parameter has a value. This will throw if there's an error
        this.activeCommand.validate(this);

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

    sendError(str) {
        throw new Error(str);
    }

    sendMessage(str, target) {
        target.send(str, {
            split: true
        });
    }
}

module.exports = CommandHandler;
let Command = require('./CommandClass.js');

class CommandHandler {
    constructor() {
        this.commands = {};

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
                throw new Error('You don\'t have permission to run this command!');
            }

            return true;
        } else {
            throw new Error('No command found with that alias :&(');
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
            throw new Error('No active command');
        }

        let parseIndex = 0;
        let params = this.activeCommand.getParams();

        // First, assign each parameter for the command to a value
        params.forEach(paramData => {
            let curVal = parsedLine[parseIndex];

            if (!curVal) {
                throw new Error('Failed to find value for ' + paramData.name);
            }

            // Convert it to an expected type
            let converted = this.convertToParamType(paramData.type, curVal);

            this.activeCommand.setParamValue(paramData.name, converted);
            parseIndex += 1;
        });

        // Validate that each parameter has a value. This will throw if there's an error
        this.activeCommand.validate();

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

}

module.exports = CommandHandler;
let Command = require('./CommandClass.js');

class CommandHandler {
    constructor() {
        this.commands = {};

        this.activeCommand = null;
    };

    registerCommand (aliases, name, help, cback) {
        if (!Array.isArray(aliases)) {
            aliases = [aliases];
        }

        let cmd = new Command(aliases, name, help, cback);

        aliases.forEach(alias => {
            this.commands[alias] = cmd;
        });

        return cmd;
    };

    async executeCommand(parsedLine) {
        if (!this.activeCommand) {
            throw new Error('No active command');
        }

        let parseIndex = 0;
        let params = this.activeCommand.getParams();

        params.forEach(paramData => {
            let curVal = parsedLine[parseIndex];

            if (!curVal) {
                throw new Error('Failed to find value for ' + paramData.name);
            }

            let converted = this.convertToParamType(paramData.type, curVal);

            this.activeCommand.setParamValue(paramData.name, converted);
            parseIndex++;
        });

        let validated = this.activeCommand.validate();
        if (!validated[0]) {
            return validated;
        }

        let res = await this.activeCommand.execute();
        this.activeCommand.resetParams();
        this.activeCommand = null;

        return res;
    };

    setActiveCommand (alias) {
        if (this.commands[alias]) {
            this.activeCommand = this.commands[alias];
            return true;
        } else {
            return false;
        }
    };

    convertToParamType (paramType, value) {
        return value;
    };
};

module.exports = CommandHandler;
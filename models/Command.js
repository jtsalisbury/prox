class Command {
    constructor(aliases, prettyName, help, callback, userPerms, execPerms, external) {
        this.aliases = aliases;
        this.prettyName = prettyName;
        this.help = help;
        this.cback = callback;
        this.params = [];
        this.reqUserPerms = userPerms;
        this.reqExecPerms = execPerms;
        this.canBeUsedExternally = external;
    }

    addParam(name, type, optional, def) {
        this.params.push({
            name: name,
            type: type,
            optional: optional,
            default: def
        });

        return this;
    }

    setParamValue(name, newValue) {
        // Assign the parameter a value. This is used for execution
        for (let i in this.getParams()) {
            let paramData = this.params[i];

            if (paramData.name === name) {
                this.params[i].value = newValue;
            }
        }
    }

    getAliases() {
        return this.aliases;
    }

    getCallback() {
        return this.cback;
    }

    getName() {
        return this.prettyName;
    }

    getHelp() {
        return this.help;
    }

    getParams() {
        return this.params;
    }

    getRestricted() {
        return this.restrictedTo;
    }

    getUserPermissions() {
        return this.reqUserPerms;
    }

    getExecPermissions() {
        return this.reqExecPerms;
    }

    getExternal() {
        return this.canBeUsedExternally;
    }
}

module.exports = Command;
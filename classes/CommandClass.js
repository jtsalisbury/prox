class Command {
    constructor(aliases, prettyName, help, callback) {
        this.aliases = aliases;
        this.prettyName = prettyName;
        this.help = help;
        this.cback = callback;
        this.params = [];
        this.restrictedTo = [];
        this.permissions = [];
    }

    addParam (name, type, optional, def) {
        this.params.push({
            name: name,
            type: type,
            value: null,
            optional: optional,
            default: def
        });

        return this;
    }

    addPermission (name) {
        this.permissions.push(name);

        return this;
    }

    setParamValue (name, newValue) {
        // Assign the parameter a value. This is used for execution
        for (let i in this.getParams()) {
            let paramData = this.params[i];

            if (paramData.name === name) {
                this.params[i].value = newValue;
            }
        }
    }

    restrictTo (role) {
        this.restrictedTo.push(role);

        return this;
    }

    canExecute (roles) {
        if (this.restrictedTo.length > 0) {
            return roles.some(role => this.restrictedTo.includes(role.name));
        }

        return true;
    }

    validate(cbot) {
        this.getParams().forEach(paramData => {
            if (paramData.value === null) {
                cbot.sendError('Failed to find value for ' + paramData.name);
            }
        });

        return true;
    }

    resetParams() {
        let params = this.getParams();
        for (let i in params) {
            this.params[i].value = null;
        }
    }

    execute (message) {
        let paramValues = [];
        let params = this.getParams();

        // Generate a 1d array with the parameter values
        for (let paramName in params) {
            let paramData = params[paramName];

            paramValues.push(paramData.value);
        }

        // Execute the callback while spreading the parameter values
        return this.cback(message, ...paramValues);
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

    getPermissions() {
        return this.permissions;
    }
}

module.exports = Command;
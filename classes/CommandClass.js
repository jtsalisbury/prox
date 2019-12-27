class Command {
    constructor(aliases, prettyName, help, callback) {
        this.aliases = aliases;
        this.prettyName = prettyName;
        this.help = help;
        this.cback = callback;
        this.params = [];
        this.restrictedTo = [];
    }

    addParam (name, type) {
        this.params.push({
            name: name,
            type: type,
            value: null
        });

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

    validate() {
        this.getParams().forEach(paramData => {
            if (paramData.value === null) {
                throw new Error('Failed to find value for ' + paramData.name);
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
}

module.exports = Command;
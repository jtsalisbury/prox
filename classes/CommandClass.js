class Command {
    constructor(aliases, prettyName, help, callback) {
        this.aliases = aliases;
        this.prettyName = prettyName;
        this.help = help;
        this.cback = callback;
        this.params = [];
    }

    addParam (name, type) {
        this.params.push({
            name: name,
            type: type,
            value: null
        });

        return this;
    };

    getParams() {
        return this.params;
    };

    setParamValue (name, newValue) {
        for (let i in this.getParams()) {
            let paramData = this.params[i];

            if (paramData.name === name) {
                this.params[i].value = newValue;
            }
        }
    };

    validate() {
        this.getParams().forEach(paramData => {
            if (paramData.value === null) {
                throw new Error('Failed to find value for ' + paramName);
            }
        });

        return [true];
    };

    resetParams() {
        let params = this.getParams();
        for (let i in params) {
            this.params[i].value = null;
        }
    }

    async execute () {
        let paramValues = [];
        let params = this.getParams();
        for (let paramName in params) {
            let paramData = params[paramName];

            paramValues.push(paramData.value);
        }

        return await this.cback(...paramValues);
    };
};

module.exports = Command;
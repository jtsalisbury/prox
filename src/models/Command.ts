import { IBaseParam } from "./IBase";

export default class Command {
    private aliases: string[];
    private prettyName: string;
    private help: string;
    private callback: any;
    private params: IBaseParam[];
    private reqUserPerms: string[];
    private reqExecPerms: string[];
    private canBeUsedExternally: boolean;

    constructor(aliases: string[], 
                prettyName: string, 
                help: string, 
                callback: (Message, ...any) => Promise<String> | Promise<void>  | void, 
                userPerms?: string[], 
                execPerms?: string[], 
                external?: boolean) {

        this.aliases = aliases;
        this.prettyName = prettyName;
        this.help = help;
        this.callback = callback;
        this.params = [];
        this.reqUserPerms = userPerms;
        this.reqExecPerms = execPerms;
        this.canBeUsedExternally = external;
    }

    public addParam(name: string, type: string, optional: boolean, def: any) {
        this.params.push({
            name: name,
            type: type,
            optional: optional,
            default: def
        });

        return this;
    }

    public setParamValue(name: string, newValue: any) {
        // Assign the parameter a value. This is used for execution
        for (let i in this.getParams()) {
            let paramData = this.params[i];

            if (paramData.name === name) {
                this.params[i].value = newValue;
            }
        }
    }

    public getAliases(): string[] {
        return this.aliases;
    }

    public getCallback(): (Message, ...any) => Promise<String> | void {
        return this.callback;
    }

    public getName(): string {
        return this.prettyName;
    }

    public getHelp(): string {
        return this.help;
    }

    public getParams(): IBaseParam[] {
        return this.params;
    }

    public getUserPermissions(): string[] {
        return this.reqUserPerms;
    }

    public getExecPermissions(): string[] {
        return this.reqExecPerms;
    }

    public getExternal(): boolean {
        return this.canBeUsedExternally;
    }
}
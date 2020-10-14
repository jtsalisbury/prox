import { BaseParam } from "./BaseParam";

export default class Command {
    private aliases: string[];
    private prettyName: string;
    private help: string;
    private callback: any;
    private params: BaseParam[];
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

    public addParam(param: BaseParam) {
        this.params.push(param);

        return this;
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

    public getParams(): BaseParam[] {
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
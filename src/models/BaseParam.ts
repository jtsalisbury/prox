import { IBaseParamData } from "./IBase";

export abstract class BaseParam {
    private name: string;
    private type: string;
    private allowedValues?: any[];
    private optional?: boolean;
    private default?: any;

    constructor() { }

    initialize(paramData: IBaseParamData) {
        this.name = paramData.name;
        this.type = paramData.type;
        this.allowedValues = paramData.allowedValues;
        this.optional = paramData.optional;
        this.default = paramData.default;
    }

    validate(): boolean {
        return (typeof(this.name) != 'undefined' && typeof(this.type) != 'undefined');
    }

    getName(): string {
        return this.name;
    }

    getType(): string {
        return this.type;
    }

    getAllowedValues() {
        return this.allowedValues;
    }

    isOptional(): boolean {
        return this.optional == true;
    }

    getDefault(): any {
        return this.default;
    }

    getParamType(): string {
        return this.paramType;
    }

    abstract paramType: string;
    abstract convert(string, GuildMemberManager?): any;
}
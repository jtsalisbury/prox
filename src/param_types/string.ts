import { IBaseParamHandler } from "../models/IBase";

let string: IBaseParamHandler = <IBaseParamHandler>{};
string.name = 'string';
string.convert = function(value) {
    if (value) {
        return value.replace(/[|`;$%@"(),]/g, "");
    }
}

export let params = [string];
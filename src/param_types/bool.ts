import { IBaseParamHandler } from "../models/IBase";

let bool: IBaseParamHandler = <IBaseParamHandler>{};
bool.name = 'bool';
bool.convert = function(value) {
    if (!value) {
        return;
    }

    let lower = value.toLowerCase();
    if (lower == 'y' || lower == 'true' || lower == 't' || lower == 'yes') {
        return true;
    }

    return false;
}

export let params = [bool];
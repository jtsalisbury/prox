import { IBaseParamHandler } from "../models/IBase";

let number: IBaseParamHandler = <IBaseParamHandler>{};
number.name = 'number';
number.convert = function(value) {
    let converted = Number(value);

    return !isNaN(converted) ? converted : null;
}

export let params = [number];
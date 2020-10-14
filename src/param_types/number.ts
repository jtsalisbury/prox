import { BaseParam } from "../models/BaseParam";

export default class NumberParam extends BaseParam {
    paramType = 'number';

    convert = function(value, _) {
        let converted = Number(value);

        return !isNaN(converted) ? converted : null;
    }
}
import { BaseParam } from "../models/BaseParam";

export default class StringParam extends BaseParam {
    paramType = 'string';

    convert = function(value, _) {
        if (value) {
            return value.replace(/[|`;$%@"(),]/g, "");
        }
    }
}
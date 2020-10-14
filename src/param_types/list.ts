import { BaseParam } from "../models/BaseParam";

export default class ListParam extends BaseParam {
    paramType = 'list';

    validate() : boolean {
        return super.validate() && Array.isArray(this.getAllowedValues());
    }

    convert = function(value, _) {
        let converted = value.trim().toLowerCase();
        let allowedValues = this.getAllowedValues();
    
        // Loop through possible string/number values
        for (let i = 0; i < allowedValues.length; i++) {
            let target = allowedValues[i];
            let isString = typeof(target) == 'string';
    
            // If the current target is a string, trim and lowercase it
            if (isString) {
                target = (<string>target).trim().toLowerCase();
            }
    
            // If the current target isn't a string, we need to deal with a number, so convert ours
            let tester = converted;
            if (!isString) {
                tester = Number(converted);
            }
    
            // Return the proper value if we get a trimmed/case-insensitive match
            if (tester == target) {
                return allowedValues[i];
            }
        }
    }
}
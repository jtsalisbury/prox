import { GuildMemberManager } from "discord.js";
import { BaseParam } from "../models/BaseParam";

export default class BooleanParam extends BaseParam {
    paramType = 'bool';

    convert = function(value, members: GuildMemberManager) {
        if (!value) {
            return;
        }
    
        let lower = value.toLowerCase();
        if (lower == 'y' || lower == 'true' || lower == 't' || lower == 'yes') {
            return true;
        }
    
        return false;
    }
}
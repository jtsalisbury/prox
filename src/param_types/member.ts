import { GuildMemberManager } from "discord.js";
import { BaseParam } from "../models/BaseParam";

export default class MemberParam extends BaseParam {
    paramType = 'member';

    convert = function(value, members: GuildMemberManager) {
        if (!value) return;

        if (value.startsWith('<@') && value.endsWith('>')) {
            value = value.slice(2, -1);

            if (value.startsWith('!')) {
                value = value.slice(1);
            }

            return members.cache.get(value);
        }
    }
}
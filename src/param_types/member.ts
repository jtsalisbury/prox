import { GuildMemberManager } from "discord.js";
import { IBaseParamHandler } from "../models/IBase";

let member: IBaseParamHandler = <IBaseParamHandler>{};
member.name = 'member';
member.convert = function(value: string, members: GuildMemberManager) {
    if (!value) return;

    if (value.startsWith('<@') && value.endsWith('>')) {
        value = value.slice(2, -1);

        if (value.startsWith('!')) {
            value = value.slice(1);
        }

        return members.cache.get(value);
    }
}

export let params = [member];
import { Message } from 'discord.js';
import { IBaseCommand } from '../models/IBase';

let help = <IBaseCommand>{};
help.aliases = ['help'];
help.prettyName = 'Help';
help.executeViaIntegration = false;
help.help = 'Takes you to the help page for Prox';
help.category = 'Help';
help.callback = async function() {
    return 'Check out the help page at http://jtsalisbury.me:3001/help'
}

export let commands = [help];
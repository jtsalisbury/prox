import { IBaseCommand } from '../models/IBase';
import * as _utils from '../services/utils';

let codes = ["ar", "bg", "zhCN", "zhTW", "hr", "cs", "da", "nl", "en", "et", "tl", "fi", "fr", "de", "el", "iw", "hi", "hu", "is", "id", "ga", "it", "ja", "ko", "la", "lv", "lt", "mk", "mt", "no", "fa", "pl", "pt", "ro", "ru", "sr", "sk", "si", "es", "sv", "th", "tr", "vi"];

let translate = <IBaseCommand>{};
translate.aliases = ['translate'];
translate.prettyName = 'Translate';
translate.help = `Translate using keys from one lang to another\nCodes can be one of ${codes.join()}`;
translate.category = 'Utilities';
translate.params = [
    {
        name: 'translate from',
        type: 'list',
        allowedValues: codes
    },
    {
        name: 'translate to',
        type: 'list',
        allowedValues: codes
    },
    {
        name: 'stext',
        type: 'string'
    }
];
translate.executeViaIntegration = true;
translate.callback = async function(_, src: string, dest: string, text: string) {
    let url = "https://frengly.com/frengly/data/translateREST";
    let payload = {
        src: src,
        dest: dest,
        text: text,
        email: process.env.TRANSLATE_EMAIL,
        password: process.env.TRANSLATE_PASSWORD
    }

    let response: any = await _utils.HTTPPost(url, payload);

    let translation = response.translation;

    return `"${text}" translated to ${dest} is "${translation}"`;
}

export let commands = [translate];
let _utils = require('../utils/utils');

let codes = ["ar", "bg", "zhCN", "zhTW", "hr", "cs", "da", "nl", "en", "et", "tl", "fi", "fr", "de", "el", "iw", "hi", "hu", "is", "id", "ga", "it", "ja", "ko", "la", "lv", "lt", "mk", "mt", "no", "fa", "pl", "pt", "ro", "ru", "sr", "sk", "si", "es", "sv", "th", "tr", "vi"];

let translate = {};
translate.aliases = ['translate'];
translate.prettyName = 'Translate';
translate.help = `Translate using keys from one lang to another\nCodes can be one of ${codes.join()}`;
translate.params = [
    {
        name: 'translate from',
        type: 'string'
    },
    {
        name: 'translate to',
        type: 'string'
    },
    {
        name: 'stext',
        type: 'string'
    }
];
translate.callback = async function(_, src, dest, text) {
	if (codes.indexOf(src) === -1 || codes.indexOf(dest) === -1) {
        global.cbot.sendError('Invalid language codes');
    }

    let url = "https://frengly.com/frengly/data/translateREST";
    let payload = {
        src: src,
        dest: dest,
        text: text,
        email: process.env.TRANSLATE_EMAIL,
        password: process.env.TRANSLATE_PASSWORD
    }

    let response = await _utils.HTTPPost(url, payload);

    let translation = response.translation;

    return `"${text}" translated to ${dest} is "${translation}"`;
}

module.exports.commands = [translate];
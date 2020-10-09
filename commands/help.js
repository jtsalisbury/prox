let CommandHandler = require('@models/CommandHandler');
let MessageService = require('@services/message');

let help = {};
help.aliases = ['help'];
help.prettyName = 'Help';
help.executeViaIntegration = false;
help.help = 'Takes you to the help page for Prox';

help.callback = function() {
    return 'Check out the help page at https://discord-prox-web.herokuapp.com/help'
}

module.exports.commands = [help];
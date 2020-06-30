let CommandHandler = require('@models/CommandHandler');
let MessageService = require('@services/message');

let constructParamHelp = function(cmdObj) {
    let helpStr = "";
    
    cmdObj.getParams().forEach(param => {
        let optText = param.optional ? 'optional, default: ' + (param.default == undefined ? 'nothing' : param.default) : 'required';

        helpStr += `<${param.name} (${param.type}, ${optText})> `;
    });

    return helpStr;
};

let help = {};
help.aliases = ['help'];
help.prettyName = 'Help';
help.executeViaIntegration = false;
help.help = 'Prints a list of the commands and their purpose';

help.callback = function(message) {
    let commands = CommandHandler.getCommands();

    // Generate a help string with the alias, help and param string
    let helpStr = "To view parameters for a command, type !help <command alias>\n\n";
    commands.forEach((cmdObj) => {

        let paramHelp = constructParamHelp(cmdObj);

        helpStr += `${cmdObj.getName()}: ${cmdObj.getHelp()}\nCalled with: \`\`!${cmdObj.getAliases()[0]} ${paramHelp}\n\`\``;

        let additionalAliases = cmdObj.getAliases().slice(1);
        if (additionalAliases.length > 0) {
            helpStr += `Aliases: ${additionalAliases.join(', ')}\n`
        }
        
        // sendMessage individual messages since discord can't handle >2000 characters
        helpStr += '\n';
    });

    if (message.author) {
        MessageService.sendMessage(helpStr, message.author);
    } else {
        return helpStr;
    }
}

let cmdHelp = {};
cmdHelp.aliases = ['cmdhelp'];
cmdHelp.prettyName = 'Command Help';
cmdHelp.help = 'Prints detailed information about a command';
cmdHelp.executeViaIntegration = false;
cmdHelp.params = [
    {
        name: 'command',
        type: 'string'
    }
];

cmdHelp.callback = function(message, command) {
    let helpStr = "A list of available commands can be found below.\n\n";
    
    if (!CommandHandler.isValidCommand(command)) {
        return 'No command found with that alias';
    }

    // Generate the help string for this single command
    let cmdObj = CommandHandler.getCommand(command);
    let paramHelp = constructParamHelp(cmdObj);

    // General help
    helpStr += `${cmdObj.getName()}: ${cmdObj.getHelp()}\nCalled with: \`\`!${command} ${paramHelp}\n\`\``;

    // Additional aliases
    let additionalAliases = cmdObj.getAliases().slice(1);
    if (additionalAliases.length > 0) {
        helpStr += `Aliases: ${additionalAliases.join(', ')}\n`
    }

    helpStr += '\n';
    
    // sendMessage a PM to the user
    MessageService.sendMessage(helpStr, message.author);

    if (message.author) {
        MessageService.sendMessage(helpStr, message.author);
    } else {
        return helpStr;
    }
}

module.exports.commands = [help, cmdHelp];
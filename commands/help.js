let constructParamHelp = function(cmdObj) {
    let helpStr = "";
    
    cmdObj.getParams().forEach(param => {
        helpStr += `<${param.name} (${param.type})> `;
    });

    return helpStr;
};

let help = {};
help.aliases = ['help'];
help.prettyName = 'Help';
help.help = 'Prints a list of the commands and their purpose';

help.callback = function(message) {
    let commands = global.cbot.getCommands();

    // Generate a help string with the alias, help and param string
    let helpStr = "To view parameters for a command, type !help <command alias>\n\n";
    
    for (let cmdAlias in commands) {
        let cmdObj = commands[cmdAlias];

        helpStr += `${cmdObj.getName()}: ${cmdObj.getHelp()}\nCalled with: !${cmdAlias}\n`;
        
        let restrictions = cmdObj.getRestricted();
        if (restrictions.length > 0) {
            helpStr += 'Restricted to: ' + restrictions.join(', ') + '\n';
        }
        
        // Send individual messages since discord can't handle >2000 characters
        helpStr += '\n';
    }

    message.member.send(helpStr);
}

let cmdHelp = {};
cmdHelp.aliases = ['cmdhelp'];
cmdHelp.prettyName = 'Command Help';
cmdHelp.help = 'Prints detailed information about a command';
cmdHelp.params = [
    {
        name: 'command',
        type: 'string'
    }
];

cmdHelp.callback = function(message, command) {
    let helpStr = "A list of available commands can be found below.\n\n";
    
    if (!global.cbot.isValidCommand(command)) {
        return 'No command found with that alias :&(';
    }

    // Generate the help string for this single command
    let cmdObj = global.cbot.getCommand(command);
    let paramHelp = constructParamHelp(cmdObj);

    helpStr += `${cmdObj.getName()}: ${cmdObj.getHelp()}\nCalled with: !${command} ${paramHelp}\n`;
    let restrictions = cmdObj.getRestricted();
    if (restrictions.length > 0) {
        helpStr += 'Restricted to: ' + restrictions.join(', ') + '\n';
    }
    helpStr += '\n';
    
    // Send a PM to the user
    message.member.send(helpStr);
}

module.exports.commands = [help, cmdHelp];
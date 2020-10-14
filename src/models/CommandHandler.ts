import Command from './Command.js';
import GuildManager from './GuildManager';
import MessageService from '../services/message';
import * as _utils from '../services/utils';

import glob from 'glob';
import path from 'path';
import { Message, TextChannel } from 'discord.js';
import { IBaseParam } from './IBase.js';

class CommandHandler {
    private commands: Map<string, Command>;
    private aliasReference: Map<string, string>;
    private paramTypes: object;

    constructor() {
        this.commands = new Map(); // reference to command objects
        this.aliasReference = new Map(); // reference aliases to base

        this.paramTypes = {};

        glob.sync(__dirname + '/../param_types/*.js').forEach(async file => {
            let required = await import(path.resolve(file));
        
            if (!required.params) {
                return;
            }

            required.params.forEach(param => {
                if (!param.name || !param.convert) {
                    console.error('Improperly formatted param type');

                    return;
                }

                this.paramTypes[param.name] = param.convert;
            })
        });
    }

    public registerCommand (aliases: string[], 
                    name: string, 
                    help: string, 
                    callback: (Message, ...any) => Promise<String> | Promise<void>  | void, 
                    userPerms?: string[], 
                    execPerms?: string[], 
                    external?: boolean): Command {
                        
        let usableAliases: string[] = aliases;
        if (!Array.isArray(aliases)) {
            usableAliases = [aliases];
        }

        // Create a new command object
        let cmd = new Command(usableAliases, name, help, callback, userPerms, execPerms, external);

        // Register for each alias
        usableAliases.forEach(alias => {
            this.aliasReference.set(alias, aliases[0]);
        });

        // Only store the command object once, though
        this.commands.set(aliases[0], cmd);

        return cmd;
    }

    // Will return false if either 1) the user doesn't have a specified perm or 2) the bot doesn't
    // The user and bot must have all of each permissions
    public canExecute(message: Message, command: Command, isExternal: boolean, canBeUsedExternally: boolean): boolean | string {
        if (isExternal && !canBeUsedExternally) {
            return 'This command can\'t be ran from outside of Discord';
        }

        let userPerms = <any>command.getUserPermissions();
        let execPerms = <any>command.getExecPermissions();
        
        // Only non-secure functions are exposed externally
        let userPermsPassed = isExternal ? true : message.member.hasPermission(userPerms);

        let channel = <TextChannel>message.channel;
        let clientPermsPassed: boolean = channel.permissionsFor(message.guild.me).has(execPerms, false);
        
        if (!userPermsPassed) {
            return 'You don\'t have permission for this';
        }
        if (!clientPermsPassed) {
            return 'I don\'t have permission for this';
        }

        return true
    }

    public async executeCommand(alias: string, message: Message, parsedLine: string[], isExternal: boolean): Promise<string | void> {
        let activeCommand = this.getCommand(alias);

        if (!activeCommand) {
            MessageService.sendMessage('No command found with that alias!', message.channel);
            return;
        }

        let canExec = this.canExecute(message, activeCommand, isExternal, activeCommand.getExternal());
        if (canExec !== true) {
            MessageService.sendMessage(canExec, message.channel)
            return;
        }

        let parseIndex = 0;
        let params: IBaseParam[] = activeCommand.getParams();

        // More arguments than there are params
        // Join the remaining arguments and mark it as the last param
        if (parsedLine.length > params.length) {
            let subset = parsedLine.slice(params.length - 1);
            parsedLine[params.length - 1] = subset.join(' ');
        }

        let execParams = [];

        // First, assign each parameter for the command to a value
        let validParams = true;
        params.forEach(paramData => {
            let curVal = parsedLine[parseIndex];

            let converted = this.convertToParamType(paramData.type, curVal, message.guild.members);

            if ((converted === undefined || converted == null) && !paramData.optional) {
                MessageService.sendMessage('Invalid value for ' + paramData.name, message.channel);
                validParams = false;
            } else if ((converted === undefined || converted == null) && paramData.optional) {
                parsedLine[parseIndex] = paramData.default != undefined ? paramData.default : null;
                converted = parsedLine[parseIndex];
            }
            
            // Convert it to an expected type
            execParams.push(converted);

            parseIndex += 1;
        });

        if (!validParams) {
            MessageService.sendCommandError(activeCommand, alias, message.channel);
            return;
        }

        // Finally, execute the command reset the parameters
        let res: any = await (activeCommand.getCallback())(message, ...execParams);

        // Record the command usage
        let baseAlias: string = activeCommand.getAliases()[0];
        let guild = GuildManager.getGuild(message.guild.id);
        if (guild) {
            // Get current usage profile
            let currentUsage = _utils.resolve(guild, 'statistics.usage');
            let newCount = 1;
            if (currentUsage[baseAlias]) {
                newCount += currentUsage[baseAlias];
            }

            // Update and save
            currentUsage[baseAlias] = newCount;
            guild.markModified('statistics.usage');
        }

        return res;
    }

    public convertToParamType (paramType: string, value: string, members): any {
        let converter = this.paramTypes[paramType];

        if (!converter) {
            console.error('Attempt to find param type of ' + paramType + ' but was not registered');

            return null;
        }
        
        return converter(value, members);
    }

    public isValidCommand (alias: string): boolean {
        return this.aliasReference.get(alias) !== undefined;
    }

    public getCommands(): Map<string, Command> {
        return this.commands;
    }

    public getCommand(alias: string): Command {
        let baseAlias = this.aliasReference.get(alias);

        if (baseAlias) {
            return this.commands.get(baseAlias);
        }
    }
}

export default new CommandHandler();
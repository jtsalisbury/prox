import { Message, MessageEmbed, TextChannel, VoiceChannel } from 'discord.js';

export interface IBaseParamData {
    name: string;
    type: string;
    allowedValues?: any[];
    optional?: boolean;
    default?: any;
    value?: any;
}

export interface IBaseCommand {
    aliases: string[];
    prettyName: string;
    help: string;
    category: string;
    params: IBaseParamData[];
    callback: (Message, ...any) => Promise<String> | Promise<MessageEmbed> | Promise<void> | void;
    userPermissions?: string[];
    executePermissions?: string[];
    executeViaIntegration?: boolean;
}

export interface IBaseMusicHandler {
    getName(): string;
    isMatch(link: string): boolean;
    getSongs(link: string): Promise<ISongData[]>;
    getStream(url: string): any;
    getNext(url: string, lastPlayed?: string[]): any;
}

export interface ISongData {
    thumbnail?: string;
    title: string;
    url: string;
    artists: object;
    type: string;
    autoplay?: boolean;
    author?: string;
}

export interface ISongQueue {
    textChannel: TextChannel;
    voiceChannel: VoiceChannel;
    dispatcher: any;
    songs: ISongData[];
    recent: string[];
    volume: number;
    playing: boolean;
    autoplay: boolean;
}

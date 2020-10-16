import GuildManager from '../models/GuildManager';
import path from 'path';
import { IBaseCommand } from '../models/IBase';
import { Message } from 'discord.js';

let join = <IBaseCommand>{};
join.aliases = ['join'];
join.prettyName = 'Join Voice Channel';
join.help = 'Joins a voice channel and prepares Prox to listen for voice input';
join.category = 'Speech';
join.callback = async function (message: Message) {
    let voiceMgr = GuildManager.getVoiceManager(message.guild.id);

    if (!voiceMgr.inChannel()) {
        await voiceMgr.joinChannel(message.member.voice.channel);
    }

    // For some reason on initial join, the bot doesn't pick up any audio without first playing something? Strange!
    let conn = voiceMgr.getConnection();
    conn.play(path.join(__dirname, '../assets/silence.mp3'));
}

let leave = <IBaseCommand>{};
leave.aliases = ['leave'];
leave.prettyName = 'Leave Voice Channel';
leave.help = 'Leaves a voice channel';
leave.category = 'Speech';
leave.callback = function (message: Message) {
    let voiceMgr = GuildManager.getVoiceManager(message.guild.id);

    if (voiceMgr.inChannel()) {
        voiceMgr.leaveChannel();
    }
}

let speech = <IBaseCommand>{};
speech.aliases = ['speech'];
speech.prettyName = 'Enable or disable speech';
speech.help = 'Allows or revokes Prox\'s ability to recognize your voice. When disabled, Prox will not record anything. Disabled by default.';
speech.category = 'Speech';
speech.params = [{
    name: 'state (enable, disable)',
    type: 'string'
}];
speech.callback = async function(message: Message, state: string) {
    if (state != 'enable' && state != 'disable') {
        return 'Invalid state. Please select enable or disable';
    }

    let guild = GuildManager.getGuild(message.guild.id);
    if (state == 'enable') {
        if (guild.allowSpeechRecognition.includes(message.member.id)) {
            return 'You\'re already set to allow speech recognition';
        }

        guild.allowSpeechRecognition.push(message.member.id);
        return 'You have enabled speech recognition';

    } else {
        let index = guild.allowSpeechRecognition.indexOf(message.member.id);
        if (index != -1) {
            guild.allowSpeechRecognition.splice(index);
            return 'You have disabled speech recognition';
        }

        return 'You\'re already set to not allow speech recognition';
    }
}

export let commands = [join, leave, speech];
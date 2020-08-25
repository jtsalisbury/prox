let GuildManager = require('@models/GuildManager');

let join = {};
join.aliases = ['join'];
join.prettyName = 'Join Voice Channel';
join.help = 'Joins a voice channel and prepares cbot to listen for voice input';
join.callback = async function (message) {
    let voiceMgr = GuildManager.getVoiceManager(message.guild.id);

    if (!voiceMgr.inChannel()) {
        voiceMgr.joinChannel(message.member.voice.channel);
    }
}

let leave = {};
leave.aliases = ['leave'];
leave.prettyName = 'Leave Voice Channel';
leave.help = 'Leaves a voice channel';
leave.callback = function (message) {
    let voiceMgr = GuildManager.getVoiceManager(message.guild.id);

    if (voiceMgr.inChannel()) {
        voiceMgr.leaveChannel();
    }
}

let speech = {};
speech.aliases = ['speech'];
speech.prettyName = 'Enable or disable speech';
speech.help = 'Allows or revokes cbot\'s ability to recognize your voice';
speech.params = [{
    name: 'state (enable, disable)',
    type: 'string'
}];
speech.callback = function(message, state) {
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

module.exports.commands = [join, leave, speech];
import { Message, TextChannel } from "discord.js";
import { IBaseCommand } from "../models/IBase";

// TODO: Formatting could use a facelift

let create = <IBaseCommand>{};
create.aliases = ['createvote'];
create.prettyName = 'Create Vote';
create.help = 'Create a new vote';
create.category = 'Vote';
create.params = [
    {
        name: 'text',
        type: 'string'
    },
    {
        name: 'option 1',
        type: 'string'
    },
    {
        name: 'option 2',
        type: 'string'
    }
];
create.executeViaIntegration = false;
let voteInfo = {};
create.callback = async function(message: Message, text: string, option1: string, option2: string) {
    let channelId = message.channel.id;

    if (voteInfo[channelId]) {
        return 'There\'s already an active vote in this channel! Finish that one first!';
    }

    voteInfo[channelId] = {
        author: message.author,
        text: text,
        options: [
            {
                text: option1,
                votes: 0
            },
            {
                text: option2,
                votes: 0
            }
        ],
        votedUsers: []
    };

    return `> **New Vote**\nA new vote has been created by <@${message.author.id}>\n**${text}**\nOption 1: ${option1}\nOption 2: ${option2}\nType !vote <option> to cast your ballot!`;
}

let voteStr = function(voteObj) {
    return `**${voteObj.text}**\n${voteObj.options[0].text}: ${voteObj.options[0].votes}\n${voteObj.options[1].text}: ${voteObj.options[1].votes}`;
};
let voteWinner = function(voteObj) {
    if (voteObj.options[0].votes > voteObj.options[1].votes) {
        return voteObj.options[0];
    } else if (voteObj.options[1].votes > voteObj.options[0].votes) {
        return voteObj.options[1];
    } else {
        return null;
    }
};

let vote = <IBaseCommand>{};
vote.aliases = ['vote'];
vote.prettyName = 'Cast Vote';
vote.help = 'Cast your vote for the active vote in the channel';
vote.category = 'Vote';
vote.params = [
    {
        name: 'option',
        type: 'string'
    }
];
vote.executeViaIntegration = true;
vote.callback = async function(message: Message, option: string) {
    let channelId = message.channel.id;
    let voteObj = voteInfo[channelId];
    
    if (!voteInfo[channelId]) {
       return 'There\'s not an active vote! You should start one!';
    }

    if (voteInfo[channelId].votedUsers.indexOf(message.author.id) > -1) {
        return 'You\'ve already voted in this vote!';
    }

    if (option == '1') {
        voteObj.options[0].votes += 1;
    } else if (option == '2') {
        voteObj.options[1].votes += 1;
    } else {
        let optionObj = voteObj.options.find(obj => obj.text === option);
        if (optionObj) {
            optionObj.votes += 1;
        } else {
            return 'Invalid option!';
        }
    }

    let ch = <TextChannel>message.channel;
    ch.bulkDelete([message]);

    voteObj.votedUsers.push(message.author.id);

    return '> **New Cast**\nA new vote has been cast!\n' + voteStr(voteObj);
};

let deleteVote = <IBaseCommand>{};
deleteVote.aliases = ['endvote'];
deleteVote.prettyName = 'End Vote';
deleteVote.help = 'Ends the active vote in the channel';
deleteVote.category = 'Vote';
deleteVote.executeViaIntegration = false;
deleteVote.callback = async function(message: Message) {
    let voteObj = voteInfo[message.channel.id];

    if (!voteObj) {
        return 'There\'s no active vote!';
    }

    voteInfo[message.channel.id] = null;

    let winner = voteWinner(voteObj);
    if (winner === null) {
        winner = {
            text: 'Tie',
            votes: voteObj.options[0].votes
        }
    }

    return `> **Vote Ended**\nThe active vote has been ended!\n${voteStr(voteObj)}\nWinner: ${winner.text} with ${winner.votes} votes`;
};

export let commands = [create, vote, deleteVote];
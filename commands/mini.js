let fs = require('fs');

let stb = {};
stb.aliases = ['stb', 'spin'];
stb.prettyName = 'Spin The Bottle';
stb.help = 'Spin the bottle';
stb.params = []
stb.callback = function(message) {
    // Get members who are online, not bots
    let members = message.member.guild.members.cache.array().filter(member => {
        return member.presence.status == 'online' && !member.user.bot && member.id != message.author.id
    });

    if (members.length == 0) {
        return;
    }

    // Random member
    let member = members[Math.floor(Math.random() * members.length)];

    return `<@${message.author.id}>, you spun <@${member.id}>`;
}

let truths = [];
let dares = [];

let truth = {};
truth.aliases = ['truth'];
truth.prettyName = 'Truth';
truth.help = 'Get a random truth';
truth.params = []
truth.callback = function(message) {
    return `> <@${message.author.id}> chose truth\n` + truths[Math.floor(Math.random() * truths.length)];
}

let dare = {};
dare.aliases = ['dare'];
dare.prettyName = 'Dare';
dare.help = 'Get a random dare';
dare.params = []
dare.callback = function(message) {
    return  `> <@${message.author.id}> chose dare\n` + dares[Math.floor(Math.random() * dares.length)];
}

module.exports.addHooks = function(client) {
    client.on('ready', () => {
        let truthText = fs.readFileSync('assets/truths.txt').toString('utf-8');;
        truths = truthText.split('\n');

        let dareText = fs.readFileSync('assets/dares.txt').toString('utf-8');;
        dares = dareText.split('\n');
    })
}

module.exports.commands = [stb, truth, dare]
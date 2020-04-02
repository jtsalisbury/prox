let gameQueue = new Map();

function getGame(guildId) {
    let game = gameQueue.get(guildId);

    return game;
}

function newGame(message, startingUser) {
    let game = {
        guild: message.guild.id,
        channel: message.channel,
        guesses: {},
        requiredLetters: {},
        startingUser: startingUser,
        word: '',
    }

    gameQueue.set(message.guild.id, game);
}

function startGame(guildId, word) {
    let game = getGame(guildId);

    game.word = word;
    [...word].forEach(char => {
        if (char.match(/[A-Z|a-z|ü|é]/i)) {
            game.requiredLetters[char] = false;        
        }
    })

    global.cbot.sendMessage('Okay, here we go! You can guess by sending a single letter, or you can try to guess the whole word.', game.channel);
    print(guildId);
}

function stopGame(guildId) {
    let game = getGame(guildId);

    if (!game) {
        global.cbot.sendError('No hangman game is running!');
    }

    global.cbot.sendMessage(`The hangman game has ended. The word was: ${game.word}`, game.channel);

    gameQueue.delete(guildId);
}

function print(guildId) {
    let game = getGame(guildId);

    if (game == undefined) {
        return;
    }

    let wrong = Object.keys(game.guesses).length;

    let man = '     ——\n';
    man +=    '     |  |\n';
    man +=    `     ${wrong > 0 ? 'o': ' '}  |\n`;
    man +=    `    ${wrong > 5 ? '/' : ' '}${wrong > 1 ? '|' : ' '}${wrong > 6 ? '\\' : ' '} |\n`;
    man +=    `     ${wrong > 2 ? '|' : ' '}  |\n`;
    man +=    `    ${wrong > 3 ? '/' : ' '} ${wrong > 4 ? '\\' : ' '} |\n`;
    man +=    `        |\n`;
    man +=    `—————————`;

    let guesses = Object.keys(game.guesses).join(', ');
    let word = '';

    for (let i = 0; i < game.word.length; i++) {
        word += ' ';

        let letter = game.word[i];

        if (game.requiredLetters[letter] !== undefined) {
            if (game.requiredLetters[letter]) {
                word += letter;
            } else {
                word += '_';
            }
        } else {
            word += letter;
        }
    }
    word = word.substr(1);

    let combined = `\`\`\`${man}\`\`\`\`\`\`Guesses: ${guesses}\nPhrase: ${word}\`\`\``;
    global.cbot.sendMessage(combined, game.channel);
}

function guess(message) {
    let game = getGame(message.guild.id);

    if (game.guesses[message.content]) {
        global.cbot.sendMessage('Somebody already guessed that!', message.channel);
        print(message.guild.id);
        return;
    }

    if (message.content == game.word) {
        stopGame(message.guild.id);
        global.cbot.sendMessage(`Whoa! That was a great guess! Congrats to <@${message.author.id}> for guessing the word!`, message.channel);
    } else if (game.requiredLetters[message.content] != undefined) {
        if (game.requiredLetters[message.content] == false) {
            global.cbot.sendMessage('Nice guess!', message.channel);
            game.requiredLetters[message.content] = true;
        } else {
            global.cbot.sendMessage('Somebody already guessed that!', message.channel);
        }
    } else {
        game.guesses[message.content] = true;
        global.cbot.sendMessage('Not quite!', message.channel);
    }
    
    let allTrue = true;
    Object.values(game.requiredLetters).forEach(v => {
        if (v == false) {
            allTrue = false;
        }
    })

    if (allTrue) {
        stopGame(message.guild.id);
        global.cbot.sendMessage('Congrats! You guessed the word!', message.channel);
    }

    if (Object.keys(game.guesses).length == 7) {
        stopGame(message.guild.id);
        global.cbot.sendMessage(`You've lost :&(`, message.channel);
    }

    print(message.guild.id);
}

let hangman = {};
hangman.aliases = ['hangman'];
hangman.prettyName = 'Hangman';
hangman.help = 'Controls hangman';
hangman.params = [
    {
        name: 'action (start, end)',
        type: 'string'
    }
];
hangman.callback = function(message, action) {
    if (action == 'create') {
        if (getGame(message.guild.id)) {
            global.cbot.sendError('A hangman game is already going on!');
        }

        newGame(message, message.author);

        global.cbot.sendMessage('Okay, let\'s get this game started! I need you to send me the word you want to use', message.author);
        global.cbot.sendMessage(`Alright <@${message.author.id}>, I've sent you a DM. Please respond there to start the game!`, message.channel);
    } else if (action == 'stop') {
        stopGame(message.guild.id)
    }
}
module.exports.addHooks = function(bot, discord) {
    discord.on('message', message => {
        // check for a DM
        if (message.guild === null) {
            let user = message.author;

            gameQueue.forEach((value, key) => {
                if (value.startingUser == user && value.word == '') {
                    startGame(key, message.content);
                }
            })
        } else {
            let game = getGame(message.guild.id);

            if (game) {
                if (message.content.length === 1 || message.content.length == game.word.length) {
                    guess(message);
                }
            }
        }
    });
}

module.exports.commands = [hangman];
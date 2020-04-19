let CommandHandler = require('@models/CommandHandler');
let MessageService = require('@services/message');

let gameQueue = new Map();

// Returns the current game info for a server
function getGame(guildId) {
    let game = gameQueue.get(guildId);

    return game;
}

// Create a new game for a server
function newGame(message, startingUser) {
    let game = {
        guild: message.guild.id,
        channel: message.channel,
        guesses: {},
        requiredLetters: {},
        startingUser: startingUser,
        word: ''
    }

    gameQueue.set(message.guild.id, game);
}

function validateWord(word) {
    let valid = false;

    // Look for at least one valid character
    [...word].forEach(char => {
        if (char.match(/[A-Za-z]/i)) {
            valid = true;
        }
    })

    return valid;
}

// Start the game
function startGame(guildId, word) {
    let game = getGame(guildId);

    // Change to lowercase
    game.word = game.word;

    // Add each letter as required
    game.word = word;
    [...word].forEach(char => {
        if (char.match(/[A-Za-z]/i)) {
            game.requiredLetters[char.toLowerCase()] = false;        
        }
    })

    MessageService.sendMessage('Okay, here we go! You can guess by sendMessageing a single letter, or you can try to guess the whole word', game.channel);
    print(guildId);
}

// Stop the game
function stopGame(guildId, channel) {
    let game = getGame(guildId);

    if (!game) {
        MessageService.sendMessage('No hangman game is running', channel);
        return;
    }

    MessageService.sendMessage(`The hangman game has ended. The word was: ${game.word}`, channel);

    gameQueue.delete(guildId);
}

// Print the hangman, guesses and the word
function print(guildId) {
    let game = getGame(guildId);

    if (game == undefined) {
        return;
    }

    // Format the hangman
    let wrong = Object.keys(game.guesses).length;

    let man = '     ——\n';
    man +=    '     |  |\n';
    man +=    `     ${wrong > 0 ? 'o': ' '}  |\n`;
    man +=    `    ${wrong > 5 ? '/' : ' '}${wrong > 1 ? '|' : ' '}${wrong > 6 ? '\\' : ' '} |\n`;
    man +=    `     ${wrong > 2 ? '|' : ' '}  |\n`;
    man +=    `    ${wrong > 3 ? '/' : ' '} ${wrong > 4 ? '\\' : ' '} |\n`;
    man +=    `        |\n`;
    man +=    `—————————`;

    // Format the guesses
    let guesses = Object.keys(game.guesses).join(', ');
    let word = '';

    // Format the word
    for (let i = 0; i < game.word.length; i++) {
        word += ' ';

        let letter = game.word[i].toLowerCase();

        // Determine whether we are dealing with a letter or not
        if (game.requiredLetters[letter] !== undefined) {
            if (game.requiredLetters[letter]) {
                word += game.word[i];
            } else {
                // Print a slot for non-guessed letters
                word += '_';
            }
        } else {
            // Include non-letters
            word += letter;
        }
    }
    word = word.substr(1);

    // Combine the message
    let combined = `\`\`\`${man}\`\`\`\`\`\`Guesses: ${guesses}\nPhrase: ${word}\`\`\``;
    MessageService.sendMessage(combined, game.channel);
}

function guess(message) {
    let game = getGame(message.guild.id);
    let guess = message.content.toLowerCase();

    // If we've already made an incorrect guess
    if (game.guesses[guess]) {
        MessageService.sendMessage('Somebody already guessed that!', message.channel);
        print(message.guild.id);
        return;
    }

    // If the word equals the guess
    if (guess == game.word.toLowerCase()) {
        stopGame(message.guild.id, message.channel);
        MessageService.sendMessage(`Whoa! That was a great guess! Congrats to <@${message.author.id}> for guessing the word!`, message.channel);
    } else if (game.requiredLetters[guess] != undefined) {
        // If the guess is a required letter, determine if it's been guessed or not
        if (game.requiredLetters[guess] == false) {
            MessageService.sendMessage('Nice guess!', message.channel);
            game.requiredLetters[guess] = true;
        } else {
            MessageService.sendMessage('Somebody already guessed that!', message.channel);
        }
    } else {
        // Incorrect guess
        game.guesses[guess] = true;
        MessageService.sendMessage('Not quite!', message.channel);
    }
    
    // Determine if all the letters have been guessed
    let allTrue = true;
    Object.values(game.requiredLetters).forEach(v => {
        if (v == false) {
            allTrue = false;
        }
    })

    if (allTrue) {
        stopGame(message.guild.id, message.channel);
        MessageService.sendMessage('Congrats! You guessed the word!', message.channel);
    }

    // We lost :$(
    if (Object.keys(game.guesses).length == 7) {
        stopGame(message.guild.id, message.channel);
        MessageService.sendMessage(`You've lost :&(`, message.channel);
    }

    print(message.guild.id);
}

let hangman = {};
hangman.aliases = ['hangman'];
hangman.prettyName = 'Hangman';
hangman.help = 'Controls hangman';
hangman.params = [
    {
        name: 'action (create, stop)',
        type: 'string'
    }
];
hangman.callback = function(message, action) {
    if (action == 'create') {
        if (getGame(message.guild.id)) {
            return 'A hangman game is already going on!';
        }

        newGame(message, message.author);

        MessageService.sendMessage('Okay, let\'s get this game started! I need you to sendMessage me the word you want to use', message.author);
        return `Alright <@${message.author.id}>, I've sent you a DM. Please respond there to start the game!`;
    } else if (action == 'stop') {
        stopGame(message.guild.id, message.channel)
    }
}

module.exports.addHooks = function(client) {
    client.on('message', message => {
        if (message.author.bot) {
            return;
        }

        // check for a DM
        if (message.guild === null) {
            let user = message.author;

            // Search for a game that hasn't started yet
            gameQueue.forEach((value, key) => {
                if (value.startingUser == user && value.word == '') {
                    if (validateWord(message.content)) {
                        startGame(key, message.content);
                    } else {
                        MessageService.sendMessage('That word isn\'t valid! We need at least one character', message.author);
                    }
                }
            })
        } else {
            let game = getGame(message.guild.id);

            // Start the process of guessing if we are doing a character or the word
            if (game) {
                if (message.content.length === 1 || message.content.length === game.word.length) {
                    guess(message);
                }
            }
        }
    });
}

module.exports.commands = [hangman];
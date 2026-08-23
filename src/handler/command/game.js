const sendToChat = require('../../utils/sendToChat');
const fs = require('fs');
const path = require('path');
const imagePath = path.join(__dirname, '../../assets/game2.jpg');
let imageBuffer = null;
const { registerCommand } = require('./commandRegistry');

if (fs.existsSync(imagePath)) {
  imageBuffer = fs.readFileSync(imagePath);
}
function gamePreview(customTitle = '', customBody = '') {
    return {
        externalAdReply: {
            title: customTitle || "🎮 Word Chain Game",
            body: customBody || "Powered by BMM",
            thumbnail: imageBuffer,       // must be a Buffer
            mediaType: 1,                 // 1 = image
            renderLargerThumbnail: true,
            showAdAttribution: false
        }
    };
}

// Game states
const games = new Map();

class WordChainGame {
    constructor(groupId) {
        this.players = new Set();
        this.isActive = false;
        this.currentWord = '';
        this.currentPlayer = null;
        this.usedWords = new Set();
        this.timeoutId = null;
        this.registrationId = null;
        this.groupId = groupId;
        this.registrationOpen = false;
        this.scores = new Map(); // Add scores tracking
        this.roundNumber = 0; // Track rounds
    }

    // Add helper methods for score management
    addPlayer(playerId) {
        this.players.add(playerId);
        this.scores.set(playerId, {
            points: 0,
            wordsUsed: 0,
            longestWord: '',
        });
    }

    updateScore(playerId, word) {
        const playerScore = this.scores.get(playerId);
        if (playerScore) {
            // Points: 1 base point + bonus for word length
            const lengthBonus = Math.floor(word.length / 3);
            const points = 1 + lengthBonus;
            
            playerScore.points += points;
            playerScore.wordsUsed++;
            if (word.length > (playerScore.longestWord?.length || 0)) {
                playerScore.longestWord = word;
            }
        }
    }

    getScoreBoard() {
        return Array.from(this.scores.entries())
            .sort((a, b) => b[1].points - a[1].points)
            .map((entry, index) => {
                const [playerId, score] = entry;
                return {
                    position: index + 1,
                    playerId,
                    ...score
                };
            });
    }
}

// Update the function signature to handle the message properly
async function handleGameCommand(sock, msg, args) {
    // Early validation of required parameters
    if (!msg?.key?.remoteJid) {
        console.error('Invalid message object in handleGameCommand:', msg);
        return;
    }

    const groupId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const messageText = msg.message?.conversation || 
                       msg.message?.extendedTextMessage?.text || '';
    
    if (!groupId.endsWith('@g.us')) {
        return sock.sendMessage(groupId, { 
            text: '❌ Games can only be played in groups!' 
        });
    }

    const command = args[0]?.toLowerCase();

    switch(command) {
        case 'wordchain':
            return createGame(sock, groupId, sender);
        case 'start':
            return startGame(sock, groupId, sender);
        case 'end':
            return endGame(sock, groupId, sender);
        default:
            // If game is active, check for word submissions
            const game = games.get(groupId);
            if (game?.isActive) {
                // Pass the full message text instead of splitting
                return handleWordChain(sock, msg, messageText);
            }
            return sendGameHelp(sock, groupId);
    }
}

async function createGame(sock, groupId, sender) {
    if (games.has(groupId)) {
        return sock.sendMessage(groupId, {
            text: '❌ A game is already in progress!'
        });
    }

    const game = new WordChainGame(groupId);
    games.set(groupId, game);
    game.registrationOpen = true;
    
    // Automatically add the command caller
    game.addPlayer(sender); 

    try {

        const textMsg =
`🎮 *New Word Chain Game*

👤 Created by: @${sender.split('@')[0]}
👥 Players (${game.players.size}):
└─ @${sender.split('@')[0]}

📝 *How to Join:*
Reply to this message with "join"

⏰ Waiting 60 seconds for more players...
ℹ️ Game starts automatically when time's up
🎯 Minimum players: 2`;
        
        // ✅ Notice contextInfo here
        const regMsg = await sock.sendMessage(groupId, {
            text: textMsg,
            mentions: [sender],
            contextInfo: gamePreview("🎮 Word Chain Game", "Join the fun! Test your vocabulary")
        });

        game.registrationId = regMsg.key.id;
        game.timeoutId = setTimeout(() => checkRegistration(sock, groupId), 60000);

    } catch (error) {
        console.error('Error creating game:', error);
        games.delete(groupId);
        return sock.sendMessage(groupId, {
            text: '❌ Failed to create game. Please try again.'
        });
    }
}

async function handleReply(sock, msg) {
    const groupId = msg.key.remoteJid;
    const game = games.get(groupId);
    
    // Early return if no game or not in registration
    if (!game || !game.registrationOpen) return false;

    // Check if message is a reply
    if (!msg.message?.extendedTextMessage?.contextInfo?.stanzaId) return false;

    // Check if reply is to our game registration message
    const quotedMsg = msg.message.extendedTextMessage.contextInfo.stanzaId;
    if (quotedMsg !== game.registrationId) return false;

    const sender = msg.key.participant || msg.key.remoteJid;
    const replyText = msg.message.extendedTextMessage.text?.toLowerCase();

    // Only handle "join" replies
    if (replyText !== 'join') return false;

    if (game.players.has(sender)) {
        await sock.sendMessage(groupId, {
            text: '❌ You have already joined!',
            quoted: msg
        });
        return true;
    }

    game.addPlayer(sender); 
    
    // Show updated player list
    const playerList = Array.from(game.players)
        .map(p => `└─ @${p.split('@')[0]}`)
        .join('\n');

    await sock.sendMessage(groupId, {
        text: `✅ @${sender.split('@')[0]} joined the game!\n\n` +
              `👥 Players (${game.players.size}):\n${playerList}\n\n` +
              `⏰ Waiting for more players... (${Math.ceil((game.timeoutId._idleStart + game.timeoutId._idleTimeout - Date.now())/1000)}s)`,
        mentions: Array.from(game.players)
    });

    // Don't auto-start, wait for registration period to end
    return true;
}

async function checkRegistration(sock, groupId) {
    const game = games.get(groupId);
    if (!game) return;

    if (game.players.size < 2) {
        await sock.sendMessage(groupId, {
            text: '❌ Not enough players joined. Game cancelled!',
            mentions: Array.from(game.players)
        });
        games.delete(groupId);
    } else {
        // Always start after timeout if enough players
        await startGame(sock, groupId);
    }
}

async function endGame(sock, groupId, sender) {
    const game = games.get(groupId);
    if (!game) {
        return sock.sendMessage(groupId, {
            text: '❌ No active game to end!'
        });
    }

    clearTimeout(game.timeoutId);
    clearTimeout(game.registrationId);
    
    if (game.isActive) {
        // Show final stats before ending
        await showGameStats(sock, groupId, game);
    }
    
    await sock.sendMessage(groupId, {
        text: '🛑 Game ended by admin/owner!'
    });
    
    games.delete(groupId);
}

async function sendGameHelp(sock, groupId) {
    await sock.sendMessage(groupId, {
        text: `🎮 *Word Chain Game Commands*\n\n` +
                `1️⃣ *.game wordchain*\n` +
                `   ┗ Create a new game\n\n` +
                `2️⃣ *Reply "join" to game message*\n` +
                `   ┗ Join an open game\n\n` +
                `3️⃣ *.game end*\n` +
                `   ┗ End current game\n\n` +
                `📝 *How to Play:*\n` +
                `• Say a word that starts with the last letter of previous word\n` +
                `• No repeating words\n` +
                `• 30 seconds time limit per turn\n` +
                `• Last player standing wins!`
    });
}

async function startGame(sock, groupId) {
    const game = games.get(groupId);
    if (!game || game.isActive) return;

    game.registrationOpen = false;
    game.isActive = true;
    game.currentPlayer = Array.from(game.players)[0];
    
    const startingWords = ['game', 'start', 'play', 'begin', 'ready'];
    game.currentWord = startingWords[Math.floor(Math.random() * startingWords.length)];

    await sock.sendMessage(groupId, {
        text: `🎮 *Game Started!*\n\n` +
              `👥 Players: ${Array.from(game.players).map(p => `@${p.split('@')[0]}`).join(', ')}\n\n` +
              `📝 Starting word: *${game.currentWord}*\n` +
              `➤ First player: @${game.currentPlayer.split('@')[0]}\n` +
              `❗ Say a word that starts with "${game.currentWord[game.currentWord.length - 1]}"\n` +
              `⏰ You have 30 seconds to respond!`,
        mentions: Array.from(game.players)
    });

    game.timeoutId = setTimeout(() => playerTimeout(sock, groupId), 30000);
}

async function handleWordChain(sock, msg, word) {
    const groupId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const game = games.get(groupId);

    if (!game || !game.isActive) return;
    if (sender !== game.currentPlayer) return;

    // Get word from different possible message types
    let newWord;
    
    // 1. Check if it's a reply
    if (msg.message?.extendedTextMessage?.text) {
        newWord = msg.message.extendedTextMessage.text.trim().split(' ')[0].toLowerCase();
    }
    // 2. Check direct message
    else if (msg.message?.conversation) {
        newWord = msg.message.conversation.trim().split(' ')[0].toLowerCase();
    }
    // 3. Check if word passed as argument
    else if (typeof word === 'string') {
        newWord = word.trim().toLowerCase();
    }

    if (!newWord) return;

    // Word validation
    if (newWord.length < 2) {
        await sock.sendMessage(groupId, {
            text: '❌ Word must be at least 2 letters long!',
            quoted: msg
        });
        return;
    }

    // Check if word starts with last letter of previous word
    if (game.currentWord && newWord[0] !== game.currentWord[game.currentWord.length - 1]) {
        await sock.sendMessage(groupId, {
            text: `❌ Word must start with "${game.currentWord[game.currentWord.length - 1]}"!\n` +
                  `Current word: *${game.currentWord}*`,
            quoted: msg
        });
        return;
    }

    // Check if word was already used
    if (game.usedWords.has(newWord)) {
        await sock.sendMessage(groupId, {
            text: '❌ Word already used in this game!',
            quoted: msg
        });
        return;
    }

    // Valid move
    game.usedWords.add(newWord);
    game.currentWord = newWord;
    game.roundNumber++; // Increment round number
    game.updateScore(sender, newWord); // Update player's score
    
    // Next player
    const players = Array.from(game.players);
    const currentIndex = players.indexOf(game.currentPlayer);
    game.currentPlayer = players[(currentIndex + 1) % players.length];

    clearTimeout(game.timeoutId);
    game.timeoutId = setTimeout(() => playerTimeout(sock, groupId), 30000);

    await sock.sendMessage(groupId, {
        text: `✅ "${newWord}"\n\n` +
              `➤ Next: @${game.currentPlayer.split('@')[0]}\n` +
              `❗ Say a word that starts with "*${newWord[newWord.length - 1]}*"\n` +
              `⏰ 30 seconds to respond!`,
        mentions: [game.currentPlayer]
    });
}

async function playerTimeout(sock, groupId) {
    const game = games.get(groupId);
    if (!game || !game.isActive) return;

    await sock.sendMessage(groupId, {
        text: `⏰ Time's up! @${game.currentPlayer.split('@')[0]} has been eliminated!`,
        mentions: [game.currentPlayer]
    });

    game.players.delete(game.currentPlayer);

    if (game.players.size <= 1) {
        const winner = Array.from(game.players)[0];
        // Show winner announcement
        await sock.sendMessage(groupId, {
            text: `🎉 Game Over!\n\n👑 Winner: @${winner.split('@')[0]}`,
            mentions: [winner]
        });
        // Show final stats
        await showGameStats(sock, groupId, game, winner);
        games.delete(groupId);
    } else {
        game.currentPlayer = Array.from(game.players)[0];
        await sock.sendMessage(groupId, {
            text: `➤ Next: @${game.currentPlayer.split('@')[0]}\n⏰ 30 seconds to respond!`,
            mentions: [game.currentPlayer]
        });
        game.timeoutId = setTimeout(() => playerTimeout(sock, groupId), 30000);
    }
}

// Add showGameStats function after playerTimeout
async function showGameStats(sock, groupId, game, winner = null) {
    const scoreBoard = game.getScoreBoard();
    const totalRounds = game.roundNumber;

    let statsMessage = `🎮 *Word Chain Game Stats*\n`;
    statsMessage += `└─ Total Rounds: ${totalRounds}\n\n`;
    
    if (winner) {
        statsMessage += `👑 *Winner: @${winner.split('@')[0]}*\n\n`;
    }

    statsMessage += `📊 *Final Scores:*\n`;
    scoreBoard.forEach(score => {
        statsMessage += `${score.position}. @${score.playerId.split('@')[0]}\n`;
        statsMessage += `   ├─ Points: ${score.points}\n`;
        statsMessage += `   ├─ Words: ${score.wordsUsed}\n`;
        statsMessage += `   └─ Longest: ${score.longestWord}\n`;
    });

    await sock.sendMessage(groupId, {
        text: statsMessage,
        mentions: scoreBoard.map(score => score.playerId)
    });
}

registerCommand('game', {
    description: 'Play word chain game with friends',
    usage: 'game [wordchain|start|end]',
    category: 'Game',
    examples: [
        'game wordchain - Start new word chain game',
        'game end - End current game'
    ],
    aliases: ['chain', 'wordgame'],
    longDescription: `A multiplayer word chain game where players take turns saying words.\n` +
                    `Each word must start with the last letter of the previous word.\n` +
                    `Features:\n` +
                    `• Score tracking\n` +
                    `• Word validation\n` +
                    `• Time limits\n` +
                    `• Multiple players`
});

// Update module exports
module.exports = { 
    handleGameCommand, 
    handleReply,
    handleWordChain,
    games,
    gamePreview // Export the games Map
};
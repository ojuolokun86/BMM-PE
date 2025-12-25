const axios = require('axios');
const sendToChat = require('../../utils/sendToChat');
const { gamePreview } = require('./game');
const { registerCommand } = require('./commandRegistry');

// Game states
const triviaGames = new Map();

class TriviaGame {
    constructor(groupId) {
        this.players = new Map(); // playerId -> score
        this.currentQuestion = null;
        this.questions = [];
        this.currentRound = 0;
        this.totalRounds = 10;
        this.isActive = false;
        this.groupId = groupId;
        this.timeoutId = null;
        this.category = null;
        this.difficulty = null;
        this.answerTimeout = 30000; // 30 seconds per question
    }

    addPlayer(playerId) {
        if (!this.players.has(playerId)) {
            this.players.set(playerId, {
                score: 0,
                correctAnswers: 0,
                wrongAnswers: 0,
                streak: 0
            });
        }
    }

    updateScore(playerId, isCorrect) {
        const player = this.players.get(playerId);
        if (player) {
            if (isCorrect) {
                const streakBonus = Math.min(player.streak * 0.5, 2);
                const difficultyMultiplier = 
                    this.difficulty === 'hard' ? 3 :
                    this.difficulty === 'medium' ? 2 : 1;
                
                const points = (10 + streakBonus) * difficultyMultiplier;
                player.score += points;
                player.correctAnswers++;
                player.streak++;
            } else {
                player.wrongAnswers++;
                player.streak = 0;
            }
        }
    }

    getLeaderboard() {
        return Array.from(this.players.entries())
            .sort(([, a], [, b]) => b.score - a.score)
            .map(([playerId, stats], index) => ({
                position: index + 1,
                playerId,
                ...stats
            }));
    }
}

const categories = {
    GENERAL: 9,
    BOOKS: 10,
    FILM: 11,
    MUSIC: 12,
    THEATRE: 13,
    TV: 14,
    GAMING: 15,
    SPORTS: 21,
    GEOGRAPHY: 22,
    HISTORY: 23,
    SCIENCE: 17,
    COMPUTERS: 18,
    MATHEMATICS: 19,
    MYTHOLOGY: 20
};

async function fetchQuestions(category = null, difficulty = null) {
    try {
        let url = 'https://opentdb.com/api.php?amount=10&type=multiple';
        if (category) url += `&category=${category}`;
        if (difficulty) url += `&difficulty=${difficulty}`;

        const response = await axios.get(url);
        if (response.data.response_code === 0) {
            return response.data.results;
        }
        throw new Error('Failed to fetch questions');
    } catch (error) {
        console.error('Error fetching trivia questions:', error);
        throw error;
    }
}

async function handleTrivia(sock, msg, args) {
    const groupId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    if (!groupId.endsWith('@g.us')) {
        return sock.sendMessage(groupId, {
            text: '❌ Trivia can only be played in groups!'
        });
    }

    const subCommand = args[0]?.toLowerCase();

    switch (subCommand) {
        case 'start':
            return startTrivia(sock, groupId, sender, args.slice(1));
        case 'join':
            return joinTrivia(sock, groupId, sender);
        case 'stop':
            return stopTrivia(sock, groupId, sender);
        default:
            return showTriviaHelp(sock, groupId);
    }
}

async function startTrivia(sock, groupId, sender, args) {
    if (triviaGames.has(groupId)) {
        return sock.sendMessage(groupId, {
            text: '❌ A trivia game is already in progress!'
        });
    }

    const game = new TriviaGame(groupId);
    triviaGames.set(groupId, game);
    game.addPlayer(sender); // Add creator as first player

    try {
        const category = args[0]?.toUpperCase();
        const difficulty = args[1]?.toLowerCase();

        if (category && categories[category]) {
            game.category = categories[category];
        }
        if (['easy', 'medium', 'hard'].includes(difficulty)) {
            game.difficulty = difficulty;
        }
        
        const registrationMsg = await sock.sendMessage(groupId, {
            text: `🎯 *New Trivia Game*\n\n` +
                  `👤 Created by: @${sender.split('@')[0]}\n` +
                  `📚 Category: ${category || 'Random'}\n` +
                  `⭐ Difficulty: ${difficulty || 'Random'}\n\n` +
                  `*How to Join:*\n` +
                  `Reply to this message with "join"\n\n` +
                  `⏰ Registration closes in 60 seconds\n` +
                  `🎮 Game starts automatically`,
            mentions: [sender],
            contextInfo: gamePreview("🎯 Trivia Game",  "Join now!")
        });

        game.registrationId = registrationMsg.key.id;
        game.timeoutId = setTimeout(() => startTriviaRounds(sock, groupId), 60000);

    } catch (error) {
        console.error('Error starting trivia:', error);
        triviaGames.delete(groupId);
        return sock.sendMessage(groupId, {
            text: '❌ Failed to start trivia game!'
        });
        
    }
}

async function handleTriviaReply(sock, msg) {
    if (!msg?.key?.remoteJid) return false;
    
    const groupId = msg.key.remoteJid;
    const game = triviaGames.get(groupId);
    const sender = msg.key.participant || msg.key.remoteJid;
    
    // If no game or sender is invalid
    if (!game || !sender) return false;

    // Handle registration phase replies
    if (!game.isActive && game.registrationId) {
        return handleRegistrationReply(sock, msg, game, sender);
    }

    // Handle answer phase replies
    if (game.isActive && game.currentQuestion) {
        return handleAnswerReply(sock, msg, game, sender);
    }

    return false;
}

async function handleRegistrationReply(sock, msg, game, sender) {
    // Check if message is replying to registration message
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (quotedMsg !== game.registrationId) return false;

    const replyText = msg.message?.extendedTextMessage?.text?.toLowerCase();
    if (replyText !== 'join') return false;

    // Check if player already joined
    if (game.players.has(sender)) {
        await sock.sendMessage(game.groupId, {
            text: '❌ You have already joined the game!',
            quotedMessage: msg
        });
        return true;
    }

    // Add new player
    game.addPlayer(sender);
    
    // Show updated player list
    const playerList = Array.from(game.players.keys())
        .map(playerId => `└─ @${playerId.split('@')[0]}`)
        .join('\n');

    await sock.sendMessage(game.groupId, {
        text: `✅ @${sender.split('@')[0]} joined the game!\n\n` +
              `👥 Players (${game.players.size}):\n${playerList}`,
        mentions: Array.from(game.players.keys())
    });

    return true;
}

async function handleAnswerReply(sock, msg, game, sender) {
    if (!game.currentQuestion) return false;

    // Check if it's this player's turn
    if (sender !== game.currentQuestion.currentPlayer) {
        return false;
    }

    const answer = msg.message?.conversation?.trim().toUpperCase() || 
                  msg.message?.extendedTextMessage?.text?.trim().toUpperCase();

    if (!['A', 'B', 'C', 'D'].includes(answer)) return false;

    const answerIndex = answer.charCodeAt(0) - 65;
    const isCorrect = answerIndex === game.currentQuestion.correctIndex;

    // Update score
    game.updateScore(sender, isCorrect);
    const playerScore = game.players.get(sender);

    await sock.sendMessage(game.groupId, {
        text: `${isCorrect ? '✅' : '❌'} @${sender.split('@')[0]}: ${answer}\n` +
              `${isCorrect ? '🎯 Correct!' : '❌ Wrong!'}\n` +
              `📊 Score: ${playerScore.score} points\n` +
              `📈 Streak: ${playerScore.streak}`,
        mentions: [sender]
    });

    if (isCorrect) {
        // Show current scores
        const scores = game.getLeaderboard()
            .map(p => `@${p.playerId.split('@')[0]}: ${p.score} pts`)
            .join('\n');

        await sock.sendMessage(game.groupId, {
            text: `📊 *Current Scores:*\n${scores}`,
            mentions: Array.from(game.players.keys())
        });

        // Find next player for the next question
        // Get the player after the current one in the rotation
        const players = Array.from(game.players.keys());
        const currentIndex = players.indexOf(sender);
        const nextStartingPlayer = players[(currentIndex + 1) % players.length];
        
        // Store next starting player for the next question
        game.nextStartingPlayer = nextStartingPlayer;
        
        // Move to next question
        game.currentRound++;
        clearTimeout(game.timeoutId);
        setTimeout(() => sendNextQuestion(sock, game.groupId), 2000);
    } else {
        // Wrong answer - move to next player in current question
        const players = Array.from(game.players.keys());
        const currentIndex = players.indexOf(sender);
        const nextPlayer = players[(currentIndex + 1) % players.length];

        game.currentQuestion.answeredBy.add(sender);

        // Check if all players have attempted
        if (game.currentQuestion.answeredBy.size >= game.players.size) {
            const correctLetter = ['A', 'B', 'C', 'D'][game.currentQuestion.correctIndex];
            const correctAnswer = game.currentQuestion.options[game.currentQuestion.correctIndex];
            
            await sock.sendMessage(game.groupId, {
                text: `❌ No one got it right!\n\n` +
                      `✅ Correct answer was: ${correctLetter}\n` +
                      `📝 ${decodeHTMLEntities(correctAnswer)}\n\n` +
                      `Moving to next question...`
            });

            // Use the stored next starting player
            game.nextStartingPlayer = nextPlayer;
            game.currentRound++;
            clearTimeout(game.timeoutId);
            setTimeout(() => sendNextQuestion(sock, game.groupId), 2000);
        } else {
            game.currentQuestion.currentPlayer = nextPlayer;
            await sock.sendMessage(game.groupId, {
                text: `➡️ Next try: @${nextPlayer.split('@')[0]}\n` +
                      `❓ Same question\n` +
                      `⏰ 30 seconds to answer!`,
                mentions: [nextPlayer]
            });

            clearTimeout(game.timeoutId);
            game.timeoutId = setTimeout(() => handleQuestionTimeout(sock, game.groupId), 30000);
        }
    }

    return true;
}

// Add to startTriviaRounds function
async function startTriviaRounds(sock, groupId) {
    const game = triviaGames.get(groupId);
    if (!game || game.players.size < 1) {
        await sock.sendMessage(groupId, {
            text: '❌ Not enough players to start the game!'
        });
        triviaGames.delete(groupId);
        return;
    }

    game.isActive = true;
    try {
        game.questions = await fetchQuestions(game.category, game.difficulty);
        await sendNextQuestion(sock, groupId);
    } catch (error) {
        console.error('Error starting trivia rounds:', error);
        await sock.sendMessage(groupId, {
            text: '❌ Failed to fetch questions. Game cancelled!'
        });
        triviaGames.delete(groupId);
    }
}

// Add showTriviaHelp function
async function stopTrivia(sock, groupId, sender) {
    const game = triviaGames.get(groupId);
    
    if (!game) {
        return sock.sendMessage(groupId, {
            text: '❌ There is no active trivia game to stop!'
        });
    }

    // Clear any pending timeouts
    if (game.timeoutId) {
        clearTimeout(game.timeoutId);
        game.timeoutId = null;
    }

    // Remove the game from active games
    triviaGames.delete(groupId);
    
    return sock.sendMessage(groupId, {
        text: '⏹️ The trivia game has been stopped by the host.'
    });
}

async function showTriviaHelp(sock, groupId) {
    const categoryList = Object.keys(categories)
        .map(cat => `├ ${cat.toLowerCase()}`)
        .join('\n');

    const helpText = `🎯 *Trivia Game Commands*\n\n` +
        `1️⃣ *.trivia start [category] [difficulty]*\n` +
        `   ├ Start a new trivia game\n` +
        `   ├ Optional: specify category and difficulty\n` +
        `   └ Example: .trivia start SCIENCE medium\n\n` +
        `2️⃣ *.trivia join*\n` +
        `   └ Join an open game\n\n` +
        `3️⃣ *.trivia stop*\n` +
        `   └ End current game\n\n` +
        `📚 *Available Categories:*\n${categoryList}\n\n` +
        `⭐ *Difficulty Levels:*\n` +
        `├ easy\n` +
        `├ medium\n` +
        `└ hard\n\n` +
        `📝 *How to Play:*\n` +
        `• Answer with A, B, C, or D\n` +
        `• 30 seconds per question\n` +
        `• Streak bonus for consecutive correct answers\n` +
        `• Higher points for harder questions`;

    await sock.sendMessage(groupId, {
        text: helpText,
        contextInfo: gamePreview("🎯 Trivia Game",  "Start a game now!")
    });
}

// Update the sendNextQuestion function
async function sendNextQuestion(sock, groupId) {
    const game = triviaGames.get(groupId);
    if (!game || !game.isActive) return;

    // Check if game is finished
    if (game.currentRound >= game.totalRounds) {
        return endTrivia(sock, groupId);
    }

    const question = game.questions[game.currentRound];
    
    // Shuffle answers and store them
    const options = [
        ...question.incorrect_answers,
        question.correct_answer
    ].sort(() => Math.random() - 0.5);

    // Use the stored next starting player or default to first player
    const startingPlayer = game.nextStartingPlayer || Array.from(game.players.keys())[0];
    game.nextStartingPlayer = null; // Reset for next round

    game.currentQuestion = {
        question: question.question,
        options,
        correctIndex: options.indexOf(question.correct_answer),
        answeredBy: new Set(), // Track who has answered
        currentPlayer: startingPlayer // Set first player
    };

    // Format question text with current player mention
    const questionText = `📝 *Question ${game.currentRound + 1}/${game.totalRounds}*\n\n` +
        `❓ ${decodeHTMLEntities(question.question)}\n\n` +
        options.map((opt, i) => `${['A', 'B', 'C', 'D'][i]}. ${decodeHTMLEntities(opt)}`).join('\n') +
        '\n\n' +
        `👤 Current Player: @${game.currentQuestion.currentPlayer.split('@')[0]}\n` +
        `⏰ 30 seconds to answer!`;

    await sock.sendMessage(groupId, {
        text: questionText,
        mentions: [game.currentQuestion.currentPlayer],
        contextInfo: gamePreview('🎯 Trivia Question', `Round ${game.currentRound + 1}/${game.totalRounds}`)
    });

    // Reset timeout
    clearTimeout(game.timeoutId);
    game.timeoutId = setTimeout(() => handleQuestionTimeout(sock, game.groupId), 30000);
}

async function handleQuestionTimeout(sock, groupId) {
    const game = triviaGames.get(groupId);
    if (!game || !game.isActive) return;

    const currentQ = game.currentQuestion;
    const correctAnswer = currentQ.options[currentQ.correctIndex];

    await sock.sendMessage(groupId, {
        text: `⏰ Time's up!\n\n` +
              `✅ Correct answer: ${['A', 'B', 'C', 'D'][currentQ.correctIndex]}\n` +
              `📝 ${decodeHTMLEntities(correctAnswer)}`
    });

    // Move to next question
    await sendNextQuestion(sock, groupId);
}

async function endTrivia(sock, groupId) {
    const game = triviaGames.get(groupId);
    if (!game) return;

    // Calculate final scores and create leaderboard
    const leaderboard = game.getLeaderboard();
    const winner = leaderboard[0];

    let resultText = `🎯 *Trivia Game Ended!*\n\n`;
    
    if (winner) {
        resultText += `👑 Winner: @${winner.playerId.split('@')[0]}\n` +
                     `📊 Score: ${winner.score} points\n\n`;
    }

    resultText += `🏆 *Final Standings:*\n`;
    leaderboard.forEach((player, index) => {
        resultText += `${index + 1}. @${player.playerId.split('@')[0]}\n` +
                     `   ├ Score: ${player.score}\n` +
                     `   ├ Correct: ${player.correctAnswers}\n` +
                     `   └ Wrong: ${player.wrongAnswers}\n`;
    });

    await sock.sendMessage(groupId, {
        text: resultText,
        mentions: leaderboard.map(p => p.playerId),
        contextInfo: gamePreview('🎯 Trivia Results', 'Game Over!')
    });

    // Clean up game
    clearTimeout(game.timeoutId);
    triviaGames.delete(groupId);
}

function decodeHTMLEntities(text) {
    return text.replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&#039;/g, "'");
}



// Register trivia commands
registerCommand('trivia', {
    description: 'Play a trivia game with various categories',
    usage: 'trivia [start|join|stop] [category] [difficulty]',
    category: 'Game',
    examples: [
        'trivia start SCIENCE medium',
        'trivia join',
        'trivia stop'
    ]
});

module.exports = {
    handleTrivia,
    handleTriviaReply,
    categories,
    showTriviaHelp
};
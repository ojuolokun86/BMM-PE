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

async function sendNextQuestion(sock, groupId) {
    const game = triviaGames.get(groupId);
    if (!game || !game.isActive) return;

    if (game.currentRound >= game.questions.length) {
        return endTrivia(sock, groupId);
    }

    const question = game.questions[game.currentRound];
    const options = [...question.incorrect_answers, question.correct_answer]
        .sort(() => Math.random() - 0.5);

    game.currentQuestion = {
        ...question,
        options,
        correctIndex: options.indexOf(question.correct_answer)
    };

    const questionText = `📝 *Question ${game.currentRound + 1}/${game.totalRounds}*\n\n` +
                        `${decodeHTMLEntities(question.question)}\n\n` +
                        options.map((opt, i) => `${['A', 'B', 'C', 'D'][i]}. ${decodeHTMLEntities(opt)}`).join('\n') +
                        '\n\n⏰ 30 seconds to answer!';

    await sock.sendMessage(groupId, {
        text: questionText,
        contextInfo: getContextInfo({
            title: '🎯 Trivia Question',
            body: `Round ${game.currentRound + 1}`
        })
    });

    game.timeoutId = setTimeout(() => handleQuestionTimeout(sock, groupId), game.answerTimeout);
}

function decodeHTMLEntities(text) {
    return text.replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&#039;/g, "'");
}

// Add to your exports
module.exports = {
    startTriviaRounds,
    sendNextQuestion
};
const { restartBotForUser } = require('../../main/restart');
const { isBotOwner } = require('../../database/database');
const sendToChat = require('../../utils/sendToChat');

const restartState = new Map();

async function restartCommand(authId, sock, msg) {
    const from = msg.key.remoteJid;
    const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
    const botLid = sock.user?.lid?.split(':')[0]?.split('@')[0];
    const sender = msg.key.participant || msg.key.remoteJid;
    const senderId = sender?.split('@')[0];

    if (restartState.has(botId)) {
        return await sendToChat(sock, from, {
            message: `🖥️ [SYSTEM ALERT]: Restart protocol is currently ACTIVE.\n> STATUS: Please wait for completion.`
        });
    }

    if (!msg.key.fromMe && !isBotOwner(senderId, botId, botLid)) {
        return await sendToChat(sock, from, {
            message: `🖥️ [ACCESS DENIED]: Unauthorized restart attempt detected.\n> STATUS: Only root operator may execute this command.`
        });
    }

    try {
        restartState.set(botId, true);

        await sendToChat(sock, from, {
            message: `🖥️ [RESTART SEQUENCE INITIATED]\n> STATUS: Preparing system reboot...\n> EXECUTION: In 5 seconds`
        });

        await new Promise(resolve => setTimeout(resolve, 5000));

        try {
            await sendToChat(sock, from, {
                message: `🖥️ [SYSTEM]: Reboot protocol engaged.\n> PROCESS: Shutting down modules...`
            });
        } catch (e) {
            console.warn('Could not send final restart message:', e.message);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        const { success, error } = await restartBotForUser({
            authId: authId,
            phoneNumber: botId,
            restartType: 'command',
            additionalInfo: `🖥️ [SYSTEM NOTICE]: Restart completed successfully.\n> STATUS: OPERATIONAL`,
            onStatus: async (status) => {
                if (status === 'stopping') {
                    console.log(`[SYSTEM] BOT ${botId}: Shutdown sequence in progress...`);
                } else if (status === 'starting') {
                    console.log(`[SYSTEM] BOT ${botId}: Reinitializing core modules...`);
                } else if (status === 'connected') {
                    console.log(`[SYSTEM] BOT ${botId}: Connection re-established. System online.`);
                    setTimeout(() => {
                        restartState.delete(botId);
                        console.log(`[SYSTEM] BOT ${botId}: Restart state cleared.`);
                    }, 10000);
                }
            }
        });

        if (!success) {
            throw new Error(error || 'Restart protocol failure');
        }

    } catch (error) {
        console.error('Error in restart command:', error);
        restartState.delete(botId);

        try {
            await sendToChat(sock, from, {
                message: `🖥️ [SYSTEM ERROR]: Restart process aborted.\n> REASON: ${error.message}`
            });
        } catch (e) {
            console.error('Could not send error message:', e.message);
        }
    }
}

module.exports = restartCommand;

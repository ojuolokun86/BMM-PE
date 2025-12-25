const { restartBot } = require('../../main/restart');
const { isBotOwner } = require('../../database/database');

const restartState = new Map();

async function restartCommand(authId, sock, msg) {
    const from = msg.key.remoteJid;

    const botId =
        sock.user?.id?.split(':')[0]?.split('@')[0] ||
        sock.user?.lid?.split(':')[0]?.split('@')[0];

    const sender = msg.key.participant || msg.key.remoteJid;
    const senderId = sender?.split('@')[0];

    // Prevent duplicate restarts
    if (restartState.has(botId)) {
        return await sock.sendMessage(from, {
            text: `🖥️ [SYSTEM ALERT]: Restart protocol is currently ACTIVE.\n> STATUS: Please wait for completion.`
        });
    }

    // Permission check
    if (!msg.key.fromMe && !isBotOwner(senderId, botId)) {
        return await sock.sendMessage(from, {
            text: `🖥️ [ACCESS DENIED]: Unauthorized restart attempt detected.\n> STATUS: Only root operator may execute this command.`
        });
    }

    try {
        restartState.set(botId, true);

        await sock.sendMessage(from, {
            text: `🖥️ [RESTART SEQUENCE INITIATED]\n> STATUS: Preparing system reboot...\n> EXECUTION: In 5 seconds`
        });

        await new Promise(r => setTimeout(r, 5000));

        await sock.sendMessage(from, {
            text: `🖥️ [SYSTEM]: Reboot protocol engaged.\n> PROCESS: Shutting down modules...`
        });

        await new Promise(r => setTimeout(r, 1000));

        // 🔄 ACTUAL RESTART (NEW LOGIC)
        restartBot({
            type: 'command',
            additionalInfo: `🖥️ [SYSTEM NOTICE]: Restart completed successfully.\n> STATUS: OPERATIONAL`
        });

    } catch (error) {
        console.error('❌ Error in restart command:', error.message);
        restartState.delete(botId);

        try {
            await sock.sendMessage(from, {
                text: `🖥️ [SYSTEM ERROR]: Restart process aborted.\n> REASON: ${error.message}`
            });
            console.log(`error in restart ${error.message}`)
        } catch {}
    } finally {
        // Safety unlock
        setTimeout(() => {
            restartState.delete(botId);
        }, 15000);
    }
}

module.exports = restartCommand;

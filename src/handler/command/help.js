const { getContextInfo, getForwardedContext } = require('../../utils/contextInfo');
const { commandRegistry, commandsByCategory, version } = require('./commandRegistry');
const sendToChat = require('../../utils/sendToChat');

async function helpCommand(sock, msg, textMsg, prefix, isAdmin = false, isOwner = false) {
    const from = msg.key.remoteJid;
    const args = textMsg.trim().split(/\s+/);

    // Get context info for the message
    const contextInfo = getContextInfo(msg);
    const forwardedContext = getForwardedContext(msg);

    try {
        // Show specific command help
        if (args.length > 1) {
            const cmdName = args[1].toLowerCase();
            const cmd = commandRegistry[cmdName];

            if (!cmd) {
                return sendToChat(sock, from, {
                    message: `🖥️ *SYSTEM NOTICE*\n\n❌ Command "${cmdName}" not recognized.\nExecute: \`${prefix}help\` for valid command directory.`,
                    contextInfo,
                    forwardedContext
                });
            }

            if (cmd.ownerOnly && !isOwner) {
                return sendToChat(sock, from, {
                    message: '🖥️ *ACCESS DENIED*\n\n⛔ Insufficient privilege. Root access required.',
                });
            }

            let response = `🖥️ *SYSTEM MANUAL ACCESS GRANTED*\n\n`;
            response += `> **Command:** \`${prefix}${cmdName}\`\n`;
            response += `> **Description:** ${cmd.description}\n`;
            response += `> **Usage:** \`${prefix}${cmd.usage}\`\n`;
            response += `> **Category:** ${cmd.category}\n`;

            if (cmd.aliases) {
                response += `> **Aliases:** ${cmd.aliases.map(a => `\`${a}\``).join(', ')}\n`;
            }
            if (cmd.adminOnly) response += '> 🔒 **Privilege:** Admin Only\n';
            if (cmd.ownerOnly) response += '> 🔑 **Privilege:** Root Access (Owner)\n';

            response += `\n⚙️ *End of manual. Execute responsibly.*`;
            return sendToChat(sock, from, { message: response});
        }

        // Show general help
       let response = `🖥️ *COMMAND CONSOLE v${version}*\n\n`;
        response += `> To fetch command manual:\n\`${prefix}help <command>\`\n`;

        for (const [category, commands] of Object.entries(commandsByCategory)) {
            const visibleCommands = isOwner
                ? commands
                : commands.filter(cmd => {
                    if (cmd.ownerOnly && !isOwner) return false;
                    if (cmd.adminOnly && !isAdmin) return false;
                    return true;
                });

            if (visibleCommands.length === 0) continue;

            response += `\n📂 *${category.toUpperCase()}*\n`;
            visibleCommands
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(cmd => {
                    response += `> \`${prefix}${cmd.name}\` → ${cmd.description}\n`;
                });
        }

        response += `\n🔒 = Requires Admin  |  🔑 = Requires Root Access\n`;
        if (isOwner) response += `\n✅ Root privilege detected. Full system access granted.\n`;
        response += `\n🖥️ *Current Version:* ${version}\n`;
        response += `\n⚙️ *End of directory listing.*`;

        // Use sock.sendMessage instead of sendToChat
        await sock.sendMessage(from, {
            text: response,
            contextInfo,
            forwardedContext
        });

        return;

    } catch (error) {
        console.error('Error in help command:', error);
        return sendToChat(sock, from, {
            message: '🖥️ *SYSTEM ERROR*\n❌ Execution failed. Unable to process your request.',
            contextInfo,
            forwardedContext
        });
    }
}

module.exports = helpCommand;

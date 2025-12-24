const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

/**
 * Screenshot command handler for WhatsApp bot.
 * Usage: .ss <url> or .ssweb <url> or .screenshot <url>
 */
async function handleSsCommand(sock, chatId, message, match) {
    if (!match) {
        await sock.sendMessage(chatId, {
            text: `*SCREENSHOT TOOL*\n\n*.ss <url>*\n*.ssweb <url>*\n*.screenshot <url>*\n\nTake a screenshot of any website\n\nExample:\n.ss https://google.com\n.ssweb https://google.com\n.screenshot https://google.com`,
            quoted: message
        });
        return;
    }

    try {
        // Show typing indicator
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);

        // Extract and validate URL
        const url = match.trim();
        if (!/^https?:\/\//i.test(url)) {
            await sock.sendMessage(chatId, {
                text: '❌ Please provide a valid URL starting with http:// or https://',
                quoted: message
            });
            return;
        }

        // Screenshot API
        const apiUrl = `https://api.siputzx.my.id/api/tools/ssweb?url=${encodeURIComponent(url)}&theme=light&device=desktop`;
        const response = await fetch(apiUrl, { headers: { 'accept': '*/*' } });

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        // Get the image buffer (modern way)
        const arrayBuffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        // Send the screenshot
        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: `🖼️ Screenshot of: ${url}`
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('❌ Error in ss command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to take screenshot. Please try again in a few minutes.\n\nPossible reasons:\n• Invalid URL\n• Website is blocking screenshots\n• Website is down\n• API service is temporarily unavailable',
            quoted: message
        });
    }
}

module.exports = {
    handleSsCommand
};
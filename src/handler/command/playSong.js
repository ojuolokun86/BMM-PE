const yts = require('yt-search');
const axios = require('axios');

/**
 * WhatsApp play command: Search and download a song from YouTube as MP3.
 * Usage: .play <song name or keywords>
 */
async function playCommand(sock, chatId, message) {
    try {
        // Extract search query from message
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            await sock.sendMessage(chatId, { 
                text: "🎵 *What song do you want to download?*\n\nUsage: .play <song name>"
            }, { quoted: message });
            return;
        }

        // Search for the song on YouTube
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            await sock.sendMessage(chatId, { 
                text: "❌ No songs found for your query!"
            }, { quoted: message });
            return;
        }

        // Send loading message
        await sock.sendMessage(chatId, {
            text: "⏳ _Please wait, your download is in progress..._"
        }, { quoted: message });

        // Get the first video result
        const video = videos[0];
        const urlYt = video.url;
//  const response = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${urlYt}`);
        // Try Violetics API first (no token required)
        let audioUrl, title;
        try {
            const apiUrl = `https://api.violetics.pw/api/media/youtube-mp3?url=${encodeURIComponent(urlYt)}`;
            const response = await axios.get(apiUrl);
            const data = response.data;
            if (data && data.result && data.result.url) {
                audioUrl = data.result.url;
                title = data.result.title || video.title;
            }
        } catch (err) {
            // Ignore and try next API
        }

        // If Violetics fails, try apis-keith as fallback
        if (!audioUrl) {
            try {
                const apiUrl = `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(urlYt)}`;
                const response = await axios.get(apiUrl);
                const data = response.data;
                if (data && data.status && data.result && data.result.downloadUrl) {
                    audioUrl = data.result.downloadUrl;
                    title = data.result.title || video.title;
                }
            } catch (err) {
                // Ignore, will handle below
            }
        }

        if (!audioUrl) {
            await sock.sendMessage(chatId, { 
                text: "❌ Failed to fetch audio from all available APIs. Please try again later."
            }, { quoted: message });
            return;
        }

        // Send the audio file
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`,
            caption: `🎶 *${title}*\n\nPowered by BMM`
        }, { quoted: message });

    } catch (error) {
        console.error('Error in play command:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ Download failed. Please try again later, error: " + error
        }, { quoted: message });
    }
}

module.exports = playCommand;
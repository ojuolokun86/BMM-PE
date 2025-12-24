const axios = require('axios');

/**
 * WhatsApp imagine command: Generate an AI image from a prompt using pollinations.ai
 * Usage: .imagine <your prompt>
 */
async function imagine(sock, message, command, args, remoteJid) {
    if (command === 'imagine') {
        try {
            const prompt = args.join(' ').trim();
            if (!prompt) {
                await sock.sendMessage(remoteJid, {
                    text: '🎨 *Image Generation*\n\nPlease provide a prompt for the image generation.\n\n*Example:* .imagine a beautiful sunset over mountains'
                }, { quoted: message });
                return true;
            }

            await sock.sendMessage(remoteJid, {
                text: '🎨 Generating your image... Please wait.'
            }, { quoted: message });

            // Enhance and encode the prompt
            const enhancedPrompt = enhancePrompt(prompt);
            const encodedPrompt = encodeURIComponent(enhancedPrompt);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;

            // Download the image
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer'
            });

            const imageBuffer = Buffer.from(response.data);

            await sock.sendMessage(remoteJid, {
                image: imageBuffer,
                caption: `🎨 *Generated Image*\n\n*Prompt:* ${prompt}`
            }, { quoted: message });

            return true;
        } catch (error) {
            console.error('Error in imagine command:', error);
            await sock.sendMessage(remoteJid, {
                text: '❌ Failed to generate image. Please try again later.'
            }, { quoted: message });
            return true;
        }
    }
    return false;
}

// Helper to enhance prompt with quality keywords
function enhancePrompt(prompt) {
    const qualityEnhancers = [
        'masterpiece',
        'highly detailed',
        'professional photography',
        'artstation',
        'cinematic lighting',
        'sharp focus',
        '8k uhd',
        'realistic'
    ];
    const numEnhancers = Math.floor(Math.random() * 3) + 2; // Add 2-4 enhancers
    const selectedEnhancers = qualityEnhancers
        .sort(() => Math.random() - 0.5)
        .slice(0, numEnhancers);
    
    return `${prompt}, ${selectedEnhancers.join(', ')}`;
}

module.exports = { imagine };
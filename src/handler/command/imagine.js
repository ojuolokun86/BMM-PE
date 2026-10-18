const axios = require('axios');

async function generateImageBuffer(prompt) {
    const enhancedPrompt = enhancePrompt(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}`;
    const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: 15 * 1024 * 1024
    });
    const contentType = response.headers?.['content-type'] || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
        throw new Error(`Image generator returned ${contentType || 'an unknown content type'}`);
    }
    return Buffer.from(response.data);
}

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

            const imageBuffer = await generateImageBuffer(prompt);

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

module.exports = { imagine, generateImageBuffer };
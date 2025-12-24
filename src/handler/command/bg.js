const { registerCommand } = require('./commandRegistry');
const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');

// Update API configuration
const API_BASE = 'https://background-production-67b6.up.railway.app';
const API_ENDPOINTS = {
    health: '/health',
    removeBg: '/remove-bg/'
};

const MAX_RETRIES = 5;
const RETRY_DELAY = 3000; // 3 seconds between retries

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkAPIHealth(retryCount = 0) {
    try {
        console.log(`Checking API health (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
        const response = await axios.get(`${API_BASE}${API_ENDPOINTS.health}`);
        if (response.data?.status === 'ok') {
            console.log('API health check passed ✅');
            return true;
        }
        throw new Error('Invalid health check response');
    } catch (error) {
        console.error(`Health check failed (attempt ${retryCount + 1}):`, error.message);
        
        if (retryCount < MAX_RETRIES - 1) {
            console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
            await sleep(RETRY_DELAY);
            return checkAPIHealth(retryCount + 1);
        }
        
        console.error(`Health check failed after ${MAX_RETRIES} attempts`);
        return false;
    }
}

async function processBackground(imageBuffer) {
    try {
        // Check API health first
        const isHealthy = await checkAPIHealth();
        if (!isHealthy) {
            throw new Error('Background removal service is not available');
        }

        const formData = new FormData();
        formData.append('file', imageBuffer, {
            filename: 'image.jpg',
            contentType: 'image/jpeg'
        });

        const response = await axios.post(`${API_BASE}${API_ENDPOINTS.removeBg}`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            responseType: 'arraybuffer'
        });

        return response.data;
    } catch (error) {
        console.error('Background removal failed:', error.message);
        throw new Error(
            error.message === 'Background removal service is not available'
                ? 'Service is currently unavailable'
                : 'Failed to remove background'
        );
    }
}

async function handleBgRemoval(sock, msg) {
    const chat = msg.key.remoteJid;

    // First check if service is available with retries
    try {
        await sock.sendMessage(chat, { 
            text: '🔄 Checking service availability...' 
        });

        const isHealthy = await checkAPIHealth();
        if (!isHealthy) {
            await sock.sendMessage(chat, { 
                text: `❌ Background removal service is offline after ${MAX_RETRIES} connection attempts. Please try again later.` 
            });
            return;
        }
    } catch (error) {
        await sock.sendMessage(chat, { 
            text: '❌ Could not connect to background removal service.' 
        });
        return;
    }

    // Check if message is a reply
     const quoted = msg.message?.extendedTextMessage?.contextInfo;
    if (!quoted || !quoted.quotedMessage) {
        await sock.sendMessage(chat, { text: '❌ Please reply to an image with .bg' });
        return;
    }

    // Extract the actual quoted message
    const quotedMsg = quoted.quotedMessage;
  // Check if the quoted message contains an image
    const mediaType = Object.keys(quotedMsg)[0];
    if (!mediaType.toLowerCase().includes('image')) {
        await sock.sendMessage(chat, { text: '❌ Please reply to an image!' });
        return;
    }

    try {
        await sock.sendMessage(chat, { text: '⌛ Processing image...' });

        // downloadMediaMessage expects an object: { message: <quotedMessage> }
        const imageBuffer = await downloadMediaMessage({ message: quotedMsg }, 'buffer');
        const resultBuffer = await processBackground(imageBuffer);

        await sock.sendMessage(chat, {
            image: resultBuffer,
            caption: '✅ Background removed!',
            mimetype: 'image/png'
        });

    } catch (error) {
        console.error('BG removal error:', error);
        await sock.sendMessage(chat, { text: `❌ ${error.message}` });
    }
}

// Export the command configuration
module.exports = {handleBgRemoval};
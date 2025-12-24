const sharp = require('sharp');
const fs = require('fs');
const fsPromises = require('fs/promises');
const fse = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
//console.log('Node.js PATH:', process.env.PATH);

const tempDir = './temp';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const scheduleFileDeletion = (filePath) => {
    setTimeout(async () => {
        try {
            await fse.remove(filePath);
            console.log(`[stToImage] File deleted: ${filePath}`);
        } catch (error) {
            console.error(`[stToImage] Failed to delete file:`, error);
        }
    }, 5 * 60 * 1000); // 5 minutes
};

// Helper to extract quoted sticker message from Baileys message object
function extractQuotedStickerMessage(msg) {
    try {
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        if (!contextInfo || !contextInfo.quotedMessage) {
            console.log('[stToImage] No quotedMessage found in contextInfo');
            return null;
        }
        // Find the sticker message type (webp stickers are always .stickerMessage)
        const quoted = contextInfo.quotedMessage;
        if (quoted.stickerMessage) {
            console.log('[stToImage] Quoted stickerMessage found');
            return quoted.stickerMessage;
        }
        // Some Baileys versions may use different keys, add more checks if needed
        console.log('[stToImage] Quoted message is not a sticker');
        return null;
    } catch (err) {
        console.error('[stToImage] Error extracting quoted sticker message:', err);
        return null;
    }
}

/**
 * Convert sticker (static or animated) to image (PNG)
 */
async function convertStickerToImage(sock, msg, chatId) {
    console.log('[stToImage] convertStickerToImage called');
    try {
        const stickerMessage = extractQuotedStickerMessage(msg);
        if (!stickerMessage) {
            await sock.sendMessage(chatId, { text: '❌ Reply to a sticker with .stimage to convert it.' });
            return;
        }

        const stickerFilePath = path.join(tempDir, `sticker_${Date.now()}.webp`);
        const outputImagePath = path.join(tempDir, `converted_image_${Date.now()}.png`);

        console.log('[stToImage] Downloading sticker content...');
        const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        console.log('[stToImage] Sticker downloaded, saving to file:', stickerFilePath);

        await fsPromises.writeFile(stickerFilePath, buffer);

        // Convert webp to png (first frame)
        console.log('[stToImage] Converting webp to png...');
        await sharp(stickerFilePath).toFormat('png').toFile(outputImagePath);

        const imageBuffer = await fsPromises.readFile(outputImagePath);
        console.log('[stToImage] Sending image...');
        await sock.sendMessage(chatId, { image: imageBuffer, caption: 'Here is the converted image!' });

        scheduleFileDeletion(stickerFilePath);
        scheduleFileDeletion(outputImagePath);
    } catch (error) {
        console.error('[stToImage] Error converting sticker to image:', error);
        await sock.sendMessage(chatId, { text: 'An error occurred while converting the sticker.' });
    }
}
    
/**
 * Convert animated sticker (webp) to real GIF
 */
async function convertStickerToGif(sock, msg, chatId) {
    console.log('[stToImage] convertStickerToGif called');
    try {
        const stickerMessage = extractQuotedStickerMessage(msg);
        if (!stickerMessage) {
            await sock.sendMessage(chatId, { text: '❌ Reply to an animated sticker with .stgif to convert it.' });
            return;
        }

        const stickerFilePath = path.join(tempDir, `sticker_${Date.now()}.webp`);
        const outputGifPath = path.join(tempDir, `converted_gif_${Date.now()}.gif`);

        console.log('[stToImage] Downloading sticker content...');
        const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        console.log('[stToImage] Sticker downloaded, saving to file:', stickerFilePath);

        await fsPromises.writeFile(stickerFilePath, buffer);

        // Try ImageMagick first
        console.log('[stToImage] Converting webp to gif with ImageMagick...');
        let conversionSucceeded = false;
        try {
            await new Promise((resolve, reject) => {
                exec(
                    `magick convert "${stickerFilePath}" -coalesce -layers Optimize -colors 64 "${outputGifPath}"`,
                    (error, stdout, stderr) => {
                        if (error) {
                            console.error('[stToImage] ImageMagick error:', error, stderr);
                            reject(error);
                        } else {
                            console.log('[stToImage] ImageMagick conversion complete');
                            resolve();
                        }
                    }
                );
            });
            conversionSucceeded = true;
        } catch (error) {
            console.error('[stToImage] ImageMagick conversion failed:', error);
            conversionSucceeded = false;
        }

        if (!conversionSucceeded) {
            await sock.sendMessage(chatId, { text: '❌ Failed to convert sticker to GIF (ImageMagick error).' });
            return;
        }

        // Read the GIF buffer
        let gifBuffer;
        try {
            gifBuffer = await fsPromises.readFile(outputGifPath);
        } catch (err) {
            console.error('[stToImage] Could not read GIF output file:', err);
            await sock.sendMessage(chatId, { text: '❌ Could not read the converted GIF file.' });
            return;
        }

        console.log('[stToImage] GIF buffer size:', gifBuffer.length);

        // Try sending as video/gif
        let sent = false;
        try {
            await sock.sendMessage(chatId, {
                video: gifBuffer,
                mimetype: 'video/gif',
                caption: 'Here is the converted GIF!'
            });
            sent = true;
            console.log('[stToImage] GIF sent as video/gif');
        } catch (err) {
            console.error('[stToImage] Failed to send as video/gif:', err);
        }

        // If sending as video/gif fails, try as document
        if (!sent) {
            try {
                await sock.sendMessage(chatId, {
                    document: gifBuffer,
                    mimetype: 'video/gif',
                    fileName: 'sticker.gif',
                    caption: 'Here is the converted GIF (sent as document, preview may not show).'
                });
                sent = true;
                console.log('[stToImage] GIF sent as document');
            } catch (err) {
                console.error('[stToImage] Failed to send as document:', err);
                await sock.sendMessage(chatId, { text: '❌ Failed to send the GIF to chat. WhatsApp may not support this GIF.' });
            }
        }

        scheduleFileDeletion(stickerFilePath);
        scheduleFileDeletion(outputGifPath);
    } catch (error) {
        console.error('[stToImage] Error converting sticker to GIF:', error);
        await sock.sendMessage(chatId, { text: 'An error occurred while converting the sticker to GIF.' });
    }
}


module.exports = {
    convertStickerToImage,
    convertStickerToGif
};
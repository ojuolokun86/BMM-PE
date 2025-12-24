const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { exec } = require('child_process');
const sendToChat = require('../../utils/sendToChat');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const webp = require('node-webpmux');
const crypto = require('crypto');

async function stickerCommand(sock, msg) {
  const chatId = msg.key.remoteJid;
  let targetMessage = msg;
  let messageToQuote = msg;

  // If reply, reconstruct the minimal node for downloadMediaMessage
  if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    const quotedInfo = msg.message.extendedTextMessage.contextInfo;
    targetMessage = {
      key: {
        remoteJid: chatId,
        id: quotedInfo.stanzaId,
        participant: quotedInfo.participant,
      },
      message: quotedInfo.quotedMessage,
    };
  }

  // Find the media message (image, video, or GIF/document)
  let mediaMessage =
    targetMessage.message?.imageMessage ||
    targetMessage.message?.videoMessage ||
    targetMessage.message?.documentMessage;

  // Special handling for GIFs sent as documents
  let isGif = false;
  if (
    targetMessage.message?.documentMessage &&
    targetMessage.message.documentMessage.mimetype === 'image/gif'
  ) {
    mediaMessage = targetMessage.message.documentMessage;
    isGif = true;
  }

  if (!mediaMessage) {
    await sendToChat(sock, chatId, {
      message: '❌ Reply to or send an image/video/GIF to make a sticker.',
      quoted: messageToQuote,
    });
    return;
  }

  try {
    const mediaBuffer = await downloadMediaMessage(targetMessage, 'buffer', {});
    if (!mediaBuffer) {
      await sendToChat(sock, chatId, { message: '❌ Failed to download media.' });
      return;
    }

    // Prepare temp files
    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.ensureDir(tmpDir);
    const tempInput = path.join(tmpDir, `temp_${Date.now()}`);
    const tempOutput = path.join(tmpDir, `sticker_${Date.now()}.webp`);
    await fs.writeFile(tempInput, mediaBuffer);

    // Determine if animated
    const isAnimated =
      isGif ||
      mediaMessage.mimetype?.includes('gif') ||
      mediaMessage.mimetype?.includes('video') ||
      mediaMessage.seconds > 0;

    // ffmpeg command
    const ffmpegCommand = isAnimated
      ? `ffmpeg -i "${tempInput}" -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`
      : `ffmpeg -i "${tempInput}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`;

    await new Promise((resolve, reject) => {
      exec(ffmpegCommand, (error) => {
        if (error) {
          console.error('[stickerCommand] FFmpeg error:', error);
          reject(error);
        } else resolve();
      });
    });

    // Add sticker metadata (optional)
    const webpBuffer = await fs.readFile(tempOutput);
    const img = new webp.Image();
    await img.load(webpBuffer);
    const json = {
      'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
      'sticker-pack-name': 'Sticker',
      'emojis': ['🤖'],
    };
    const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);
    img.exif = exif;
    const finalBuffer = await img.save(null);

    await sock.sendMessage(chatId, { sticker: finalBuffer }, { quoted: messageToQuote });

    // Cleanup
    try {
      await fs.unlink(tempInput);
      await fs.unlink(tempOutput);
    } catch (err) {
      console.error('[stickerCommand] Error cleaning up temp files:', err);
    }
  } catch (error) {
    console.error('[stickerCommand] Error in sticker command:', error);
    await sendToChat(sock, chatId, { message: '❌ Failed to create sticker! Try again later.' });
  }
}

module.exports = stickerCommand;
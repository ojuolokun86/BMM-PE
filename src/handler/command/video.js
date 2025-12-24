const ytdlp = require('yt-dlp-exec');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

const TMP_DIR = path.join(__dirname, '../../../temp/multidl');
const INLINE_LIMIT = 60 * 1024 * 1024; // 60MB -> send inline; larger -> send as document

if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
}

const safeName = (s) => (s || '').replace(/[^\w\s.-]/g, '').trim() || `video_${Date.now()}`;

async function downloadFileWithYtDlp(url) {
    const outPath = path.join(TMP_DIR, `${safeName('dl')}_${Date.now()}.mp4`);

    await ytdlp(url, {
        output: outPath,
        format: 'bv*+ba/b',           // best video+audio, else best single stream
        mergeOutputFormat: 'mp4',      // ensure mp4
        ffmpegLocation: ffmpegPath || undefined,
        noCheckCertificates: true,
        userAgent: 'Mozilla/5.0',
        noPlaylist: true
    });

    const stat = fs.statSync(outPath);
    return { path: outPath, size: stat.size };
}

async function downloadVideo(sock, from, msg, args) {
    const url = args[0];
    if (!url) {
        return await sock.sendMessage(from, { text: '❌ Please provide a video URL.\nExample: .video https://www.instagram.com/...' }, { quoted: msg });
    }

    // Validate URL
    try { new URL(url); } catch {
        return await sock.sendMessage(from, { text: '❌ Invalid URL. Please provide a valid video URL.' }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        text: '⏳ Downloading... This may take a moment.',
        mentions: [msg.key.participant || msg.key.remoteJid]
    }, { quoted: msg });

    let fileInfo;
    try {
        fileInfo = await downloadFileWithYtDlp(url);

        const buffer = fs.readFileSync(fileInfo.path);
        const fileSizeMB = (fileInfo.size / (1024 * 1024)).toFixed(2);
        const fileName = `video_${Date.now()}.mp4`;

        if (fileInfo.size > INLINE_LIMIT) {
            await sock.sendMessage(from, {
                document: buffer,
                mimetype: 'video/mp4',
                fileName,
                caption: `📦 Sent as document due to large size\n📏 ${fileSizeMB} MB`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, {
                video: buffer,
                mimetype: 'video/mp4',
                fileName,
                caption: `🎥 Downloaded\n📏 ${fileSizeMB} MB`,
                gifPlayback: false,
                mentions: [msg.key.participant || msg.key.remoteJid]
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('[video] Error:', error);
        await sock.sendMessage(from, {
            text: '❌ Failed to download video. ' + (error.message || 'Please try again later.'),
            mentions: [msg.key.participant || msg.key.remoteJid]
        }, { quoted: msg });
    } finally {
        // Clean up temp files from this run
        try {
            const files = fs.readdirSync(TMP_DIR);
            files.forEach(file => {
                if (file.startsWith('dl_') || file.startsWith('video_') || file.startsWith('temp_') || file.endsWith('.mp4')) {
                    const fp = path.join(TMP_DIR, file);
                    try { fs.unlinkSync(fp); } catch {}
                }
            });
        } catch (cleanupError) {
            console.error('[video] Cleanup error:', cleanupError);
        }
    }
}

module.exports = { downloadVideo };

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const tempDir = path.join(__dirname, '../../../temp/youtube-dl');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

async function downloadWithYtDlp(url) {
    return new Promise((resolve, reject) => {
        const outputTemplate = path.join(tempDir, '%(title)s.%(ext)s');
        const cmd = `yt-dlp --geo-bypass-country US -x --audio-format mp3 --audio-quality 128k -o "${outputTemplate}" "${url}"`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) return reject(stderr || error.message);

            // Look for any mp3 in tempDir (newest one)
            const files = fs.readdirSync(tempDir)
                .filter(f => f.endsWith('.mp3'))
                .map(f => path.join(tempDir, f))
                .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

            if (files.length > 0) {
                resolve(files[0]);
            } else {
                reject('File not found after download');
            }
        });
    });
}

async function songCommand(sock, from, msg, { prefix, args }) {
    if (!args[0]) {
        return await sock.sendMessage(from, {
            text: `❌ Please provide a YouTube link.\nExample: *${prefix}song https://youtu.be/...*`
        }, { quoted: msg });
    }

    const url = args[0];
    await sock.sendMessage(from, { text: '⏳ Downloading song, please wait...' }, { quoted: msg });

    try {
        const filePath = await downloadWithYtDlp(url);
        const fileBuffer = fs.readFileSync(filePath);

        await sock.sendMessage(from, {
            audio: fileBuffer,
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: path.basename(filePath)
        }, { quoted: msg });

        // Cleanup
        fs.unlinkSync(filePath);
    } catch (error) {
        let msgErr = '❌ Error: Could not download song.';
        if (String(error).includes('Sign in to confirm')) {
            msgErr += '\n⚠️ This video is restricted. It requires cookies to download (YouTube login).';
        }
        await sock.sendMessage(from, { text: msgErr }, { quoted: msg });
    }
}

module.exports = songCommand;

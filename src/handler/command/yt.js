const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

// Enable debug logging
const DEBUG = true;

const debugLog = (...args) => DEBUG && console.log('[YT DEBUG]', ...args);
const errorLog = (...args) => console.error('[YT ERROR]', ...args);

// Temp directory for downloads
const tempDir = path.join(__dirname, '../../../temp/yt-downloads');

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Configure ffmpeg binary if available via ffmpeg-static
try {
    if (ffmpegPath) {
        ffmpeg.setFfmpegPath(ffmpegPath);
        debugLog('ffmpeg binary configured from ffmpeg-static');
    }
} catch (e) {
    errorLog('Failed to configure ffmpeg-static:', e.message);
}

class YouTubeDownloader {
    constructor() {
        this.tempDir = tempDir;
    }

    /**
     * Build request options for ytdl
     * Loads cookies from src/cookies.txt if available.
     */
    buildRequestOptions() {
        try {
            let cookie = '';

            const defaultCookiePath = path.join(
                __dirname,
                '..',
                '..',
                'cookies.txt'
            );

            if (fs.existsSync(defaultCookiePath)) {
                const raw = fs.readFileSync(defaultCookiePath, 'utf8');

                // Detect Netscape cookie format
                const lines = raw
                    .split(/\r?\n/)
                    .filter(Boolean);

                if (
                    lines.some(
                        l => l.split('\t').length >= 7 || l.startsWith('#')
                    )
                ) {
                    const pairs = [];

                    for (const line of lines) {
                        if (!line || line.startsWith('#')) continue;

                        const parts = line.split('\t');

                        if (parts.length >= 7) {
                            const name = parts[5];
                            const value = parts[6];

                            if (name && value) {
                                pairs.push(`${name}=${value}`);
                            }
                        }
                    }

                    cookie = pairs.join('; ');
                } else {
                    // Assume raw Cookie header
                    cookie = raw.trim();
                }
            }

            // Debug only cookie names, never values
            try {
                const cookieNames = (cookie || '')
                    .split(';')
                    .map(s => s.trim())
                    .filter(Boolean)
                    .map(p => p.split('=')[0])
                    .filter(Boolean);

                if (cookieNames.length) {
                    debugLog(
                        'Using cookies:',
                        cookieNames.join(', ')
                    );
                } else {
                    debugLog(
                        'No cookies loaded from src/cookies.txt'
                    );
                }
            } catch {}

            const ua =
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                'Chrome/124.0.0.0 Safari/537.36';

            const headers = {
                'user-agent': ua,
                'accept-language': 'en-US,en;q=0.9'
            };

            if (cookie) {
                headers.cookie = cookie;
            }

            return {
                headers
            };
        } catch (error) {
            errorLog(
                'Failed to build request options:',
                error.message
            );

            return {};
        }
    }

    /**
     * Get YouTube video information
     */
    async getVideoInfo(url) {
        try {
            if (!ytdl.validateURL(url)) {
                throw new Error('Invalid YouTube URL');
            }

            const info = await ytdl.getInfo(url, {
                requestOptions: this.buildRequestOptions()
            });

            const thumbnails = info.videoDetails.thumbnails || [];

            return {
                id: info.videoDetails.videoId,
                title: info.videoDetails.title,
                duration: parseInt(
                    info.videoDetails.lengthSeconds,
                    10
                ),
                thumbnail:
                    thumbnails.length > 0
                        ? thumbnails[thumbnails.length - 1].url
                        : null,
                channel:
                    info.videoDetails.ownerChannelName ||
                    info.videoDetails.author?.name ||
                    'Unknown',
                views: info.videoDetails.viewCount,
                uploadDate: info.videoDetails.uploadDate
            };
        } catch (error) {
            errorLog(
                'Error getting video info:',
                error
            );

            const msg = String(error?.message || '');

            if (
                msg.toLowerCase().includes('sign in to confirm') ||
                msg.toLowerCase().includes('unrecoverableerror')
            ) {
                throw new Error(
                    'YouTube blocked this server IP. ' +
                    'Provide cookies in src/cookies.txt ' +
                    '(raw Cookie header or Netscape format). ' +
                    'A residential proxy may still be required.'
                );
            }

            throw new Error(
                'Failed to get video information'
            );
        }
    }

    /**
     * Download YouTube video
     */
    async downloadVideo(
        url,
        quality = 'highest'
    ) {
        try {
            const info = await this.getVideoInfo(url);

            const safeTitle =
                info.title.replace(/[^\w\s.-]/gi, '');

            const outputPath = path.join(
                this.tempDir,
                `${safeTitle}_${Date.now()}.mp4`
            );

            debugLog(
                `Downloading video: ${info.title}`
            );

            debugLog(
                `Quality preference: ${quality}`
            );

            /**
             * First attempt:
             * Download a muxed video + audio stream.
             */
            try {
                const video = ytdl(url, {
                    quality:
                        quality === 'highest'
                            ? 'highest'
                            : 'lowest',

                    filter: 'videoandaudio',

                    requestOptions:
                        this.buildRequestOptions()
                });

                await new Promise(
                    (resolve, reject) => {
                        const writeStream =
                            fs.createWriteStream(
                                outputPath
                            );

                        video
                            .pipe(writeStream)
                            .on('finish', resolve)
                            .on('error', reject);

                        video.on('error', reject);
                    }
                );

                return {
                    path: outputPath,
                    size: fs.statSync(outputPath).size,
                    title: info.title,
                    thumbnail: info.thumbnail
                };
            } catch (muxErr) {
                debugLog(
                    'Muxed format not available, falling back to merge:',
                    muxErr?.message
                );
            }

            /**
             * Fallback:
             * Download best video + best audio
             * and merge using FFmpeg.
             */
            const fullInfo =
                await ytdl.getInfo(url, {
                    requestOptions:
                        this.buildRequestOptions()
                });

            const bestVideo =
                ytdl.chooseFormat(
                    fullInfo.formats,
                    {
                        quality: 'highestvideo'
                    }
                );

            const bestAudio =
                ytdl.chooseFormat(
                    fullInfo.formats,
                    {
                        quality: 'highestaudio'
                    }
                );

            if (!bestVideo || !bestAudio) {
                throw new Error(
                    'No suitable video/audio formats found'
                );
            }

            const videoStream =
                ytdl.downloadFromInfo(
                    fullInfo,
                    {
                        format: bestVideo,
                        requestOptions:
                            this.buildRequestOptions()
                    }
                );

            const audioStream =
                ytdl.downloadFromInfo(
                    fullInfo,
                    {
                        format: bestAudio,
                        requestOptions:
                            this.buildRequestOptions()
                    }
                );

            await new Promise(
                (resolve, reject) => {
                    ffmpeg()
                        .input(videoStream)
                        .input(audioStream)
                        .videoCodec('copy')
                        .audioCodec('aac')
                        .outputOptions(
                            '-shortest'
                        )
                        .save(outputPath)
                        .on('end', resolve)
                        .on('error', reject);
                }
            );

            return {
                path: outputPath,
                size: fs.statSync(outputPath).size,
                title: info.title,
                thumbnail: info.thumbnail
            };
        } catch (error) {
            errorLog(
                'Error downloading video:',
                error
            );

            throw new Error(
                'Failed to download video'
            );
        }
    }

    /**
     * Download YouTube audio
     */
    async downloadAudio(url) {
        try {
            const info =
                await this.getVideoInfo(url);

            const safeTitle =
                info.title.replace(/[^\w\s.-]/gi, '');

            const outputPath = path.join(
                this.tempDir,
                `${safeTitle}_${Date.now()}.mp3`
            );

            debugLog(
                `Downloading audio: ${info.title}`
            );

            return new Promise(
                (resolve, reject) => {
                    const stream = ytdl(url, {
                        quality: 'highestaudio',
                        filter: 'audioonly',
                        requestOptions:
                            this.buildRequestOptions()
                    });

                    ffmpeg(stream)
                        .audioBitrate(128)
                        .toFormat('mp3')
                        .save(outputPath)
                        .on('end', () => {
                            try {
                                resolve({
                                    path: outputPath,
                                    size: fs.statSync(
                                        outputPath
                                    ).size,
                                    title: info.title,
                                    thumbnail:
                                        info.thumbnail
                                });
                            } catch (error) {
                                reject(error);
                            }
                        })
                        .on('error', err => {
                            errorLog(
                                'FFmpeg error:',
                                err
                            );

                            reject(
                                new Error(
                                    'Failed to process audio'
                                )
                            );
                        });
                }
            );
        } catch (error) {
            errorLog(
                'Error downloading audio:',
                error
            );

            throw new Error(
                'Failed to download audio'
            );
        }
    }

    /**
     * Search YouTube videos
     *
     * Uses yt-search instead of youtube-yts.
     */
    async searchVideos(query) {
        try {
            debugLog(
                `Searching YouTube for: ${query}`
            );

            const result = await yts(query);

            if (
                !result ||
                !Array.isArray(result.videos)
            ) {
                return [];
            }

            return result.videos
                .slice(0, 5)
                .map(video => ({
                    id: video.videoId,
                    title: video.title,
                    duration: video.seconds,
                    thumbnail: video.thumbnail,
                    channel:
                        video.author?.name ||
                        'Unknown',
                    views: video.views,
                    uploaded:
                        video.ago ||
                        video.uploadedAt ||
                        ''
                }));
        } catch (error) {
            errorLog(
                'Error searching videos:',
                error
            );

            throw new Error(
                'Failed to search videos'
            );
        }
    }
}

const yt = new YouTubeDownloader();

/**
 * YouTube download command
 */
async function ytCommand(
    sock,
    from,
    msg,
    {
        prefix,
        args
    }
) {
    let result;

    try {
        const type =
            args[0]?.toLowerCase();

        const query =
            args.slice(1).join(' ');

        const sender =
            msg?.key?.participant ||
            msg?.key?.remoteJid;

        if (
            !type ||
            ![
                'video',
                'audio',
                'search'
            ].includes(type)
        ) {
            return await sock.sendMessage(
                from,
                {
                    text:
                        `❌ Invalid command. Usage:\n` +
                        `*${prefix}yt video <url>* - Download video\n` +
                        `*${prefix}yt audio <url>* - Download audio\n` +
                        `*${prefix}yt search <query>* - Search videos`
                },
                {
                    quoted: msg
                }
            );
        }

        /**
         * SEARCH
         */
        if (type === 'search') {
            if (!query) {
                return await sock.sendMessage(
                    from,
                    {
                        text:
                            `❌ Please provide a search query.\n` +
                            `Example: *${prefix}yt search never gonna give you up*`
                    },
                    {
                        quoted: msg
                    }
                );
            }

            await sock.sendMessage(
                from,
                {
                    text:
                        '🔍 Searching for videos...'
                },
                {
                    quoted: msg
                }
            );

            const results =
                await yt.searchVideos(query);

            if (
                !Array.isArray(results) ||
                results.length === 0
            ) {
                return await sock.sendMessage(
                    from,
                    {
                        text:
                            `❌ No videos found for "${query}".`
                    },
                    {
                        quoted: msg
                    }
                );
            }

            const resultText =
                results
                    .map(
                        (r, i) =>
                            `${i + 1}. ${r.title}\n` +
                            `   👤 ${r.channel} | ⏱️ ${formatDuration(r.duration)}`
                    )
                    .join('\n\n');

            const sent =
                await sock.sendMessage(
                    from,
                    {
                        text:
                            `📺 *Search Results for "${query}"*\n\n` +
                            `${resultText}\n\n` +
                            `*Reply with the number* to download.\n` +
                            `You can optionally add *a* for audio or *v* for video.`
                    },
                    {
                        quoted: msg
                    }
                );

            const menuMsgId =
                sent?.key?.id;

            const menuCreatedAt =
                Date.now();

            if (
                !menuMsgId ||
                !Array.isArray(results) ||
                results.length === 0
            ) {
                return;
            }

            const listener =
                async m => {
                    try {
                        const reply =
                            m.messages?.[0];

                        if (!reply) return;

                        const replyFrom =
                            reply.key.remoteJid;

                        const replySender =
                            reply.key.participant ||
                            reply.key.remoteJid;

                        if (
                            replyFrom !== from
                        ) {
                            return;
                        }

                        const body =
                            reply?.message
                                ?.conversation ||
                            reply?.message
                                ?.extendedTextMessage
                                ?.text ||
                            '';

                        const trimmed =
                            String(body)
                                .trim()
                                .toLowerCase();

                        const ctx =
                            reply.message
                                ?.extendedTextMessage
                                ?.contextInfo;

                        const stanzaId =
                            ctx?.stanzaId;

                        const isReplyToMenu =
                            stanzaId ===
                            menuMsgId;

                        const withinGrace =
                            Date.now() -
                                menuCreatedAt <
                            2 * 60 * 1000;

                        const numMatch =
                            trimmed.match(
                                /^(\d{1,2})\b/
                            );

                        if (
                            !isReplyToMenu &&
                            !withinGrace
                        ) {
                            return;
                        }

                        if (!numMatch) {
                            return;
                        }

                        const choice =
                            parseInt(
                                numMatch[1],
                                10
                            );

                        const flagMatch =
                            trimmed.match(
                                /[\s.-]([av])\b/
                            );

                        const formatFlag =
                            flagMatch
                                ? flagMatch[1]
                                : undefined;

                        if (
                            isNaN(choice) ||
                            choice < 1 ||
                            choice >
                                results.length
                        ) {
                            await sock.sendMessage(
                                from,
                                {
                                    text:
                                        '❌ Invalid selection. Please run the command again.'
                                },
                                {
                                    quoted: reply
                                }
                            );

                            sock.ev.off(
                                'messages.upsert',
                                listener
                            );

                            return;
                        }

                        sock.ev.off(
                            'messages.upsert',
                            listener
                        );

                        const selected =
                            results[
                                choice - 1
                            ];

                        const url =
                            `https://youtu.be/${selected.id}`;

                        const mode =
                            formatFlag === 'a'
                                ? 'audio'
                                : 'video';

                        await sock.sendMessage(
                            from,
                            {
                                text:
                                    `⏬ Downloading (${mode}): ${selected.title}`
                            },
                            {
                                quoted: reply
                            }
                        );

                        await ytCommand(
                            sock,
                            from,
                            reply,
                            {
                                prefix,
                                args: [
                                    mode,
                                    url
                                ]
                            }
                        );
                    } catch (e) {
                        console.error(
                            '[YT SELECTION LISTENER ERROR]',
                            e
                        );

                        try {
                            sock.ev.off(
                                'messages.upsert',
                                listener
                            );
                        } catch {}
                    }
                };

            /**
             * Automatically remove listener
             * after 10 minutes.
             */
            setTimeout(
                () => {
                    try {
                        sock.ev.off(
                            'messages.upsert',
                            listener
                        );
                    } catch {}
                },
                10 * 60 * 1000
            );

            sock.ev.on(
                'messages.upsert',
                listener
            );

            return;
        }

        /**
         * DOWNLOAD
         */
        if (!query) {
            return await sock.sendMessage(
                from,
                {
                    text:
                        `❌ Please provide a YouTube URL.\n` +
                        `Example: *${prefix}yt ${type} https://youtu.be/...*`
                },
                {
                    quoted: msg
                }
            );
        }

        if (!ytdl.validateURL(query)) {
            return await sock.sendMessage(
                from,
                {
                    text:
                        `❌ Not a valid YouTube link.\n` +
                        `Example: *${prefix}yt ${type} https://youtu.be/dQw4w9WgXcQ*`
                },
                {
                    quoted: msg
                }
            );
        }

        await sock.sendMessage(
            from,
            {
                text:
                    `⏳ Downloading ${type}... This may take a moment.`
            },
            {
                quoted: msg
            }
        );

        if (type === 'video') {
            result =
                await yt.downloadVideo(
                    query
                );
        } else {
            result =
                await yt.downloadAudio(
                    query
                );
        }

        /**
         * Decide whether to send
         * inline or as document.
         */
        const INLINE_LIMIT =
            60 * 1024 * 1024;

        const fileBuffer =
            fs.readFileSync(
                result.path
            );

        const isVideo =
            type === 'video';

        const cleanTitle =
            result.title.replace(
                /[^\w\s.-]/g,
                ''
            );

        const fileName =
            `${cleanTitle}.${isVideo ? 'mp4' : 'mp3'}`;

        const mimetype =
            isVideo
                ? 'video/mp4'
                : 'audio/mpeg';

        if (
            result.size >
            INLINE_LIMIT
        ) {
            await sock.sendMessage(
                from,
                {
                    document: fileBuffer,
                    mimetype,
                    fileName,
                    caption:
                        `📦 Sent as document due to large size\n` +
                        `🎥 ${result.title}`
                },
                {
                    quoted: msg
                }
            );
        } else {
            await sock.sendMessage(
                from,
                {
                    [isVideo
                        ? 'video'
                        : 'audio']: fileBuffer,

                    mimetype,

                    fileName,

                    caption:
                        `🎥 ${result.title}`
                },
                {
                    quoted: msg
                }
            );
        }
    } catch (error) {
        errorLog(
            'Error in yt command:',
            error
        );

        await sock.sendMessage(
            from,
            {
                text:
                    `❌ Error: ${
                        error.message ||
                        'Failed to process your request. Please try again.'
                    }`
            },
            {
                quoted: msg
            }
        );
    } finally {
        /**
         * Clean up temporary file.
         */
        if (
            result?.path &&
            fs.existsSync(result.path)
        ) {
            try {
                fs.unlinkSync(
                    result.path
                );

                debugLog(
                    'Temporary file deleted:',
                    result.path
                );
            } catch (e) {
                errorLog(
                    'Error deleting temp file:',
                    e.message
                );
            }
        }
    }
}

/**
 * Format duration
 */
function formatDuration(seconds) {
    seconds =
        Number(seconds) || 0;

    const h =
        Math.floor(
            seconds / 3600
        );

    const m =
        Math.floor(
            (seconds % 3600) / 60
        );

    const s =
        Math.floor(
            seconds % 60
        );

    return [
        h,
        m > 9
            ? m
            : h
                ? '0' + m
                : m || '0',

        s < 10
            ? '0' + s
            : s
    ]
        .filter(Boolean)
        .join(':');
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) {
        return '0 Bytes';
    }

    const k = 1024;

    const sizes = [
        'Bytes',
        'KB',
        'MB',
        'GB'
    ];

    const i =
        Math.floor(
            Math.log(bytes) /
            Math.log(k)
        );

    return (
        parseFloat(
            (
                bytes /
                Math.pow(k, i)
            ).toFixed(2)
        ) +
        ' ' +
        sizes[i]
    );
}

module.exports = ytCommand;
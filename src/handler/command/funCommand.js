const axios = require('axios');
const fs = require('fs');
const tmp = require('tmp');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const sendToChat = require('../../utils/sendToChat');

// ✅ Helper: Get target user from reply or mention
function getTargetUser(msg, args) {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (contextInfo?.participant) return contextInfo.participant;
    if (args[0]) return args[0].includes('@') ? args[0] : `${args[0]}@s.whatsapp.net`;
    return null;
}

// ✅ Deep quotes fallback list (philosophy, wisdom, life)
const DEEP_QUOTES = [
    { content: 'He who has a why to live can bear almost any how.', author: 'Friedrich Nietzsche' },
    { content: 'The unexamined life is not worth living.', author: 'Socrates' },
    { content: 'We suffer more often in imagination than in reality.', author: 'Seneca' },
    { content: 'Man is not worried by real problems so much as by his imagined anxieties about real problems.', author: 'Epictetus' },
    { content: 'In the midst of chaos, there is also opportunity.', author: 'Sun Tzu' },
    { content: 'It is not that we have a short time to live, but that we waste a lot of it.', author: 'Seneca' },
    { content: 'You must become who you are.', author: 'Friedrich Nietzsche' },
    { content: 'Happiness and freedom begin with a clear understanding of one principle: some things are within our control, and some things are not.', author: 'Epictetus' },
    { content: 'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.', author: 'Ralph Waldo Emerson' },
    { content: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Aristotle' }
];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ✅ Robust deep quote fetcher with fallbacks and timeouts
async function getDeepQuote() {
    // 1) Primary: Quotable (deeper tags, min length)
    try {
        const res = await axios.get('https://api.quotable.io/quotes/random', {
            params: { tags: 'wisdom|philosophy|life', minLength: 80 },
            timeout: 6000,
            validateStatus: s => s >= 200 && s < 300
        });
        const q = Array.isArray(res.data) ? res.data[0] : res.data;
        const content = q?.content || q?.quote;
        if (content) return { content, author: q?.author || 'Unknown' };
    } catch (e) {
        // fall through
    }

    // 2) Secondary: Stoic quote API
    try {
        const res = await axios.get('https://api.themotivate365.com/stoic-quote', {
            timeout: 6000,
            validateStatus: s => s >= 200 && s < 300
        });
        const q = res.data || {};
        if (q.quote) return { content: q.quote, author: q.author || 'Unknown' };
    } catch (e) {
        // fall through
    }

    // 3) Final: local deep quotes
    return pickRandom(DEEP_QUOTES);
}

// ✅ Convert image to WebP (for static sticker)
async function toWebpStickerBuffer(imageBuffer) {
    return sharp(imageBuffer)
        .resize(512, 512, { fit: 'inside' })
        .webp()
        .toBuffer();
}

// ✅ Convert GIF to animated WebP sticker
async function gifToAnimatedStickerBuffer(gifBuffer) {
    return new Promise((resolve, reject) => {
        const inputFile = tmp.tmpNameSync({ postfix: '.gif' });
        const outputFile = tmp.tmpNameSync({ postfix: '.webp' });
        fs.writeFileSync(inputFile, gifBuffer);

        ffmpeg(inputFile)
            .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', "scale=320:320:force_original_aspect_ratio=decrease,fps=15,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
                '-loop', '0'
            ])
            .toFormat('webp')
            .save(outputFile)
            .on('end', () => {
                const webp = fs.readFileSync(outputFile);
                fs.unlinkSync(inputFile);
                fs.unlinkSync(outputFile);
                resolve(webp);
            })
            .on('error', err => {
                fs.unlinkSync(inputFile);
                reject(err);
            });
    });
}

// ✅ Fetch a random GIF for action commands
async function fetchGiphyActionGif(action) {
    //console.log('Fetching GIF for action: ' + action);
    try {
        const res = await axios.get('https://api.giphy.com/v1/gifs/search', {
            params: {
                api_key: 'C5XVeQxRFvdVEXvO1qKN33E7cmvQss2n',
                q: action,
                limit: 20,
                rating: 'g'
            }
        });
        if (!res.data.data.length) return null;

        const randomGif = res.data.data[Math.floor(Math.random() * res.data.data.length)];
        const gifUrl = randomGif.images.original.url;
        const imgRes = await axios.get(gifUrl, { responseType: 'arraybuffer' });
        //console.log('GIF fetched for action: ' + action);

        return Buffer.from(imgRes.data);
    } catch (err) {
        console.log('Failed to fetch GIF for action: ' + action, err.message);
        return null;
    }
}

// ✅ Handle fun actions (slap, hug, etc.) as stickers
async function handleFunAction(sock, msg, command, args) {
    //console.log('Handling fun action: ' + command);
    const from = msg.key.remoteJid;
    const target = getTargetUser(msg, args);
    const senderId = msg.key.participant || msg.key.remoteJid;
    const mentions = target ? [senderId, target] : [senderId];

    const gifBuffer = await fetchGiphyActionGif(command);
    if (!gifBuffer) return;

    const webpBuffer = await gifToAnimatedStickerBuffer(gifBuffer);
    await sock.sendMessage(from, { sticker: webpBuffer, mentions }, { quoted: msg });
}

// ✅ Main fun command handler
async function funCommand(sock, from, msg, textMsg) {
    //console.log('Calling fun command');
    try {
        const args = textMsg.trim().split(/\s+/);
        const command = args.shift().toLowerCase();

        switch (command) {
            case 'quote': {
                const q = await getDeepQuote();
                await sendToChat(sock, from, {
                    message: `💬 *Quote of the Moment*\n\n"${q.content}"\n\n— _${q.author}_`
                }, { quoted: msg });
                break;
            }

            case 'joke': {
                const res = await axios.get('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit');
                const joke = res.data.type === 'single' ? res.data.joke : `${res.data.setup}\n${res.data.delivery}`;
                await sendToChat(sock, from, {
                    message: `😂 *Joke of the Moment*\n\n${joke}`
                }, { quoted: msg });
                break;
            }

            case 'translate': {
                const [targetLang, ...textArr] = args;
                const text = textArr.join(' ');
                if (!targetLang || !text) {
                    await sendToChat(sock, from, {
                        message: '❌ Usage: .translate <lang_code> <text>'
                    }, { quoted: msg });
                    break;
                }
                const res = await axios.post('https://libretranslate.de/translate', {
                    q: text, source: 'auto', target: targetLang, format: 'text'
                }, { headers: { accept: 'application/json' } });
                await sendToChat(sock, from, {
                    message: `🌐 *Translated (${targetLang}):*\n${res.data.translatedText}`
                }, { quoted: msg });
                break;
            }

            // ✅ Fun actions as animated stickers
            case 'slap': case 'hug': case 'kick': case 'poke': case 'tickle':
            case 'cry': case 'pat': case 'kill': case 'kiss': case 'wave':
            case 'blush': case 'shrug': case 'smile': case 'laugh':
            case 'lick': case 'bored': case 'stare': case 'yeet': case 'feed':
            case 'dance': case 'cuddle': case 'highfive': case 'facepalm':
            case 'thumbsup': case 'think': case 'shoot': case 'pout':
            case 'bite': case 'smug': case 'baka': {
                await handleFunAction(sock, msg, command, args);
                break;
            }

            default:
                await sendToChat(sock, from, {
                    message: '❌ Unknown fun command.'
                }, { quoted: msg });
                break;
        }
    } catch (err) {
        console.error('❌ Error in fun command:', err);
        await sendToChat(sock, from, {
            message: '❌ An error occurred while processing the fun command.', err
        }, { quoted: msg });
    }
}

module.exports = funCommand;

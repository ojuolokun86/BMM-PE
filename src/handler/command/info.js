const axios = require('axios');
const os = require('os');
const { exec } = require('child_process');
const https = require('https');
const { performance } = require('perf_hooks');
const sendToChat = require('../../utils/sendToChat');

// Latency Check
function measureLatency(url = 'https://google.com') {
    return new Promise(resolve => {
        const start = performance.now();
        https.get(url, res => {
            res.on('data', () => {});
            res.on('end', () => {
                const end = performance.now();
                resolve(`${(end - start).toFixed(1)} ms`);
            });
        }).on('error', () => resolve('Error'));
    });
}

// Download Speed Check
function measureDownloadSpeed(url = 'https://speed.hetzner.de/1MB.bin') {
    return new Promise(resolve => {
        const start = performance.now();
        let totalBytes = 0;

        https.get(url, res => {
            res.on('data', chunk => totalBytes += chunk.length);
            res.on('end', () => {
                const end = performance.now();
                const duration = (end - start) / 1000;
                const mbps = ((totalBytes * 8) / 1_000_000 / duration).toFixed(2);
                resolve(`${mbps} Mbps`);
            });
        }).on('error', () => resolve('Error'));
    });
}

// CLI Speedtest
function getSpeedTest() {
    return new Promise((resolve, reject) => {
        exec('speedtest', (error, stdout) => {
            if (error) return reject(`⚠️ [SYSTEM ERROR]: Speedtest module failure.`);
            try {
                const pingMatch = stdout.match(/Latency:\s+([\d.]+)\s+ms/);
                const downloadMatch = stdout.match(/Download:\s+([\d.]+)\s+Mbps/);
                const uploadMatch = stdout.match(/Upload:\s+([\d.]+)\s+Mbps/);

                resolve({
                    ping: pingMatch ? parseFloat(pingMatch[1]) : 'Error',
                    download: downloadMatch ? parseFloat(downloadMatch[1]) : 'Error',
                    upload: uploadMatch ? parseFloat(uploadMatch[1]) : 'Error'
                });
            } catch (e) {
                reject(`⚠️ [SYSTEM ERROR]: Parse failure in speedtest module.`);
            }
        });
    });
}

// VPN Info
async function getVpnInfo() {
    try {
        const res = await axios.get('https://ipinfo.io/json?token=6eeb48e6940e25');
        return {
            ip: res.data.ip || 'Unknown',
            city: res.data.city || 'Unknown',
            region: res.data.region || '',
            country: res.data.country || '',
            org: res.data.org || 'Unknown',
            hostname: res.data.hostname || 'Unknown'
        };
    } catch (err) {
        return null;
    }
}

// OS Info
function getOSInfo() {
    return {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        uptime: (os.uptime() / 60).toFixed(1) + ' mins',
        type: os.type(),
        cpu: os.cpus()[0]?.model || 'Unknown',
        totalMem: (os.totalmem() / (1024 ** 3)).toFixed(2) + ' GB',
        freeMem: (os.freemem() / (1024 ** 3)).toFixed(2) + ' GB'
    };
}

// Country Flag
function getFlagEmoji(countryCode) {
    if (!countryCode) return '🏳️';
    return countryCode.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt() + 127397));
}

// Main Command
async function infoCommand(sock, msg) {
    const from = msg.key.remoteJid;
    const quote = msg;

    let vpnBlock = '', botBlock = '', privacyBlock = '', osBlock = '';

    try {
        const [vpn, speed] = await Promise.all([ getVpnInfo(), getSpeedTest() ]);
        const flag = getFlagEmoji(vpn?.country || '');
        const location = `${vpn?.city}, ${vpn?.region}, ${vpn?.country}`.trim();
        const serverId = `${process.env.MASKED_ID || 'Unknown'}-${vpn?.country || 'XXX'} ${flag}`;

        vpnBlock = `
🖥️ [NETWORK DIAGNOSTICS]
━━━━━━━━━━━━━━━━━━━━━━━━━━
> NODE LOCATION: ${location}
> ISP: ${vpn?.org}
> LATENCY: ${speed.ping} ms
> DOWNLOAD: ${speed.download} Mbps
> UPLOAD: ${speed.upload} Mbps
> SERVER ID: ${serverId}
━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    } catch {
        vpnBlock = `⚠️ [NETWORK FAILURE]: Unable to retrieve VPN or speed metrics.\n`;
    }

    try {
        const name = sock.user?.name || 'Unknown';
        const bio = await sock.fetchStatus?.(sock.user.id) || {};
        botBlock = `
🤖 [BOT STATUS]
━━━━━━━━━━━━━━━━━━━━━━━━━━
> OPERATIONAL NODE: ${name}
> STATUS MESSAGE: ${bio.status || 'Unavailable'}
━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    } catch {
        botBlock = `⚠️ [BOT ERROR]: Failed to retrieve identity modules.\n`;
    }

    try {
        const privacy = await sock.fetchPrivacySettings?.(true);
        privacyBlock = `
🔐 [PRIVACY MATRIX]
━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        for (const [key, val] of Object.entries(privacy || {})) {
            privacyBlock += `> ${key.toUpperCase()}: ${val}\n`;
        }
        privacyBlock += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    } catch {
        privacyBlock = `⚠️ [PRIVACY MODULE]: Unable to access settings.\n`;
    }

    const osInfo = getOSInfo();
    osBlock = `
🖥️ [SYSTEM CORE DIAGNOSTICS]
━━━━━━━━━━━━━━━━━━━━━━━━━━
> HOSTNAME: ${osInfo.hostname}
> PLATFORM: ${osInfo.platform} (${osInfo.arch})
> OS: ${osInfo.type} ${osInfo.release}
> UPTIME: ${osInfo.uptime}
> CPU: ${osInfo.cpu}
> MEMORY: ${osInfo.freeMem} / ${osInfo.totalMem}
━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    const final = `${vpnBlock}${botBlock}${privacyBlock}${osBlock}`;
    await sendToChat(sock, from, { message: final }, { quoted: quote });
}

module.exports = infoCommand;

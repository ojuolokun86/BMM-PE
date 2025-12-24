const axios = require('axios');
const os = require('os');
const { exec, execSync } = require('child_process');
const https = require('https');
const { performance } = require('perf_hooks');
const util = require('util');
const execPromise = util.promisify(exec);

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

// Check if speedtest-cli is installed
async function isSpeedtestInstalled() {
    try {
        await execPromise('speedtest --version');
        return true;
    } catch (error) {
        return false;
    }
}

// Install speedtest-cli
async function installSpeedtest() {
    try {
        console.log('Installing speedtest-cli...');
        if (process.platform === 'win32') {
            // For Windows
            await execPromise('pip install speedtest-cli');
        } else {
            // For Linux/Mac
            await execPromise('sudo apt-get update && sudo apt-get install -y speedtest-cli || brew install speedtest-cli');
        }
        console.log('speedtest-cli installed successfully');
        return true;
    } catch (error) {
        console.error('Failed to install speedtest-cli:', error);
        return false;
    }
}

// CLI Speedtest
async function getSpeedTest() {
    try {
        // Check if speedtest is installed
        const isInstalled = await isSpeedtestInstalled();
        if (!isInstalled) {
            console.log('speedtest-cli not found, attempting to install...');
            const installed = await installSpeedtest();
            if (!installed) {
                throw new Error('Failed to install speedtest-cli. Please install it manually.');
            }
        }

        const { stdout } = await execPromise('speedtest --simple');
        
        const pingMatch = stdout.match(/Latency:\s+([\d.]+)\s+ms/);
        const downloadMatch = stdout.match(/Download:\s+([\d.]+)\s+Mbps/);
        const uploadMatch = stdout.match(/Upload:\s+([\d.]+)\s+Mbps/);

        return {
            ping: pingMatch ? `${pingMatch[1]} ms` : 'N/A',
            download: downloadMatch ? `${downloadMatch[1]} Mbps` : 'N/A',
            upload: uploadMatch ? `${uploadMatch[1]} Mbps` : 'N/A'
        };
    } catch (error) {
        console.error('Speedtest error:', error);
        throw new Error(`Speedtest failed: ${error.message}`);
    }
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
        let speedtest = {};
        try {
            speedtest = await getSpeedTest();
        } catch (speedtestError) {
            console.error('Speedtest error:', speedtestError);
            // Continue with other metrics even if speedtest fails
        }
        
        const [latency, download] = await Promise.all([
            measureLatency(),
            measureDownloadSpeed()
        ]);

        const [vpn] = await Promise.all([getVpnInfo()]);
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
    await sock.sendMessage(from, { text: final }, { quoted: quote });
}

module.exports = infoCommand;

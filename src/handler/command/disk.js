const { getMediaFromStore, getTextFromStore } = require('../../utils/globalStore');
const { cleanupOldFiles } = require('../../utils/diskStore');
const fs = require('fs').promises;
const path = require('path');
const { getStoreStats } = require('../../utils/globalStore');

const BASE_DIR = path.join(process.cwd(), 'data');
const MEDIA_DIR = path.join(BASE_DIR, 'media');
const TEXT_FILE = path.join(BASE_DIR, 'text', 'messages.jsonl');

async function getDiskUsage() {
  try {
    const getFileSize = async (filePath) => {
      try {
        const stats = await fs.stat(filePath);
        return stats.size;
      } catch {
        return 0;
      }
    };

    // Get media files size
    let mediaSize = 0;
    try {
      const files = await fs.readdir(MEDIA_DIR);
      const sizes = await Promise.all(
        files.map(file => getFileSize(path.join(MEDIA_DIR, file)))
      );
      mediaSize = sizes.reduce((sum, size) => sum + size, 0);
    } catch (error) {
      console.error('Error calculating media size:', error);
    }

    // Get text file size
    let textSize = 0;
    try {
      textSize = await getFileSize(TEXT_FILE);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error calculating text size:', error);
      }
    }

    const totalSize = mediaSize + textSize;
    const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
    const usagePercent = ((totalSize / maxSize) * 100).toFixed(2);

    return {
      media: formatBytes(mediaSize),
      text: formatBytes(textSize),
      total: formatBytes(totalSize),
      max: formatBytes(maxSize),
      usagePercent,
      mediaCount: await getFileCount(MEDIA_DIR),
      textCount: await getLineCount(TEXT_FILE)
    };
  } catch (error) {
    console.error('Error getting disk usage:', error);
    return { error: 'Failed to get disk usage' };
  }
}

async function getFileCount(dir) {
  try {
    const files = await fs.readdir(dir);
    return files.length;
  } catch {
    return 0;
  }
}

async function getLineCount(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.split('\n').filter(line => line.trim() !== '').length;
  } catch {
    return 0;
  }
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function diskCommand(sock, msg, args, prefix) {
  const remoteJid = msg.key.remoteJid;
  const isOwner = msg.key.fromMe; // Or use your owner check logic
  if (!isOwner) {
    await sock.sendMessage(remoteJid, { text: '❌ This command is only available to the bot owner.' });
    return;
  }
  const subCommand = args[0]?.toLowerCase();
  const diskUsage = await getDiskUsage();
  const ramUsage = getStoreStats();
  try {
    if (subCommand === 'cleanup') {
      await sock.sendMessage(remoteJid, { text: '🧹 Starting disk cleanup...' });
      await cleanupOldFiles();
      const newDiskUsage = await getDiskUsage();
      const newRamUsage = getStoreStats();
      
      await sock.sendMessage(remoteJid, { 
        text: `✅ Cleanup completed!\n\n` +
              `💾 Disk Usage (After Cleanup):\n` +
              `📁 Media: ${newDiskUsage.media} (${newDiskUsage.mediaCount} files)\n` +
              `📝 Text: ${newDiskUsage.text} (${newDiskUsage.textCount} messages)\n` +
              `📊 Total: ${newDiskUsage.total} of ${newDiskUsage.max} (${newDiskUsage.usagePercent}% used)\n\n` +
              `🧠 RAM Usage (Stored Messages):\n` +
              `• Media: ${newRamUsage.media.formatted} (${newRamUsage.media.count} items)\n` +
              `• Text: ${newRamUsage.text.formatted} (${newRamUsage.text.count} messages)\n` +
              `• Total: ${newRamUsage.total.formatted}`
      });
    } 
    else if (subCommand === 'clearall') {
      await sock.sendMessage(remoteJid, { text: '⚠️ Clearing all saved messages from RAM and disk...' });
      
      // Clear from RAM
      const { mediaStore, textStore } = require('../../utils/globalStore');
      mediaStore.clear();
      textStore.clear();
      
      // Clear from disk
      const files = await fs.readdir(MEDIA_DIR);
      await Promise.all(files.map(file => 
        fs.unlink(path.join(MEDIA_DIR, file)).catch(console.error)
      ));
      await fs.writeFile(TEXT_FILE, '', 'utf8');
      
      const newRamUsage = getStoreStats();
      
      await sock.sendMessage(remoteJid, { 
        text: `✅ All messages cleared successfully!\n\n` +
              `🧹 Storage has been reset\n` +
              `🧠 RAM Usage After Clear:\n` +
              `• Media: ${newRamUsage.media.formatted} (${newRamUsage.media.count} items)\n` +
              `• Text: ${newRamUsage.text.formatted} (${newRamUsage.text.count} messages)`
      });
    }
    else {
      const processMemory = process.memoryUsage();
      const formatMem = (bytes) => formatBytes(bytes, 2);
      
      await sock.sendMessage(remoteJid, { 
            text: `💾 *Storage & Memory Status*\n\n` +
                `📊 *Disk Usage*\n` +
                `┌───────────────\n` +
                `│ • Media: ${diskUsage.media} (${diskUsage.mediaCount} files)\n` +
                `│ • Text: ${diskUsage.text} (${diskUsage.textCount} messages)\n` +
                `│ • Total: ${diskUsage.total} of ${diskUsage.max} (${diskUsage.usagePercent}% used)\n` +
                `└───────────────\n\n` +
                `🧠 *RAM Usage (Stored Messages)*\n` +
                `┌───────────────\n` +
                `│ • Media: ${ramUsage.media.formatted} (${ramUsage.media.count} items)\n` +
                `│ • Text: ${ramUsage.text.formatted} (${ramUsage.text.count} messages)\n` +
                `│ • Total: ${ramUsage.total.formatted}\n` +
                `└───────────────\n\n` +
                `🖥️ *Process Memory*\n` +
                `┌───────────────\n` +
                `│ • RSS: ${formatMem(processMemory.rss)}\n` +
                `│ • Heap Total: ${formatMem(processMemory.heapTotal)}\n` +
                `│ • Heap Used: ${formatMem(processMemory.heapUsed)}\n` +
                `└───────────────\n\n` +
                `🛠️ *Available Commands*\n` +
                `┌───────────────\n` +
                `│ • ${prefix}disk → Show storage & memory info\n` +
                `│ • ${prefix}disk cleanup → Remove old files\n` +
                `│ • ${prefix}disk clearall → Delete all saved messages\n` +
                `└───────────────`
        });

    }
  } catch (error) {
    console.error('Error in disk command:', error);
    await sock.sendMessage(remoteJid, { 
      text: '❌ An error occurred while processing the disk command.'
    });
  }
}

module.exports = diskCommand;

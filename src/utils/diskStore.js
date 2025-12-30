// utils/diskStore.js
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const BASE_DIR = path.join(process.cwd(), 'data');
const MEDIA_DIR = path.join(BASE_DIR, 'media');
const TEXT_DIR = path.join(BASE_DIR, 'text');
const TEXT_FILE = path.join(TEXT_DIR, 'messages.jsonl');

// Constants
const MAX_DISK_USAGE = 5 * 1024 * 1024 * 1024; // 5GB in bytes
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

// Ensure directories exist
async function ensureDirs() {
  for (const dir of [BASE_DIR, MEDIA_DIR, TEXT_DIR]) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}

// Get directory size recursively
async function getDirSize(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  const sizes = await Promise.all(files.map(async (file) => {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) return getDirSize(filePath);
    const stat = await fs.stat(filePath);
    return stat.size;
  }));
  return sizes.reduce((total, size) => total + size, 0);
}

async function saveMediaToDisk(messageId, buffer, type, caption, deletedBy) {
  try {
    const filename = `${messageId}_${Date.now()}_${type}.bin`;
    const filePath = path.join(MEDIA_DIR, filename);
    
    // Use async/await with promises API
    await fs.writeFile(filePath, buffer);
    
    return {
      filePath,
      type,
      caption,
      deletedBy,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error saving media to disk:', error);
    return null;
  }
}

async function saveTextToDisk(messageId, content, deletedBy) {
  const record = { messageId, content, deletedBy, timestamp: Date.now() };
  try {
    await fs.appendFile(TEXT_FILE, JSON.stringify(record) + '\n');
  } catch (error) {
    console.error('Error saving text to disk:', error);
  }
}

// Cleanup old files and manage disk space
async function cleanupOldFiles() {
  try {
    const now = Date.now();
    let totalSize = 0;
    const fileStats = [];

    // Process media files
    const mediaFiles = await fs.readdir(MEDIA_DIR);
    for (const file of mediaFiles) {
      try {
        const filePath = path.join(MEDIA_DIR, file);
        const stats = await fs.stat(filePath);
        
        // Check if file is older than 7 days
        if (now - stats.mtimeMs > SEVEN_DAYS) {
          await fs.unlink(filePath);
          continue;
        }
        
        // Add to size calculation for files we're keeping
        totalSize += stats.size;
        fileStats.push({ path: filePath, size: stats.size, mtimeMs: stats.mtimeMs });
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
      }
    }

    // Process text messages
    if (await fileExists(TEXT_FILE)) {
      const content = await fs.readFile(TEXT_FILE, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      const filtered = [];
      
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (now - obj.timestamp < SEVEN_DAYS) {
            filtered.push(line);
            // Approximate size of the line in bytes
            totalSize += Buffer.byteLength(line, 'utf8');
          }
        } catch (error) {
          console.error('Error parsing line:', error);
        }
      }
      
      // Write back filtered content
      await fs.writeFile(TEXT_FILE, filtered.join('\n') + '\n');
    }

    // If we're over the limit, delete oldest files until under limit
    if (totalSize > MAX_DISK_USAGE) {
      console.log(`Disk usage (${formatBytes(totalSize)}) exceeds limit (${formatBytes(MAX_DISK_USAGE)}), cleaning up...`);
      
      // Sort files by modification time (oldest first)
      fileStats.sort((a, b) => a.mtimeMs - b.mtimeMs);
      
      // Delete files until we're under the limit
      for (const file of fileStats) {
        if (totalSize <= MAX_DISK_USAGE * 0.9) break; // Stop when we're at 90% of the limit
        
        try {
          await fs.unlink(file.path);
          totalSize -= file.size;
          console.log(`Deleted ${file.path} to free up space`);
        } catch (error) {
          console.error(`Error deleting file ${file.path}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Helper function to check if file exists
async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Initialize and start cleanup interval
(async () => {
  await ensureDirs();
  // Initial cleanup
  await cleanupOldFiles();
  // Schedule regular cleanups
  setInterval(cleanupOldFiles, CLEANUP_INTERVAL);
})();



async function getMediaFromDisk(messageId) {
  try {
    const files = await fs.readdir(MEDIA_DIR);
    const file = files.find(f => f.startsWith(messageId));
    if (!file) return null;

    const filePath = path.join(MEDIA_DIR, file);
    const buffer = await fs.readFile(filePath);
    
    // Update file access time to prevent immediate deletion of frequently accessed files
    const now = new Date();
    await fs.utimes(filePath, now, now);

    const parts = file.split('_');
    const typeWithExt = parts[parts.length - 1];
    const type = typeWithExt.replace('.bin', '');

    return {
      buffer,
      type,
      filePath
    };
  } catch (error) {
    console.error('Error reading media from disk:', error);
    return null;
  }
}

function getTextFromDisk(messageId) {
  if (!fs.existsSync(TEXT_FILE)) return null;

  const lines = fs.readFileSync(TEXT_FILE, 'utf8').split('\n');
  for (const line of lines) {
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.messageId === messageId) return obj;
    } catch {}
  }
  return null;
}


module.exports = {
  saveMediaToDisk,
  saveTextToDisk,
  getMediaFromDisk,
  getTextFromDisk,
  cleanupOldFiles // Export for manual cleanup if needed
};

const { copyGroupMembers, getGroupMemberStats } = require('../features/groupCopy');

// Store copy sessions
const copySessions = new Map();

// Session timeout (60 seconds)
const SESSION_TIMEOUT = 60 * 1000; // 60 seconds

/**
 * Handle .copy command - activates copy mode in destination group
 */
async function handleCopyCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  
  // Only work in groups
  if (!from.endsWith('@g.us')) {
    return sock.sendMessage(from, { text: '❌ This command only works in groups.' }, { quoted: msg });
  }
  
  try {
    // Check if sender is admin
    const metadata = await sock.groupMetadata(from);
    const isAdmin = metadata.participants.some(p => 
      p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
    );
    
    if (!isAdmin) {
      return sock.sendMessage(from, { text: '❌ Only group admins can use this command.' }, { quoted: msg });
    }
    
    // Create or update copy session
    const sessionId = `copy_${Date.now()}`;
    copySessions.set(sessionId, {
      targetGroupId: from,
      targetAdmin: sender,
      activatedAt: Date.now(),
      status: 'waiting_source'
    });
    
    // Set session timeout
    setTimeout(() => {
      const session = copySessions.get(sessionId);
      if (session && session.status === 'waiting_source') {
        copySessions.delete(sessionId);
        console.log(`🕐 Copy session ${sessionId} expired (60s timeout)`);
      }
    }, SESSION_TIMEOUT);
    
    console.log(`📋 Copy session created: ${sessionId} for target group ${from}`);
    
    await sock.sendMessage(from, { 
      text: '✅ **Copy mode activated**\n\n🎯 Now go to the group you want to copy members FROM and send `.here`\n\n⏳ Session expires in 60 seconds' 
    }, { quoted: msg });
    
  } catch (error) {
    console.error('❌ Error in .copy command:', error);
    await sock.sendMessage(from, { text: '❌ Error activating copy mode. Please try again.' }, { quoted: msg });
  }
}

/**
 * Handle .here command - selects source group and starts copying
 */
async function handleHereCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  
  // Only work in groups
  if (!from.endsWith('@g.us')) {
    return sock.sendMessage(from, { text: '❌ This command only works in groups.' }, { quoted: msg });
  }
  
  // Find active copy session
  let activeSession = null;
  let sessionId = null;
  
  for (const [sid, session] of copySessions.entries()) {
    if (session.status === 'waiting_source') {
      activeSession = session;
      sessionId = sid;
      break;
    }
  }
  
  if (!activeSession) {
    return sock.sendMessage(from, { 
      text: '❌ No active copy session. Please start with `.copy` in the destination group first.' 
    }, { quoted: msg });
  }
  
  const targetGroupId = activeSession.targetGroupId;
  const targetAdmin = activeSession.targetAdmin;
  
  console.log(`🔄 .here triggered in source group ${from} for session ${sessionId}`);
  
  try {
    // Update session status
    activeSession.status = 'copying';
    activeSession.sourceGroupId = from;
    
    // Get group metadata for names
    const sourceMetadata = await sock.groupMetadata(from);
    const targetMetadata = await sock.groupMetadata(targetGroupId);
    
    const sourceName = sourceMetadata.subject || 'Unknown Group';
    const targetName = targetMetadata.subject || 'Unknown Group';
    
    // Send initial status to destination group
    await sock.sendMessage(targetGroupId, { 
      text: `🔄 **Starting Copy Process**\n\n📤 **Source:** ${sourceName} (${from})\n📥 **Destination:** ${targetName} (${targetGroupId})\n\n⏳ Analyzing groups...` 
    });
    
    // Get group statistics
    const sourceStats = await getGroupMemberStats(sock, from);
    const targetStats = await getGroupMemberStats(sock, targetGroupId);
    
    // Send stats to destination group
    const statsMessage = `
📊 **Group Statistics**

📤 **Source Group:** ${sourceName}
• Total members: ${sourceStats.total}
• Admins: ${sourceStats.admins}
• Regular members: ${sourceStats.regular}

📥 **Destination Group:** ${targetName}
• Total members: ${targetStats.total}
• Admins: ${targetStats.admins}
• Regular members: ${targetStats.regular}

⏳ Starting member copy process...
    `;
    await sock.sendMessage(targetGroupId, { text: statsMessage });
    
    // Start the copy process
    console.log(`🚀 Starting member copy from ${from} to ${targetGroupId}`);
    const results = await copyGroupMembers(sock, from, targetGroupId);
    
    // Send final report to destination group
    let report = `
🎉 **Copy Process Complete!**

📊 **Results:**
• Total members found: ${results.totalFound}
• Members skipped (already in destination): ${results.totalSkipped}
• Successfully added: ${results.totalAdded}
• Failed to add: ${results.failed}

✅ **Success Rate:** ${results.totalFound > 0 ? Math.round((results.totalAdded / results.totalFound) * 100) : 0}%
    `;
    
    if (results.errors.length > 0) {
      report += `\n\n❌ **Errors (${results.errors.length}):**\n`;
      // Show first 5 errors to avoid message length issues
      const errorsToShow = results.errors.slice(0, 5);
      errorsToShow.forEach((error, index) => {
        report += `• ${error}\n`;
      });
      
      if (results.errors.length > 5) {
        report += `• ... and ${results.errors.length - 5} more errors`;
      }
    }
    
    await sock.sendMessage(targetGroupId, { text: report });
    
    // Clean up session
    copySessions.delete(sessionId);
    console.log(`✅ Copy session ${sessionId} completed and cleaned up`);
    
  } catch (error) {
    console.error('❌ Error in copy process:', error);
    
    // Send error to destination group
    await sock.sendMessage(targetGroupId, { 
      text: `❌ **Error during copy:** ${error.message}\n\nPlease check:\n• Bot is admin in destination group\n• Bot is member of source group` 
    });
    
    // Clean up session on error
    copySessions.delete(sessionId);
  }
}

/**
 * Get active copy sessions (for debugging)
 */
function getActiveSessions() {
  return Array.from(copySessions.entries()).map(([id, session]) => ({
    id,
    targetGroupId: session.targetGroupId,
    status: session.status,
    activatedAt: session.activatedAt,
    age: Date.now() - session.activatedAt
  }));
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [sessionId, session] of copySessions.entries()) {
    if (now - session.activatedAt > SESSION_TIMEOUT) {
      copySessions.delete(sessionId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired copy sessions`);
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

module.exports = {
  handleCopyCommand,
  handleHereCommand,
  getActiveSessions,
  cleanupExpiredSessions
};

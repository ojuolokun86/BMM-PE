const { 
  getAllowedLinks, 
  setAllowedLink, 
  toggleAllowedLink, 
  getPredefinedPatterns,
  initializeDefaultPatterns 
} = require('../../database/linkDb');
const { checkIfAdmin } = require('./kick');

const ITEMS_PER_PAGE = 5;

/**
 * Main command handler
 */
async function linkCommand(sock, msg, args, from) {
  const groupId = from;
  const senderId = msg.key.participant || msg.participant || msg.key.remoteJid;
  const botId = sock.user?.id?.split(':')[0];

  if (!groupId.endsWith('@g.us')) {
    await sock.sendMessage(groupId, { text: "❌ This command can only be used in groups." }, { quoted: msg });
    return;
  }

  if (!(await checkIfAdmin(sock, groupId, senderId))) {
    await sock.sendMessage(groupId, { text: "❌ Only group admins can use this command." }, { quoted: msg });
    return;
  }

  await initializeDefaultPatterns(groupId, botId);

  const subCmd = (args[0] || '').toLowerCase();

  if (!subCmd) return showLinkMenu(sock, groupId, botId, msg);

  switch (subCmd) {
    case 'allow': return showAllowMenu(sock, groupId, botId, msg, 0);
    case 'disallow': return showDisallowMenu(sock, groupId, botId, msg, 0);
    case 'status': return showLinkStatus(sock, groupId, botId, msg);
    case 'custom': return handleCustomLink(sock, groupId, botId, msg, args.slice(1));
    default: return showLinkMenu(sock, groupId, botId, msg);
  }
}

/**
 * Main menu with reply listener
 */
async function showLinkMenu(sock, groupId, botId, msg) {
  const allowedLinks = getAllowedLinks(groupId, botId);
  const activeCount = allowedLinks.length;

  const menuText = `🔗 *Link Management Menu*

📊 Current Status:
• Allowed Platforms: ${activeCount}

🖥️ [COMMAND OPTIONS]
> 1 → Allow Links
> 2 → Disallow Links  
> 3 → Link Status
> 4 → Add Custom Link

*Action Required: Reply with a number to execute command.*`;

  const sent = await sock.sendMessage(groupId, { text: menuText }, { quoted: msg });
  const menuMsgId = sent.key.id;

  const listener = async (m) => {
    const reply = m.messages?.[0];
    if (!reply) return;

    const replyFrom = reply.key.remoteJid;
    const replySender = reply.key.participant || reply.key.remoteJid;
    if (replyFrom !== groupId || replySender !== msg.key.participant) return;

    const context = reply.message?.extendedTextMessage?.contextInfo;
    const isReplyToMenu = context?.stanzaId === menuMsgId;
    if (!isReplyToMenu) return;

    const body = reply?.message?.conversation || reply?.message?.extendedTextMessage?.text || '';
    const option = parseInt(body.trim());

    if (isNaN(option) || ![1, 2, 3, 4].includes(option)) {
      await sock.sendMessage(groupId, { text: '❌ Invalid choice. Try again.' });
      sock.ev.off('messages.upsert', listener);
      return;
    }

    switch (option) {
      case 1:
        await showAllowMenu(sock, groupId, botId, msg, 0);
        break;
      case 2:
        await showDisallowMenu(sock, groupId, botId, msg, 0);
        break;
      case 3:
        await showLinkStatus(sock, groupId, botId, msg);
        break;
      case 4:
        await sock.sendMessage(groupId, { 
          text: `📝 *Add Custom Link*

Usage: \`.link custom <platform_name> <regex_pattern>\`

📋 *Example:*
\`.link custom "Discord" "https?:\\/\\/discord\\.com\\/.*"\`

� *Tips:*
• Use quotes for names with spaces
• Regex should match full URLs
• Test patterns before adding`
        }, { quoted: msg });
        break;
    }

    sock.ev.off('messages.upsert', listener);
  };

  sock.ev.on('messages.upsert', listener);
}

/**
 * Allow Menu with reply listener
 */
async function showAllowMenu(sock, groupId, botId, msg, page = 0) {
  const allowedLinks = getAllowedLinks(groupId, botId);
  const patterns = getPredefinedPatterns();
  const disabledPatterns = patterns.filter(p => !allowedLinks.some(a => a.platform === p.name));

  if (disabledPatterns.length === 0) {
    return sock.sendMessage(groupId, { text: "✅ All predefined platforms are already allowed!" }, { quoted: msg });
  }

  const start = page * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pagePatterns = disabledPatterns.slice(start, end);

  let menuText = `✅ *Allow Links Menu*\n\n🔓 Currently Disabled Platforms:\n`;
  menuText += pagePatterns.map((p, i) => `${start + i + 1}. **${p.name}** - ${p.description}`).join('\n');
  
  if (disabledPatterns.length > ITEMS_PER_PAGE) {
    menuText += `\n\n📄 Page ${page + 1}/${Math.ceil(disabledPatterns.length / ITEMS_PER_PAGE)}`;
  }
  
  menuText += `\n\n🖥️ [COMMAND OPTIONS]`;
  pagePatterns.forEach((p, i) => {
    menuText += `\n> ${start + i + 1} → Allow ${p.name}`;
  });
  
  if (start > 0) menuText += `\n> 0 → Previous Page`;
  if (end < disabledPatterns.length) menuText += `\n> 99 → Next Page`;
  menuText += `\n> 88 → Back to Main Menu`;
  
  menuText += `\n\n*Action Required: Reply with a number to execute command.*`;

  const sent = await sock.sendMessage(groupId, { text: menuText }, { quoted: msg });
  const menuMsgId = sent.key.id;

  const listener = async (m) => {
    const reply = m.messages?.[0];
    if (!reply) return;

    const replyFrom = reply.key.remoteJid;
    const replySender = reply.key.participant || reply.key.remoteJid;
    if (replyFrom !== groupId || replySender !== msg.key.participant) return;

    const context = reply.message?.extendedTextMessage?.contextInfo;
    const isReplyToMenu = context?.stanzaId === menuMsgId;
    if (!isReplyToMenu) return;

    const body = reply?.message?.conversation || reply?.message?.extendedTextMessage?.text || '';
    const option = parseInt(body.trim());

    // Handle pagination
    if (option === 0 && start > 0) {
      sock.ev.off('messages.upsert', listener);
      return showAllowMenu(sock, groupId, botId, msg, page - 1);
    }
    
    if (option === 99 && end < disabledPatterns.length) {
      sock.ev.off('messages.upsert', listener);
      return showAllowMenu(sock, groupId, botId, msg, page + 1);
    }
    
    if (option === 88) {
      sock.ev.off('messages.upsert', listener);
      return showLinkMenu(sock, groupId, botId, msg);
    }

    // Handle platform selection
    const selectedIndex = option - 1;
    if (selectedIndex >= 0 && selectedIndex < pagePatterns.length) {
      const selectedPattern = pagePatterns[selectedIndex];
      setAllowedLink(groupId, botId, selectedPattern.name, selectedPattern.pattern, true);
      await sock.sendMessage(groupId, { 
        text: `✅ **${selectedPattern.name}** links are now allowed!` 
      });
      
      sock.ev.off('messages.upsert', listener);
      return showAllowMenu(sock, groupId, botId, msg, page); // Refresh menu
    }

    await sock.sendMessage(groupId, { text: '❌ Invalid choice. Try again.' });
    sock.ev.off('messages.upsert', listener);
  };

  sock.ev.on('messages.upsert', listener);
}

/**
 * Disallow Menu with reply listener
 */
async function showDisallowMenu(sock, groupId, botId, msg, page = 0) {
  const allowedLinks = getAllowedLinks(groupId, botId);
  if (allowedLinks.length === 0) {
    return sock.sendMessage(groupId, { text: "ℹ️ No platforms are currently allowed." }, { quoted: msg });
  }

  const start = page * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageLinks = allowedLinks.slice(start, end);

  let menuText = `🚫 *Disallow Links Menu*\n\n✅ Currently Allowed Platforms:\n`;
  menuText += pageLinks.map((l, i) => `${start + i + 1}. **${l.platform}**`).join('\n');
  
  if (allowedLinks.length > ITEMS_PER_PAGE) {
    menuText += `\n\n📄 Page ${page + 1}/${Math.ceil(allowedLinks.length / ITEMS_PER_PAGE)}`;
  }
  
  menuText += `\n\n🖥️ [COMMAND OPTIONS]`;
  pageLinks.forEach((l, i) => {
    menuText += `\n> ${start + i + 1} → Disallow ${l.platform}`;
  });
  
  if (start > 0) menuText += `\n> 0 → Previous Page`;
  if (end < allowedLinks.length) menuText += `\n> 99 → Next Page`;
  menuText += `\n> 88 → Back to Main Menu`;
  
  menuText += `\n\n*Action Required: Reply with a number to execute command.*`;

  const sent = await sock.sendMessage(groupId, { text: menuText }, { quoted: msg });
  const menuMsgId = sent.key.id;

  const listener = async (m) => {
    const reply = m.messages?.[0];
    if (!reply) return;

    const replyFrom = reply.key.remoteJid;
    const replySender = reply.key.participant || reply.key.remoteJid;
    if (replyFrom !== groupId || replySender !== msg.key.participant) return;

    const context = reply.message?.extendedTextMessage?.contextInfo;
    const isReplyToMenu = context?.stanzaId === menuMsgId;
    if (!isReplyToMenu) return;

    const body = reply?.message?.conversation || reply?.message?.extendedTextMessage?.text || '';
    const option = parseInt(body.trim());

    // Handle pagination
    if (option === 0 && start > 0) {
      sock.ev.off('messages.upsert', listener);
      return showDisallowMenu(sock, groupId, botId, msg, page - 1);
    }
    
    if (option === 99 && end < allowedLinks.length) {
      sock.ev.off('messages.upsert', listener);
      return showDisallowMenu(sock, groupId, botId, msg, page + 1);
    }
    
    if (option === 88) {
      sock.ev.off('messages.upsert', listener);
      return showLinkMenu(sock, groupId, botId, msg);
    }

    // Handle platform selection
    const selectedIndex = option - 1;
    if (selectedIndex >= 0 && selectedIndex < pageLinks.length) {
      const selectedLink = pageLinks[selectedIndex];
      toggleAllowedLink(groupId, botId, selectedLink.platform);
      await sock.sendMessage(groupId, { 
        text: `🚫 **${selectedLink.platform}** links are now disallowed!` 
      });
      
      sock.ev.off('messages.upsert', listener);
      return showDisallowMenu(sock, groupId, botId, msg, page); // Refresh menu
    }

    await sock.sendMessage(groupId, { text: '❌ Invalid choice. Try again.' });
    sock.ev.off('messages.upsert', listener);
  };

  sock.ev.on('messages.upsert', listener);
}

/**
 * Link Status
 */
async function showLinkStatus(sock, groupId, botId, msg) {
  const allowedLinks = getAllowedLinks(groupId, botId);
  const patterns = getPredefinedPatterns();

  const text = `📊 *Link Management Status*\n\n` +
    `🔗 Allowed Platforms (${allowedLinks.length}):\n` +
    (allowedLinks.length > 0 ? allowedLinks.map(l => `✅ ${l.platform}`).join('\n') : '• None') +
    `\n\n🚫 Disabled Platforms:\n` +
    (patterns.filter(p => !allowedLinks.some(a => a.platform === p.name)).map(p => `❌ ${p.name}`).join('\n') || '• All allowed');

  await sock.sendMessage(groupId, { text }, { quoted: msg });
}

/**
 * Custom Link
 */
async function handleCustomLink(sock, groupId, botId, msg, args) {
  if (args.length < 2) return sock.sendMessage(groupId, { text: `❌ Invalid format\nUsage: .link custom <name> <regex>` }, { quoted: msg });

  const platformName = args[0].replace(/['"]/g, '');
  const regexPattern = args.slice(1).join(' ').replace(/['"]/g, '');

  try {
    new RegExp(regexPattern); // validate regex
    setAllowedLink(groupId, botId, platformName, regexPattern, true);
    await sock.sendMessage(groupId, { text: `✅ Custom link added: ${platformName}` }, { quoted: msg });
  } catch (err) {
    await sock.sendMessage(groupId, { text: `❌ Invalid regex: ${err.message}` }, { quoted: msg });
  }
}

module.exports = { linkCommand };

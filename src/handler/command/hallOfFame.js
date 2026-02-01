const supabase = require('../../supabaseClient')
const { checkIfAdmin } = require('./kick')

async function getCommunityInfo(sock, groupJid) {
  try {
    //console.log(`🔍 Fetching metadata for group: ${groupJid}`)
    const groupMeta = await sock.groupMetadata(groupJid)
    //console.log('📋 groupMeta:', groupMeta)

    // Check if the group is part of a community
    if (!groupMeta.linkedParent) {
      //console.log('⚠️ This group is NOT part of any community.')
      return null
    }

    //console.log(`🔗 This group belongs to community: ${groupMeta.linkedParent}`)
    
    const communityMeta = await sock.groupMetadata(groupMeta.linkedParent)
    //console.log('🏘️ communityMeta:', communityMeta)

    return {
      communityJid: groupMeta.linkedParent,
      communityName: communityMeta.subject || 'Unknown Community'
    }
  } catch (error) {
    console.error('❌ getCommunityInfo error:', error)
    return null
  }
}


async function addFame(sock, msg, chatId, sender, args) {
  try {
    const isAdmin = await checkIfAdmin(sock, chatId, sender)
    const community = await getCommunityInfo(sock, chatId)
    if (!community) {
      return sock.sendMessage(chatId, {
        text: '❌ This command works only inside a *community group*.'
      })
    }
    if (!isAdmin) {
      return sock.sendMessage(chatId, {
        text: '❌ You must be an admin to use this command.'
      })
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
    if (!mentioned || mentioned.length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ Mention a user.\nUsage: .addfame @user League, Team'
      })
    }

    const userJid = mentioned[0]

    // Combine args after @user and split by first comma
    const input = args.slice(1).join(' ')
    const [leagueRaw, ...teamParts] = input.split(',')
    const league = leagueRaw?.trim()
    const team = teamParts.join(',').trim()

    if (!league || !team) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: .addfame @user League, Team'
      })
    }

    // Step 1: Check if exact same user + league + team exists
    const { data: existing } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('community_jid', community.communityJid)
      .eq('user_jid', userJid)
      .eq('league', league)
      .eq('team', team)
      .single()

    if (existing) {
      // Same team, same league → increment trophies
      await supabase
        .from('hall_of_fame')
        .update({ trophies: existing.trophies + 1 })
        .eq('id', existing.id)
    } else {
      // Step 2 & 3: Insert new row (new team or new user)
      await supabase.from('hall_of_fame').insert({
        community_jid: community.communityJid,
        community_name: community.communityName,
        user_jid: userJid,
        league,
        team,
        trophies: 1
      })
    }

    await sock.sendMessage(chatId, {
      text: `🏆 Fame added successfully for ${league} - ${team}`,
      mentions: [userJid]
    })
  } catch (e) {
    console.error(e)
    sock.sendMessage(chatId, { text: '❌ Failed to add fame.' })
  }
}



// Helper to normalize league names
function normalizeLeague(name) {
  if (!name) return 'Unknown League'
  // Remove "season", "season X", "1", "2" etc at the end
  return name
    .toLowerCase()
    .replace(/season\s*\d+/i, '')
    .replace(/\d+$/, '')
    .trim()
    .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letters
}

async function showFame(sock, chatId) {
  try {
    const community = await getCommunityInfo(sock, chatId)
    if (!community) return sock.sendMessage(chatId, { text: '📜 This group is not part of a community.' })

    const { data: winners, error } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('community_jid', community.communityJid)
      .order('trophies', { ascending: false })

    if (error) throw error
    if (!winners || winners.length === 0) {
      return sock.sendMessage(chatId, {
        text: `📜 No Hall of Fame entries yet.\n👑 Community Owner: @${community.communityJid.split('@')[0]}`,
        mentions: [community.communityJid]
      })
    }

    // Group by normalized league
    const leagueMap = {}
    for (const win of winners) {
      const leagueName = normalizeLeague(win.league)
      if (!leagueMap[leagueName]) leagueMap[leagueName] = {}
      if (!leagueMap[leagueName][win.user_jid]) leagueMap[leagueName][win.user_jid] = []
      leagueMap[leagueName][win.user_jid].push({ team: win.team, trophies: win.trophies })
    }

    let text = `🏆 *HALL OF FAME — ${community.communityName}*\n`
    text += `━━━━━━━━━━━━━━━━━━\n`
    text += `🔥 *LEGENDS* 🔥\n\n`

    const mentions = []

    const communityMeta = await sock.groupMetadata(community.communityJid)
    if (communityMeta.owner) {
      mentions.push(communityMeta.owner)
      text += `👑 Community Owner: @${communityMeta.owner.split('@')[0]}\n\n`
    }

    for (const leagueName of Object.keys(leagueMap)) {
      text += `🏟️ ${leagueName}\n`
      const users = leagueMap[leagueName]
      for (const userJid of Object.keys(users)) {
        mentions.push(userJid)
        const teamStr = users[userJid]
          .map(t => `${t.team} x${t.trophies}`)
          .join(', ')
        const totalTrophies = users[userJid].reduce((sum, t) => sum + t.trophies, 0)
        text += `🥇 @${userJid.split('@')[0]} — [${teamStr}] ${'🏆'.repeat(totalTrophies)}\n`
      }
      text += '\n'
    }

    text += `━━━━━━━━━━━━━━━━━━\n`
    text += `🔥 Only Legends made it up here 🔥`

    await sock.sendMessage(chatId, { text, mentions })
  } catch (e) {
    console.error(e)
    await sock.sendMessage(chatId, { text: '❌ Failed to load Hall of Fame.' })
  }
}

module.exports = {
  addFame,
  showFame
}
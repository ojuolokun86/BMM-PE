const supabase = require('../../supabaseClient')
const { checkIfAdmin } = require('./kick')
const { getGroupProfilePicBuffer, getContextInfo } = require('../../utils/groupImagePreview')

async function getCommunityInfo(sock, groupJid) {
  try {
    const groupMeta = await sock.groupMetadata(groupJid)
    if (!groupMeta.linkedParent) {
      return null
    }
    const communityMeta = await sock.groupMetadata(groupMeta.linkedParent)

    return {
      communityJid: groupMeta.linkedParent,
      communityName: communityMeta.subject || 'Unknown Community'
    }
  } catch (error) {
    console.error('❌ getCommunityInfo error:', error)
    return null
  }
}


async function addFame(sock, msg, chatId, sender, args, prefix) {
  try {
    const groupPicBuffer = await getGroupProfilePicBuffer(sock, chatId)
    const isAdmin = await checkIfAdmin(sock, chatId, sender)
    const community = await getCommunityInfo(sock, chatId)
    if (!community) {
      return sock.sendMessage(chatId, {
        text: '❌ This command works only inside a *community group*.'
      })
    }
    // if (!isAdmin) {
    //   return sock.sendMessage(chatId, {
    //     text: '❌ You must be an admin to use this command.'
    //   })
    // }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
    if (!mentioned || mentioned.length === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ Mention a user.\nUsage: ${prefix} hall @user League, Team`
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
        text: '❌ Usage: .hall @user League, Team'
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

    let newTrophyCount = 1
    if (existing) {
      // Same team, same league → increment trophies
      newTrophyCount = existing.trophies + 1
      await supabase
        .from('hall_of_fame')
        .update({ trophies: newTrophyCount })
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

    // Get user's total trophies in this community
    const { data: userAllTrophies } = await supabase
      .from('hall_of_fame')
      .select('trophies')
      .eq('community_jid', community.communityJid)
      .eq('user_jid', userJid)

    const totalTrophies = userAllTrophies?.reduce((sum, record) => sum + record.trophies, 0) || 0

    // Get total trophies in this community (all users)
    const { data: communityAllTrophies } = await supabase
      .from('hall_of_fame')
      .select('trophies')
      .eq('community_jid', community.communityJid)

    const communityTotalTrophies = communityAllTrophies?.reduce((sum, record) => sum + record.trophies, 0) || 0

    // Get user's total trophies across ALL communities
    const userGlobalTrophies = await supabase
      .from('hall_of_fame')
      .select('trophies')
      .eq('user_jid', userJid)
      .then(({ data }) => data?.reduce((sum, record) => sum + record.trophies, 0) || 0)

    // Get user's rank category
    function getRankCategory(trophies) {
      if (trophies >= 10) return { category: 'LEGEND', emoji: '👑', stars: '⭐⭐⭐⭐⭐⭐', nextTier: 'Already at the top!' }
      if (trophies >= 7) return { category: 'CHAMPION', emoji: '🏆', stars: '⭐⭐⭐⭐⭐', nextTier: 'Legend (10 trophies)', needed: 10 - trophies }
      if (trophies >= 5) return { category: 'MASTER', emoji: '🥇', stars: '⭐⭐⭐⭐', nextTier: 'Champion (7 trophies)', needed: 7 - trophies }
      if (trophies >= 3) return { category: 'EXPERT', emoji: '🥈', stars: '⭐⭐⭐', nextTier: 'Master (5 trophies)', needed: 5 - trophies }
      if (trophies >= 2) return { category: 'RISING STAR', emoji: '🌟', stars: '⭐⭐', nextTier: 'Expert (3 trophies)', needed: 3 - trophies }
      if (trophies >= 1) return { category: 'ROOKIE', emoji: '🔰', stars: '⭐', nextTier: 'Rising Star (2 trophies)', needed: 2 - trophies }
      return { category: 'NEWCOMER', emoji: '🌱', stars: '', nextTier: 'Rookie (1 trophy)', needed: 1 }
    }

    const rankInfo = getRankCategory(totalTrophies)

    // Create personalized message
    let message = `🏆 *HALL OF FAME UPDATE*\n\n`
    message += `🎉 Congratulations @${userJid.split('@')[0]}! 🎉\n\n`
    message += `📝 You've been added to the *Hall of Fame* in **${community.communityName}** community!\n\n`
    message += `🏟️ *Achievement:* ${normalizeLeague(league)}, *Team* ${team}\n`
    message += `🏆 *Trophies in this entry:* ${newTrophyCount}\n`
    message += `📊 *Total trophies in community:* ${communityTotalTrophies}\n`
    message += `🏅 *Total trophies won by you:* ${totalTrophies}\n\n`
    message += `${rankInfo.emoji} *Current Rank:* ${rankInfo.category} ${rankInfo.stars}\n\n`

    if (totalTrophies === 1) {
      message += `🌟 *Amazing start!* You've earned your first trophy and are now a **ROOKIE**!\n`
      message += `🎯 *Next goal:* Earn 1 more trophy to become a **Rising Star**!`
    } else if (totalTrophies === 2) {
      message += `🌟 *Great progress!* You're now a **RISING STAR**!\n`
      message += `🎯 *Next goal:* Earn 1 more trophy to become an **EXPERT**!`
    } else if (totalTrophies === 3) {
      message += `⭐ *Impressive!* You've reached **EXPERT** level!\n`
      message += `🎯 *Next goal:* Earn 2 more trophies to become a **MASTER**!`
    } else if (totalTrophies === 5) {
      message += `⭐⭐ *Outstanding!* You're now a **MASTER**!\n`
      message += `🎯 *Next goal:* Earn 2 more trophies to become a **CHAMPION**!`
    } else if (totalTrophies === 7) {
      message += `⭐⭐⭐ *Incredible!* You've achieved **CHAMPION** status!\n`
      message += `🎯 *Next goal:* Earn 3 more trophies to become a **LEGEND**!`
    } else if (totalTrophies >= 10) {
      message += `👑 *LEGENDARY!* You're a true **LEGEND** of this community!\n`
      message += `🏆 *You've reached the pinnacle of success!*`
    } else {
      message += `🎯 *Next goal:* Earn ${rankInfo.needed} more trophy${rankInfo.needed > 1 ? 's' : ''} to become a **${rankInfo.nextTier.split('(')[0].trim()}**!`
    }

    message += `\n\n━━━━━━━━━━━━━━━━━━\n`
    message += `🔥 Keep climbing the ranks! 🔥`

    await sock.sendMessage(chatId, {
      text: message,
      mentions: [userJid],
      contextInfo: getContextInfo({
        title: community.communityName,
        body: 'HALL OF FAME UPDATE',
        thumbnail: groupPicBuffer
      })
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
    const groupPicBuffer = await getGroupProfilePicBuffer(sock, chatId)
    const community = await getCommunityInfo(sock, chatId)
    if (!community) return sock.sendMessage(chatId, { text: '📜 This group is not part of a community.' })

    const { data: winners, error } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('community_jid', community.communityJid)
      .order('trophies', { ascending: false })

    if (error) throw error
      if (!winners || winners.length === 0) {
      const communityMeta = await sock.groupMetadata(community.communityJid)

      const mentions = []

      let ownerText = 'Unknown'

      if (communityMeta?.owner) {
        mentions.push(communityMeta.owner)
        ownerText = `@${communityMeta.owner.split('@')[0]}`
      }

      return sock.sendMessage(chatId, {
        text:
          `📜 No Hall of Fame entries yet.\n` +
          `👑 Community Owner: ${ownerText}`,
        mentions
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

    await sock.sendMessage(chatId, { text, mentions, contextInfo: getContextInfo({
      title: community.communityName,
      body: 'Hall of Fame',
      thumbnail: groupPicBuffer
    }) })
  } catch (e) {
    console.error(e)
    await sock.sendMessage(chatId, { text: '❌ Failed to load Hall of Fame.' })
  }
}

async function showStats(sock, chatId, returnText = false) {
  try {
    const groupPicBuffer = await getGroupProfilePicBuffer(sock, chatId)
    const community = await getCommunityInfo(sock, chatId)

    if (!community) {
      return sock.sendMessage(chatId, { text: '📜 This group is not part of a community.'})
    }

    const { data: allWinners, error } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('community_jid', community.communityJid)

    if (error) throw error

    if (!allWinners || allWinners.length === 0) {
      return sock.sendMessage(chatId, {
        text: `📊 No trophy data yet.`,
      })
    }

    // Aggregate trophies per user
    const userStats = {}

    for (const win of allWinners) {
      if (!userStats[win.user_jid]) {
        userStats[win.user_jid] = {
          userJid: win.user_jid,
          totalTrophies: 0,
          leagues: {},
        }
      }

      userStats[win.user_jid].totalTrophies += win.trophies

      const normalizedLeague = normalizeLeague(win.league)

      if (!userStats[win.user_jid].leagues[normalizedLeague]) {
        userStats[win.user_jid].leagues[normalizedLeague] = []
      }

      userStats[win.user_jid].leagues[normalizedLeague].push({
        team: win.team,
        trophies: win.trophies,
      })
    }

    // Sort users
    const sortedUsers = Object.values(userStats).sort(
      (a, b) => b.totalTrophies - a.totalTrophies
    )

    function getRankCategory(trophies) {
      if (trophies >= 10) return { category: 'LEGEND', emoji: '👑', stars: '⭐⭐⭐⭐⭐⭐' }
      if (trophies >= 7) return { category: 'CHAMPION', emoji: '🏆', stars: '⭐⭐⭐⭐⭐' }
      if (trophies >= 5) return { category: 'MASTER', emoji: '🥇', stars: '⭐⭐⭐⭐' }
      if (trophies >= 3) return { category: 'EXPERT', emoji: '🥈', stars: '⭐⭐⭐' }
      if (trophies >= 2) return { category: 'RISING STAR', emoji: '🌟', stars: '⭐⭐' }
      if (trophies >= 1) return { category: 'ROOKIE', emoji: '🔰', stars: '⭐' }
      return { category: 'NEWCOMER', emoji: '🌱', stars: '' }
    }

    const totalTrophies = sortedUsers.reduce((sum, u) => sum + u.totalTrophies, 0)

    let text = `🏆 *${community.communityName.toUpperCase()}*\n`
    text += `⚽ *ALL-TIME TROPHY LEADERBOARD*\n`
    text += `━━━━━━━━━━━━━━━━━━\n\n`
    text += `👥 Players: *${sortedUsers.length}*\n`
    text += `🏆 Total Trophies: *${totalTrophies}*\n\n`
    text += `🏅 *TOP MANAGERS*\n`
    text += `━━━━━━━━━━━━━━━━━━\n\n`

    const mentions = []

    const topUsers = sortedUsers.slice(0, 10)

    for (let i = 0; i < topUsers.length; i++) {
      const user = topUsers[i]
      const rank = i + 1
      const category = getRankCategory(user.totalTrophies)

      mentions.push(user.userJid)

      let rankIcon = `${rank}.`
      if (rank === 1) rankIcon = "🥇"
      else if (rank === 2) rankIcon = "🥈"
      else if (rank === 3) rankIcon = "🥉"

      text += `${rankIcon} @${user.userJid.split('@')[0]}\n`
      text += `   ${category.emoji} ${category.category} ${category.stars}\n`
      text += `   🏆 ${user.totalTrophies} trophies\n\n`
    }

    const categoryCount = {}

    sortedUsers.forEach(user => {
      const category = getRankCategory(user.totalTrophies).category
      categoryCount[category] = (categoryCount[category] || 0) + 1
    })

    const categories = ['LEGEND','CHAMPION','MASTER','EXPERT','RISING STAR','ROOKIE']

    text += `━━━━━━━━━━━━━━━━━━\n`
    text += `📊 *RANK DISTRIBUTION*\n\n`

    categories.forEach(cat => {
      const count = categoryCount[cat] || 0

      const catInfo = getRankCategory(
        cat === 'LEGEND' ? 10 :
        cat === 'CHAMPION' ? 7 :
        cat === 'MASTER' ? 5 :
        cat === 'EXPERT' ? 3 :
        cat === 'RISING STAR' ? 2 : 1
      )

      text += `${catInfo.emoji} ${cat} — ${count}\n`
    })

    text += `\n━━━━━━━━━━━━━━━━━━\n`
    text += `🔥 *Only true legends reach the top.*\n`
    text += `📜 Type *.fame* to see full Hall of Fame.`

    if (returnText) {
      return { text, mentions }
    }

    await sock.sendMessage(chatId, {
      text,
      mentions,
      contextInfo: getContextInfo({
        title: community.communityName,
        body: 'Trophy Leaderboard',
        thumbnail: groupPicBuffer
      })
    })

  } catch (e) {
    console.error(e)
    await sock.sendMessage(chatId, { text: '❌ Failed to load trophy statistics.' })
  }
}

async function listFame(sock, msg, chatId, args, prefix) {
  try {
    const community = await getCommunityInfo(sock, chatId)

    if (!community) {
      return sock.sendMessage(chatId, {
        text: '❌ This group is not inside a community.'
      })
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid

    if (!mentioned || mentioned.length === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ Mention a user.\nUsage: ${prefix}list fame @user`
      })
    }

    const userJid = mentioned[0]

    const { data, error } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('community_jid', community.communityJid)
      .eq('user_jid', userJid)
      .order('league', { ascending: true })

    if (error) throw error

    if (!data || data.length === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ @${userJid.split('@')[0]} has no Hall of Fame entry.`,
        mentions: [userJid]
      })
    }

    let text = `🏆 *HALL OF FAME LIST*\n\n`
    text += `👤 Player: @${userJid.split('@')[0]}\n\n`

    data.forEach((item, index) => {
      text += `*${index + 1}.* ${normalizeLeague(item.league)}\n`
      text += `⚽ Team: ${item.team}\n`
      text += `🏆 Trophies: ${item.trophies}\n\n`
    })

    text += `━━━━━━━━━━━━━━━━━━\n`
    text += `📌 Total Entries: ${data.length}`

    await sock.sendMessage(chatId, {
      text,
      mentions: [userJid]
    })

  } catch (e) {
    console.error(e)
    await sock.sendMessage(chatId, {
      text: '❌ Failed to load fame list.'
    })
  }
}


async function deleteFame(sock, msg, chatId, sender, args, prefix) {
  try {
    const community = await getCommunityInfo(sock, chatId)

    if (!community) {
      return sock.sendMessage(chatId, {
        text: '❌ This group is not inside a community.'
      })
    }

    const mentioned =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid

    if (!mentioned || mentioned.length === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ Mention a user.\nUsage: ${prefix}hall rm @user`
      })
    }

    const userJid = mentioned[0]

    const { data, error } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('community_jid', community.communityJid)
      .eq('user_jid', userJid)
      .order('league', { ascending: true })

    if (error) throw error

    if (!data || data.length === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ @${userJid.split('@')[0]} has no Hall of Fame entry.`,
        mentions: [userJid]
      })
    }

    let text = `🗑️ *DELETE HALL OF FAME ENTRY*\n\n`
    text += `👤 Player: @${userJid.split('@')[0]}\n\n`
    text += `Reply with the number to delete.\n\n`

    data.forEach((item, index) => {
      text += `*${index + 1}.* ${normalizeLeague(item.league)}\n`
      text += `⚽ Team: ${item.team}\n`
      text += `🏆 Trophies: ${item.trophies}\n\n`
    })

    const sent = await sock.sendMessage(chatId, {
      text,
      mentions: [userJid]
    })

    const menuMsgId = sent.key.id

    // setup listener
    const listener = async (m) => {
      try {
        const reply = m.messages?.[0]
        if (!reply) return

        const replyFrom = reply.key.remoteJid
        const replySender =
          reply.key.participant || reply.key.remoteJid

        if (replyFrom !== chatId || replySender !== sender) return

        const context =
          reply.message?.extendedTextMessage?.contextInfo

        const isReply = context?.stanzaId === menuMsgId

        if (!isReply) return

        const body =
          reply.message?.conversation ||
          reply.message?.extendedTextMessage?.text ||
          ''

        const selected = parseInt(body.trim())

        if (isNaN(selected)) {
          await sock.sendMessage(chatId, {
            text: '❌ Reply with a valid number.'
          })

          sock.ev.off('messages.upsert', listener)
          return
        }

        const entry = data[selected - 1]

        if (!entry) {
          await sock.sendMessage(chatId, {
            text: '❌ Invalid selection number.'
          })

          sock.ev.off('messages.upsert', listener)
          return
        }

        await supabase
          .from('hall_of_fame')
          .delete()
          .eq('id', entry.id)

        await sock.sendMessage(chatId, {
          text:
            `✅ Hall of Fame entry deleted.\n\n` +
            `👤 @${userJid.split('@')[0]}\n` +
            `🏟️ ${normalizeLeague(entry.league)}\n` +
            `⚽ ${entry.team}`,
          mentions: [userJid]
        })

        sock.ev.off('messages.upsert', listener)

      } catch (err) {
        console.error(err)

        sock.ev.off('messages.upsert', listener)
      }
    }

    sock.ev.on('messages.upsert', listener)

  } catch (e) {
    console.error(e)

    await sock.sendMessage(chatId, {
      text: '❌ Failed to delete fame entry.'
    })
  }
}

module.exports = {
  addFame,
  showFame,
  showStats,
  deleteFame,
  listFame,
  normalizeLeague
}
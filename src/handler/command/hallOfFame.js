const supabase = require('../../supabaseClient')
const { checkIfAdmin } = require('./kick')
const { callAI } = require('../../utils/aiProviderManager')

function getRankCategory(trophies) {
  if (trophies >= 10) return { category: 'LEGEND', emoji: '👑', stars: '⭐⭐⭐⭐⭐⭐', nextTier: 'Already at the top!', needed: 0 }
  if (trophies >= 7) return { category: 'CHAMPION', emoji: '🏆', stars: '⭐⭐⭐⭐⭐', nextTier: 'Legend', needed: 10 - trophies }
  if (trophies >= 5) return { category: 'MASTER', emoji: '🥇', stars: '⭐⭐⭐⭐', nextTier: 'Champion', needed: 7 - trophies }
  if (trophies >= 3) return { category: 'EXPERT', emoji: '🥈', stars: '⭐⭐⭐', nextTier: 'Master', needed: 5 - trophies }
  if (trophies >= 2) return { category: 'RISING STAR', emoji: '🌟', stars: '⭐⭐', nextTier: 'Expert', needed: 3 - trophies }
  if (trophies >= 1) return { category: 'ROOKIE', emoji: '🔰', stars: '⭐', nextTier: 'Rising Star', needed: 2 - trophies }
  return { category: 'NEWCOMER', emoji: '🌱', stars: '', nextTier: 'Rookie', needed: 1 }
}

function getProgressionMessage(totalTrophies, rankInfo) {
  if (totalTrophies === 1) return "🌟 Amazing start! You've earned your first trophy and are now a ROOKIE!\n🎯 Next goal: Earn 1 more trophy to become a Rising Star!"
  if (totalTrophies === 2) return "🌟 Great progress! You're now a RISING STAR!\n🎯 Next goal: Earn 1 more trophy to become an EXPERT!"
  if (totalTrophies === 3) return "⭐ Impressive! You've reached EXPERT level!\n🎯 Next goal: Earn 2 more trophies to become a MASTER!"
  if (totalTrophies === 5) return "⭐⭐ Outstanding! You're now a MASTER!\n🎯 Next goal: Earn 2 more trophies to become a CHAMPION!"
  if (totalTrophies === 7) return "⭐⭐⭐ Incredible! You've achieved CHAMPION status!\n🎯 Next goal: Earn 3 more trophies to become a LEGEND!"
  if (totalTrophies >= 10) return "👑 LEGENDARY! You're a true LEGEND of this community!\n🏆 You've reached the pinnacle of success!"
  return `🎯 Next goal: Earn ${rankInfo.needed} more trophy${rankInfo.needed > 1 ? 's' : ''} to become a ${rankInfo.nextTier}!`
}

let hallAnnouncementSequence = 0

async function generateHallCongratulation(facts) {
  hallAnnouncementSequence += 1
  const compositionStyles = [
    'Open with the achievement or match context, then weave in the rank and next target.',
    'Open with the player mention and a vivid celebration, then reveal the milestone and progression naturally.',
    'Open with the new rank or milestone, then connect the trophy achievement to the player journey.',
    'Use a short sports-commentary style announcement with varied sentence lengths and a memorable closing.',
    'Use a warm, classy community announcement that leads with the significance of the win rather than a generic congratulations.'
  ]
  const compositionStyle = compositionStyles[(hallAnnouncementSequence - 1) % compositionStyles.length]

  const prompt = `Create only the congratulatory and progression section of an elegant Hall of Fame achievement announcement for a competitive eFootball community. Return only WhatsApp-ready text, with no explanation, JSON, labels, or factual data table.

Use the exact facts below to make the wording exciting, classy, natural and genuinely fresh. This is announcement variation ${hallAnnouncementSequence}; use this composition direction: ${compositionStyle}

Two consecutive announcements may contain similar facts, but they must feel like independently written announcements, not rewrites of the same template. Vary the opening, sentence lengths, order of ideas, transitions, verbs, and closing. Do not use a fixed five-step structure such as congratulations, rank, totals, next tier, congratulations. Do not begin with the same type of sentence as the previous announcement.

Never use or closely imitate these repetitive patterns: “Only X more trophies stand between you...”, “Keep the fire burning”, “your next triumph is within reach”, “you’re now...”, or “bringing your total to...”. Avoid generic template phrases such as “another trophy, another statement” and avoid repeating the same metaphor or sentence structure.

Do not invent facts, alter numbers, round numbers, recalculate values, rename values, or change the player mention, community name, league, or team. Correctly reflect the current rank, rank emoji, stars, next tier, and exact number of trophies needed. Celebrate the milestone status naturally. Include a congratulatory closing.

If the player is already LEGEND and nextTier is "Already at the top!", do not mention earning more trophies. Celebrate reaching the pinnacle instead.

Exact facts:
Player mention: ${facts.playerMention}
Community name: ${facts.communityName}
Achievement / normalized league: ${facts.league}
Team: ${facts.team}
Trophies in this entry: ${facts.entryTrophies}
Total trophies in community: ${facts.communityTotalTrophies}
Total trophies won by player: ${facts.totalTrophies}
Current rank: ${facts.rank}
Rank emoji: ${facts.rankEmoji}
Rank stars: ${facts.stars || '(none)'}
Next tier: ${facts.nextTier}
Trophies needed for next tier: ${facts.needed}
Milestone status: ${facts.milestoneStatus}

The final text must preserve the supplied facts in its wording and be suitable for WhatsApp.`

  try {
    const result = await callAI(`hall-of-fame:${facts.playerMention}:${facts.league}:${facts.team}:${hallAnnouncementSequence}`, [{ role: 'user', content: prompt }])
    if (result?.success && result.text?.trim()) return result.text.trim()
  } catch (error) {
    console.error('[HALL OF FAME] AI wording failed, using factual fallback:', error.message)
  }

  const fallbackProgression = getProgressionMessage(facts.totalTrophies, facts.rankInfo)
  return [
    `🎉 Congratulations ${facts.playerMention}!`,
    `A brilliant achievement in ${facts.league} with ${facts.team}.`,
    'Your consistency and determination continue to build an impressive legacy!',
    fallbackProgression
  ].join('\n\n')
}

function getMilestoneStatus(totalTrophies) {
  if (totalTrophies === 1) return 'Reached the first trophy milestone and entered ROOKIE.'
  if (totalTrophies === 2) return 'Reached the RISING STAR milestone.'
  if (totalTrophies === 3) return 'Reached the EXPERT milestone.'
  if (totalTrophies === 5) return 'Reached the MASTER milestone.'
  if (totalTrophies === 7) return 'Reached the CHAMPION milestone.'
  if (totalTrophies >= 10) return 'Reached the LEGEND milestone and the pinnacle rank.'
  return `Currently progressing toward the ${getRankCategory(totalTrophies).nextTier} rank.`
}

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
    const { data: existing, error: existingError } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('community_jid', community.communityJid)
      .eq('user_jid', userJid)
      .eq('league', league)
      .eq('team', team)
      .maybeSingle()

    if (existingError) {
      throw existingError
    }

    let newTrophyCount = 1
    if (existing) {
      newTrophyCount = Number(existing.trophies || 0) + 1
      const { error: updateError } = await supabase
        .from('hall_of_fame')
        .update({ trophies: newTrophyCount })
        .eq('id', existing.id)

      if (updateError) {
        throw updateError
      }
    } else {
      const { error: insertError } = await supabase.from('hall_of_fame').insert({
        community_jid: community.communityJid,
        community_name: community.communityName,
        user_jid: userJid,
        league,
        team,
        trophies: 1
      })

      if (insertError) {
        throw insertError
      }
    }

    // Get user's total trophies in this community
    const { data: userAllTrophies, error: userTrophiesError } = await supabase
      .from('hall_of_fame')
      .select('trophies')
      .eq('community_jid', community.communityJid)
      .eq('user_jid', userJid)

    if (userTrophiesError) {
      throw userTrophiesError
    }

    const totalTrophies = userAllTrophies?.reduce((sum, record) => sum + Number(record.trophies || 0), 0) || 0

    // Get total trophies in this community (all users)
    const { data: communityAllTrophies, error: communityTrophiesError } = await supabase
      .from('hall_of_fame')
      .select('trophies')
      .eq('community_jid', community.communityJid)

    if (communityTrophiesError) {
      throw communityTrophiesError
    }

    const communityTotalTrophies = communityAllTrophies?.reduce((sum, record) => sum + Number(record.trophies || 0), 0) || 0

    const rankInfo = getRankCategory(totalTrophies)
    const facts = {
      playerMention: `@${userJid.split('@')[0]}`,
      communityName: community.communityName,
      league: normalizeLeague(league),
      team,
      entryTrophies: newTrophyCount,
      communityTotalTrophies,
      totalTrophies,
      rank: rankInfo.category,
      rankEmoji: rankInfo.emoji,
      stars: rankInfo.stars,
      nextTier: rankInfo.nextTier,
      needed: rankInfo.needed,
      milestoneStatus: getMilestoneStatus(totalTrophies),
      rankInfo
    }
    const aiMessage = await generateHallCongratulation(facts)
    const message = `🏆 *HALL OF FAME UPDATE*\n\n${aiMessage}\n\n📝 You've been added to the *Hall of Fame* in *${facts.communityName}* community!\n\n🏟️ *Achievement:* ${facts.league}, *Team* ${facts.team}\n🏆 *Trophies in this entry:* ${facts.entryTrophies}\n📊 *Total trophies in community:* ${facts.communityTotalTrophies}\n🏅 *Total trophies won by you:* ${facts.totalTrophies}\n\n${facts.rankEmoji} *Current Rank:* ${facts.rank} ${facts.stars}\n\n━━━━━━━━━━━━━━━━━━\n🔥 Keep climbing the ranks! 🔥`

    await sock.sendMessage(chatId, {
      text: message,
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

    await sock.sendMessage(chatId, { text, mentions })
  } catch (e) {
    console.error(e)
    await sock.sendMessage(chatId, { text: '❌ Failed to load Hall of Fame.' })
  }
}

async function showStats(sock, chatId, returnText = false) {
  try {
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
      mentions
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
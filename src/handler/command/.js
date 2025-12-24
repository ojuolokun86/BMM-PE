// // // // sudo apt-get update
// // // //             sudo apt-get install -y imagemagick


// robocopy "e:\Bot development\BOT V2\BMM DEV V2\src" "e:\Bot development\BOT V2\AWS-SERVER\src" /E /XD node_modules .github /XF .env package-lock.json fly.toml 
// robocopy "e:\Bot development\BOT V2\BMM DEV V2\src" "e:\Bot development\BOT V2\AZURE\src" /E /XD node_modules .github /XF .env package-lock.json fly.toml 
// robocopy "e:\Bot development\BOT V2\BMM DEV V2\src" "e:\Bot development\BOT V2\ORACLE 1\src" /E /XD node_modules .github /XF .env package-lock.json fly.toml 
// // copy "e:\Bot development\BOT V2\BMM DEV V2\package.json" "e:\Bot development\BOT V2\AWS-SERVER\package.json"
// // copy "e:\Bot development\BOT V2\BMM DEV V2\package.json" "e:\Bot development\BOT V2\ORACLE\package.json"
// // copy "e:\Bot development\BOT V2\BMM DEV V2\package.json" "e:\Bot development\BOT V2\ORACLE 1\package.json"
// // robocopy "e:\Bot development\BOT V2\BMM DEV V2\src" "e:\Bot development\BOT V2\AWS-SERVER\scripts"
// // robocopy "e:\Bot development\BOT V2\BMM DEV V2\src" "e:\Bot development\BOT V2\ORACLE\scripts"
// // robocopy "e:\Bot development\BOT V2\BMM DEV V2\src" "e:\Bot development\BOT V2\ORACLE 1\scripts"




// // npm version patch
// // npm version minor
// // npm version major


//  git add .
//  git commit -m "Save changes before version bump"
//  npm version minor
// const {
//     followTeam,
//     unfollowTeam,
//     getFollowedTeams,
//     isFollowingTeam,
//     getTeamsToCheck,
//     updateTeamMatchInfo,
//     updateTeamNews,
//     getTeamFollowers
//   } = require('../../database/footballDb');
//   const sendToChat = require('../../utils/sendToChat');
//   const { db } = require('../../database/database');
//   const { footballApp } = require('../features/footballApp');
  
//   // =====================================================
//   // BACKGROUND JOBS
//   // =====================================================
//   async function checkTeamUpdates(sock) {
//     try {
//       const teams = await getTeamsToCheck();
//       for (const team of teams) {
//         try {
//           await checkTeamNews(sock, team);
//           await checkTeamMatches(sock, team);
//         } catch (error) {
//           console.error(`Error checking updates for ${team.team_name}:`, error);
//         }
//       }
//     } catch (error) {
//       console.error('Error in team update check:', error);
//     }
//   }
  
//   async function checkTeamNews(sock, team) {
//     try {
//       const news = await footballApp('news');
//       if (!news?.length) return;
  
//       const latestNews = news[0];
//       if (latestNews.id !== team.last_news_id) {
//         const followers = await getTeamFollowers(team.team_id);
//         if (followers.length > 0) {
//           const message =
//             `📰 *${team.team_name} News*\n\n` +
//             `*${latestNews.title}*\n` +
//             `${latestNews.summary || ''}\n\n` +
//             `🔗 Read more: ${latestNews.url}`;
  
//           for (const userId of followers) {
//             await sendToChat(sock, { key: { remoteJid: `${userId}@s.whatsapp.net` } }, { message });
//           }
  
//           await updateTeamNews(team.team_id, latestNews.id);
//         }
//       }
//     } catch (error) {
//       console.error('Error checking team news:', error);
//     }
//   }
  
//   async function checkTeamMatches(sock, team) {
//     try {
//       const fixtures = await footballApp('fixtures', team.team_id);
//       if (!fixtures?.events?.length) return;
  
//       const nextMatch = fixtures.events[0];
//       const now = Math.floor(Date.now() / 1000);
  
//       if (nextMatch.startTimestamp <= now + 3600 && nextMatch.startTimestamp > now) {
//         const followers = await getTeamFollowers(team.team_id);
//         if (followers.length > 0) {
//           const message =
//             `⚽ *${team.team_name} Match Starting Soon!*\n\n` +
//             `*${nextMatch.homeTeam.name} vs ${nextMatch.awayTeam.name}*\n` +
//             `🏆 ${nextMatch.tournament?.name || 'Match'}\n` +
//             `⏰ ${new Date(nextMatch.startTimestamp * 1000).toLocaleString()}\n` +
//             (nextMatch.venue ? `🏟️ ${nextMatch.venue.name}` : '');
  
//           for (const userId of followers) {
//             await sendToChat(sock, { key: { remoteJid: `${userId}@s.whatsapp.net` } }, { message });
//           }
//         }
//       }
  
//       await updateTeamMatchInfo(team.team_id, nextMatch.id, nextMatch.startTimestamp);
//     } catch (error) {
//       console.error('Error checking team matches:', error);
//     }
//   }
  
//   // =====================================================
//   // HELPERS
//   // =====================================================
//   function formatMatchTime(timestamp) {
//     const date = new Date(timestamp);
//     return date.toLocaleString('en-US', {
//       weekday: 'short',
//       month: 'short',
//       day: 'numeric',
//       hour: '2-digit',
//       minute: '2-digit',
//       timeZone: 'UTC',
//       hour12: true
//     });
//   }
  
//   function formatMatchStatus(status, elapsed) {
//     const statusMap = {
//       notstarted: '⏳ Not Started',
//       inprogress: elapsed ? `🟢 ${elapsed}'` : '🟢 In Progress',
//       halftime: '⏸️ Half Time',
//       extratime: `⚽ ${elapsed || ''} ET`,
//       penalties: '⏸️ Penalties',
//       finished: '✅ Full Time',
//       aet: '✅ AET',
//       suspended: '⛔ Suspended',
//       interrupted: '⏸️ Interrupted',
//       postponed: '⏸️ Postponed',
//       cancelled: '❌ Cancelled',
//       abandoned: '❌ Abandoned'
//     };
//     return statusMap[status?.toLowerCase()] || status;
//   }
  
//   function formatMatchDetails(match) {
//     const home = match.homeTeam?.name || 'Home';
//     const away = match.awayTeam?.name || 'Away';
//     const score = `${match.homeScore?.current ?? 0} - ${match.awayScore?.current ?? 0}`;
//     const status = formatMatchStatus(match.status?.type, match.time?.current);
//     const time = formatMatchTime(match.startTimestamp * 1000);
//     return `⚽ *${home} vs ${away}*\n` +
//            `🏆 ${match.tournament?.name || 'Match'}\n` +
//            `📅 ${time} • ${status}\n` +
//            `🏟️ ${match.venue?.name || 'Unknown Venue'}\n` +
//            `🔢 Score: ${score}`;
//   }
  
//   function broadcastToFollowers(sock, followers, message) {
//     followers.forEach(async (jid) => {
//       try {
//         await sendToChat(sock, { key: { remoteJid: jid } }, { message });
//       } catch (error) {
//         console.error(`Failed to send update to ${jid}:`, error.message);
//       }
//     });
//   }
  
//   // =====================================================
//   // FOLLOW / UNFOLLOW
//   // =====================================================
//   async function searchTeams(query) {
//     return footballApp('search', query);
//   }
  
//   async function handleFollowTeam(sock, from, teamQuery, userId) {
//     if (!teamQuery) {
//       return sendToChat(sock, from, { message: '❌ Please specify a team name. Example: *football follow "Real Madrid"*' });
//     }
//     const searchResults = await footballApp('search', teamQuery);
//     if (!searchResults?.teams?.length) {
//       return sendToChat(sock, from, { message: `❌ No teams found matching "${teamQuery}".` });
//     }
  
//     const team = searchResults.teams[0];
//     if (await isFollowingTeam(userId, team.id)) {
//       return sendToChat(sock, from, { message: `ℹ️ You are already following ${team.name}.` });
//     }
  
//     await followTeam(userId, team.id, team.name);
//     return sendToChat(sock, from, {
//       message: `✅ Now following *${team.name}* You'll get updates about their matches and news.`
//     });
//   }
  
//   async function handleUnfollowTeam(sock, from, teamQuery, userId) {
//     if (!teamQuery) {
//       return sendToChat(sock, from, { message: '❌ Please specify a team name. Example: *football unfollow "Real Madrid"*' });
//     }
//     const followed = await getFollowedTeams(userId);
//     const teamToUnfollow = followed.find(t => t.name.toLowerCase().includes(teamQuery.toLowerCase()));
//     if (!teamToUnfollow) {
//       return sendToChat(sock, from, { message: `❌ You are not following "${teamQuery}".` });
//     }
//     await unfollowTeam(userId, teamToUnfollow.id);
//     return sendToChat(sock, from, { message: `✅ You have unfollowed ${teamToUnfollow.name}.` });
//   }
  
//   async function handleListFollowedTeams(sock, from, userId) {
//     console.log('=== Listing followed teams ===');
//     console.log('User ID:', userId);
    
//     try {
//       const followed = await getFollowedTeams(userId);
//       console.log('Followed teams data from DB:', JSON.stringify(followed, null, 2));
      
//       if (!followed || !followed.length) {
//         console.log('No teams found for user');
//         return sendToChat(sock, from, { 
//           message: '📋 You are not following any teams. Use *football follow [team]* to follow one.' 
//         });
//       }
      
//       let message = '⚽ *Your Followed Teams* ⚽\n\n';
//       followed.forEach((team, i) => { 
//         console.log(`Team ${i + 1}:`, JSON.stringify(team, null, 2));
//         message += `${i + 1}. ${team.name || 'Unknown Team'}\n`; 
//       });
      
//       console.log('Final message to send:', message);
//       return sendToChat(sock, from, { message });
      
//     } catch (error) {
//       console.error('Error in handleListFollowedTeams:', error);
//       return sendToChat(sock, from, { 
//         message: '❌ An error occurred while fetching your followed teams.' 
//       });
//     }
//   }
  
//   // =====================================================
//   // LIVE SCORES & SEARCH
//   // =====================================================
//   async function handleLiveScores(sock, from, query, userId) {
//     try {
//       let matches = [];
      
//       if (query) {
//         // Search for team and get their live matches
//         const searchResults = await footballApp('search', query);
//         if (!searchResults?.teams?.length) {
//           return sendToChat(sock, from, { 
//             message: `❌ No teams found matching "${query}".`
//           });
//         }
        
//         const team = searchResults.teams[0];
//         const liveData = await footballApp('live');
//         matches = liveData?.events?.filter(event => 
//           event.homeTeam?.id === team.id || event.awayTeam?.id === team.id
//         ) || [];
        
//         if (matches.length === 0) {
//           return sendToChat(sock, from, {
//             message: `No live matches found for ${team.name}.`
//           });
//         }
//       } else {
//         // Get all live matches for followed teams
//         const followedTeams = await getFollowedTeams(userId);
//         if (followedTeams.length === 0) {
//           return sendToChat(sock, from, {
//             message: 'You\'re not following any teams. Use *football follow [team]* to follow a team.'
//           });
//         }
        
//         const liveData = await footballApp('live');
//         const teamIds = new Set(followedTeams.map(t => t.id)); // Changed from t.team_id to t.id
//         matches = liveData?.events?.filter(event => 
//           teamIds.has(event.homeTeam?.id) || teamIds.has(event.awayTeam?.id)
//         ) || [];
        
//         if (matches.length === 0) {
//           const teamNames = followedTeams.map(t => t.name).join(', ');
//           return sendToChat(sock, from, {
//             message: `No live matches found for your followed teams: ${teamNames}`
//           });
//         }
//       }
      
//       // Format and send the matches
//       let message = '⚽ *Live Matches* ⚽\n\n';
//       matches.forEach(match => {
//         const homeTeam = match.homeTeam?.name || 'Unknown';
//         const awayTeam = match.awayTeam?.name || 'Unknown';
//         const score = match.score?.fullTime || {};
//         const status = formatMatchStatus(match.status, match.time);
        
//         message += `${homeTeam} ${score.home || '0'} - ${score.away || '0'} ${awayTeam}\n`;
//         message += `Status: ${status}\n\n`;
//       });
      
//       return sendToChat(sock, from, { message });
      
//     } catch (error) {
//       console.error('Error in handleLiveScores:', error);
//       return sendToChat(sock, from, {
//         message: '❌ An error occurred while fetching live scores.'
//       });
//     }
//   }
  
//   async function handleTeamSearch(sock, from, query, userId, prefix) {
//     try {
//       if (!query) {
//         return sendToChat(sock, from, {
//           message: `🔍 Please specify a team to search.\nExample: *${prefix}football search manchester united*`
//         });
//       }
      
//       const searchResults = await footballApp('search', query);
//       if (!searchResults?.teams?.length) {
//         console.log("No teams found matching " + query);
//         return sendToChat(sock, from, {
//           message: `❌ No teams found matching "${query}".`
//         });
//       }
      
//       // Get first 5 results
//       const results = searchResults.teams.slice(0, 5);
//       let message = '🔍 *Search Results* 🔍\n\n';
      
//       results.forEach((team, index) => {
//         message += `${index + 1}. *${team.name}*`;
//         if (team.country) message += ` (${team.country.name})`;
//         message += '\n';
        
//         // Add follow/unfollow button
//         const isFollowing = getFollowedTeams(userId).some(t => t.team_id === team.id);
//         message += `   ${isFollowing ? '✅ Following' : '❌ Not following'}\n\n`;
//       });
      
//       message += '\nReply with *follow [number]* to follow a team.';
      
//       return sendToChat(sock, from, { message });
      
//     } catch (error) {
//       console.error('Error in team search:', error);
//       return sendToChat(sock, from, {
//         message: '❌ Failed to search for teams. Please try again later.'
//       });
//     }
//   }
  
//   // =====================================================
//   // COMMAND HANDLER
//   // =====================================================
//   module.exports = {
//     handleFootballCommand: async ({ sock, msg, from, textMsg, prefix, userId }) => {
//       try {
//         // Remove the command prefix and any extra spaces
//         let commandText = textMsg.trim();
        
//         // Handle both prefixed (.football) and non-prefixed (football) commands
//         if (commandText.toLowerCase().startsWith(prefix + 'football')) {
//           commandText = commandText.substring((prefix + 'football').length).trim();
//         } else if (commandText.toLowerCase().startsWith('football')) {
//           commandText = commandText.substring('football'.length).trim();
//         }
        
//         // If no subcommand is provided, show help
//         if (!commandText) {
//           const help =
//             `⚽ *Football Commands* ⚽\n\n` +
//             `• ${prefix}football follow [team] - Follow a team for updates\n` +
//             `• ${prefix}football unfollow [team] - Stop following a team\n` +
//             `• ${prefix}football myteams - List your followed teams\n` +
//             `• ${prefix}football live [team] - Show live matches\n` +
//             `• ${prefix}football search [team] - Search for teams`;
//           return sendToChat(sock, from, { message: help });
//         }
        
//         // Split into subcommand and query
//         const firstSpace = commandText.indexOf(' ');
//         const subCommand = firstSpace === -1 ? commandText : commandText.substring(0, firstSpace).trim();
//         const query = firstSpace === -1 ? '' : commandText.substring(firstSpace + 1).trim();
  
//         switch (subCommand.toLowerCase()) {
//           case 'follow': 
//             if (!query) {
//               return sendToChat(sock, from, { 
//                 message: `❌ Please specify a team to follow.\nExample: *${prefix}football follow manchester united*` 
//               });
//             }
//             return handleFollowTeam(sock, from, query, userId);
            
//           case 'unfollow': 
//             if (!query) {
//               return sendToChat(sock, from, { 
//                 message: `❌ Please specify a team to unfollow.\nExample: *${prefix}football unfollow manchester united*` 
//               });
//             }
//             return handleUnfollowTeam(sock, from, query, userId);
            
//           case 'myteams': 
//             return handleListFollowedTeams(sock, from, userId);
            
//           case 'live': 
//             return handleLiveScores(sock, from, query, userId);
            
//           case 'search': 
//             if (!query) {
//               return sendToChat(sock, from, {
//                 message: `🔍 Please specify a team to search.\nExample: *${prefix}football search manchester united*`
//               });
//             }
//             return handleTeamSearch(sock, from, query, userId, prefix);
            
//           default: 
//             console.log("unknown command", subCommand, query);
//             return sendToChat(sock, from, { 
//               message: `❌ Unknown command ${subCommand}. Type *${prefix}football* to see available commands.` 
//             });
//         }
//       } catch (error) {
//         console.error('Error in football command:', error);
//         return sendToChat(sock, from, { message: '❌ Something went wrong. Try again later.' });
//       }
//     }
//   };
  
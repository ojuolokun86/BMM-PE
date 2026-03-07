function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper function to get group name
 */
async function getGroupName(sock, groupId) {
  try {
    const metadata = await sock.groupMetadata(groupId);
    return metadata.subject || 'Unknown Group';
  } catch (error) {
    return 'Unknown Group';
  }
}

/**
 * Copy all members from one WhatsApp group to another group
 * @param {Object} sock - Baileys socket instance
 * @param {string} sourceGroupId - Source group JID (e.g., '1234567890@g.us')
 * @param {string} targetGroupId - Target group JID (e.g., '0987654321@g.us')
 * @returns {Promise<Object>} - Results object with stats
 */
async function copyGroupMembers(sock, sourceGroupId, targetGroupId) {
  const results = {
    totalFound: 0,
    totalSkipped: 0,
    totalAdded: 0,
    failed: 0,
    errors: [],
    scanSummary: {
      totalParticipants: 0,
      pnUsers: 0,
      lidUsers: 0,
      resolvedPn: 0,
      unresolvedLid: 0
    }
  };

  try {
    console.log(`🔄 Starting member copy from ${sourceGroupId} to ${targetGroupId}`);
    
    // Get source group metadata and participants
    const sourceMetadata = await sock.groupMetadata(sourceGroupId);
    const sourceParticipants = sourceMetadata?.participants || [];
    
    // Get target group metadata and existing participants
    const targetMetadata = await sock.groupMetadata(targetGroupId);
    const targetParticipants = targetMetadata?.participants || [];
    
    // Get bot's JID to exclude it
    const botJid = sock.user.id;
    
    console.log(`📊 Source group has ${sourceParticipants.length} participants`);
    console.log(`📊 Target group has ${targetParticipants.length} participants`);
    
    // Extract all participant JIDs from source group
    const sourceJids = sourceParticipants
      .map(p => p.id)
      .filter(jid => jid !== botJid); // Remove bot itself
    
    // Remove duplicates
    const uniqueSourceJids = [...new Set(sourceJids)];
    results.totalFound = uniqueSourceJids.length;
    results.scanSummary.totalParticipants = uniqueSourceJids.length;
    
    console.log(`📊 Unique members to process: ${uniqueSourceJids.length}`);
    
    // Create set of existing target group members for quick lookup
    const targetJidSet = new Set(targetParticipants.map(p => p.id));
    
    // Filter out members already in target group
    const membersToAdd = uniqueSourceJids.filter(jid => !targetJidSet.has(jid));
    results.totalSkipped = uniqueSourceJids.length - membersToAdd.length;
    
    console.log(`📊 Members to add: ${membersToAdd.length}`);
    console.log(`📊 Members already in target: ${results.totalSkipped}`);
    
    if (membersToAdd.length === 0) {
      console.log('✅ No new members to add');
      return results;
    }
    
    // Log detailed participant information using LID mapping store
    console.log('📋 Starting detailed participant scan with LID mapping...');
    console.log('─'.repeat(30));
    
    // Get the LID mapping store from the socket
    const lidStore = sock.signalRepository?.lidMapping;
    
    if (!lidStore) {
      console.log('⚠️ LID mapping store not available, proceeding without PN resolution');
    } else {
      // Try to refresh LID mappings for the entire source group
      console.log('🔄 Refreshing LID mappings for source group...');
      try {
        // Trigger a refresh by accessing the group metadata again
        await sock.groupMetadata(sourceGroupId);
        console.log('✅ Group metadata refreshed, LID mappings should update');
        
        // Small delay to allow mappings to update
        await sleep(2000);
      } catch (refreshError) {
        console.log(`❌ Group refresh failed: ${refreshError.message}`);
      }
    }
    
    // Collect all LID users first
    const lidUsers = [];
    const participantsToAdd = [];
    const businessUsers = [];
    
    // Process participants one by one with detailed logging
    for (const participantJid of uniqueSourceJids) {
      const isPn = participantJid.endsWith('@s.whatsapp.net');
      const isLid = participantJid.endsWith('@lid');
      
      // Update counters
      if (isPn) {
        results.scanSummary.pnUsers++;
      } else if (isLid) {
        results.scanSummary.lidUsers++;
        lidUsers.push(participantJid); // Collect LID users for batch mention
      }
      
      console.log('─'.repeat(30));
      console.log('👤 Participant Info');
      console.log(`JID  : ${participantJid}`);
      console.log(`Type : ${isPn ? 'PN' : 'LID'}`);
      
      // Try to get participantAlt information (await the Promise)
      let altInfo = null;
      let isBusiness = false;
      try {
        if (sock.participantAlt) {
          altInfo = await sock.participantAlt(participantJid);
          console.log(`Alt Info : ${JSON.stringify(altInfo)}`);
          
          // Check if it's a business account
          if (altInfo && altInfo.biz) {
            isBusiness = true;
            console.log(`🏢 Business Account : Yes (via participantAlt)`);
          } else {
            console.log(`👤 Business Account : No (via participantAlt)`);
          }
        } else {
          console.log(`Alt Info : participantAlt function not available`);
        }
      } catch (error) {
        console.log(`Alt Info : Error - ${error.message}`);
      }
      
      // Alternative business detection using profile info
      if (!isBusiness && !altInfo) {
        try {
          // Try to get profile picture and check if it's a business profile
          const profilePic = await sock.profilePictureUrl(participantJid).catch(() => null);
          if (profilePic) {
            // Business accounts often have specific profile picture patterns
            // This is a heuristic - not 100% accurate
            console.log(`📸 Profile Picture : Available`);
            
            // Try to get WhatsApp info to check business status
            const whatsappInfo = await sock.onWhatsApp([participantJid]).catch(() => null);
            if (whatsappInfo && whatsappInfo[0]) {
              console.log(`🔍 WhatsApp Info : ${JSON.stringify(whatsappInfo[0])}`);
              
              // Check for business indicators in WhatsApp info
              if (whatsappInfo[0].bizName || whatsappInfo[0].bizVerified) {
                isBusiness = true;
                console.log(`🏢 Business Account : Yes (via WhatsApp info)`);
              } else {
                console.log(`👤 Business Account : No (via WhatsApp info)`);
              }
            } else {
              console.log(`👤 Business Account : Unknown (no WhatsApp info)`);
            }
          } else {
            console.log(`📸 Profile Picture : Not available`);
            console.log(`👤 Business Account : Unknown (no profile data)`);
          }
        } catch (profileError) {
          console.log(`📸 Profile check failed: ${profileError.message}`);
        }
      }
      
      // Log final business determination
      console.log(`🏢 Final Business Status : ${isBusiness ? 'Yes' : 'No'}`);
      
      let finalJidToAdd = null;
      let status = 'Skipped';
      
      if (isPn) {
        // PN user - directly addable
        if (!targetJidSet.has(participantJid)) {
          // Use the full JID format for PN users
          finalJidToAdd = participantJid;
          status = 'Addable';
          console.log(`PN   : Available`);
          console.log(`Status : Addable`);
        } else {
          status = 'Already in target';
          console.log(`PN   : Available`);
          console.log(`Status : Already in target`);
        }
      } else if (isLid) {
        // LID user - check if we can resolve PN (will be done after batch mention)
        console.log(`🔄 LID user detected, will resolve after batch mention`);
        status = 'Pending LID resolution';
      } else {
        console.log(`PN   : Unknown format`);
        console.log(`Status : Cannot process`);
      }
      
      // Check if already in target group
      if (targetJidSet.has(participantJid) || (finalJidToAdd && targetJidSet.has(finalJidToAdd))) {
        console.log(`Note : Already in target group`);
        status = 'Already in target';
        finalJidToAdd = null;
      }
      
      // Store participant data for later processing
      const participantData = {
        originalJid: participantJid,
        finalJid: finalJidToAdd,
        type: isPn ? 'PN' : 'LID',
        isBusiness: isBusiness,
        status: status
      };
      
      if (isPn && finalJidToAdd) {
        participantsToAdd.push(participantData);
        console.log(`👤 Normal user queued for addition: ${finalJidToAdd}`);
      } else if (isLid) {
        // Will be processed after LID resolution
        console.log(`🔄 LID user queued for resolution: ${participantJid}`);
      }
    }
    
    // Send batch mention message if there are LID users
    if (lidUsers.length > 0) {
      try {
        console.log(`🔄 Sending batch mention for ${lidUsers.length} LID users...`);
        
        // Send a single message mentioning all LID users
        const tempMessage = "Hello everyone! 👋";
        await sock.sendMessage(sourceGroupId, {
          text: tempMessage,
          mentions: lidUsers
        });
        
        // Wait for WhatsApp to process all mentions and update mappings
        console.log(`⏳ Waiting 5 seconds for LID mappings to update...`);
        await sleep(5000);
        
        // Delete the temporary message
        try {
          await sock.sendMessage(sourceGroupId, { delete: { remoteJid: sourceGroupId, fromMe: true, id: 'temp' } });
        } catch (deleteError) {
          // Ignore delete errors
        }
        
        console.log(`✅ Batch LID mention sent, mappings should be updated`);
      } catch (mentionError) {
        console.log(`❌ Failed to send batch LID mention: ${mentionError.message}`);
      }
    }
    
    // Now process LID users with updated mappings
    console.log('🔄 Processing LID users with updated mappings...');
    for (const participantJid of lidUsers) {
      console.log('─'.repeat(30));
      console.log(`🔄 Processing LID: ${participantJid}`);
      
      let resolvedPn = null;
      if (lidStore) {
        try {
          resolvedPn = await lidStore.getPNForLID(participantJid);
          console.log(`🔍 LID resolution for ${participantJid}: ${resolvedPn || 'Not found'}`);
        } catch (error) {
          console.log(`❌ Error resolving PN for LID ${participantJid}: ${error.message}`);
        }
      }
      
      let finalJidToAdd = null;
      let status = 'Cannot add yet';
      
      if (resolvedPn) {
        // Clean up the PN format and use full JID format
        const cleanPn = resolvedPn.split(':')[0]; // Remove device suffix
        const phoneNumberOnly = cleanPn.split('@')[0]; // Remove @s.whatsapp.net if present
        finalJidToAdd = phoneNumberOnly + '@s.whatsapp.net'; // Add @s.whatsapp.net back
        status = 'Addable';
        console.log(`Resolved PN : ${finalJidToAdd} (via batch mention)`);
        console.log(`Status : PN mapping found`);
        results.scanSummary.resolvedPn++;
      } else {
        console.log(`Resolved PN : Not found (even after batch mention)`);
        console.log(`Status : Cannot add yet`);
        results.scanSummary.unresolvedLid++;
      }
      
      // Check if already in target group
      if (targetJidSet.has(participantJid) || (finalJidToAdd && targetJidSet.has(finalJidToAdd))) {
        console.log(`Note : Already in target group`);
        status = 'Already in target';
        finalJidToAdd = null;
      }
      
      // Add to appropriate list if we have a valid JID to add
      if (finalJidToAdd && status === 'Addable') {
        // Find the participant data and update it
        const participantData = {
          originalJid: participantJid,
          finalJid: finalJidToAdd,
          type: 'LID',
          isBusiness: false, // Will be determined if needed
          status: status
        };
        
        // Check if business (simplified for now)
        if (finalJidToAdd === '2348026977793@s.whatsapp.net') {
          participantData.isBusiness = true;
          businessUsers.push(participantData);
          console.log(`🏢 Business user queued for addition: ${finalJidToAdd}`);
        } else {
          participantsToAdd.push(participantData);
          console.log(`👤 Normal user queued for addition: ${finalJidToAdd}`);
        }
      }
    }
    
    console.log('─'.repeat(30));
    
    // Print final scan summary
    console.log('Copy Scan Summary');
    console.log(`Total Participants : ${results.scanSummary.totalParticipants}`);
    console.log(`PN Users : ${results.scanSummary.pnUsers}`);
    console.log(`LID Users : ${results.scanSummary.lidUsers}`);
    console.log(`Resolved PN : ${results.scanSummary.resolvedPn}`);
    console.log(`Unresolved LID : ${results.scanSummary.unresolvedLid}`);
    console.log(`Normal Users : ${participantsToAdd.length}`);
    console.log(`Business Users : ${businessUsers.length}`);
    console.log('─'.repeat(30));
    
    // Add normal users first
    if (participantsToAdd.length > 0) {
      console.log(`🚀 Starting to add ${participantsToAdd.length} normal users...`);
      
      for (let i = 0; i < participantsToAdd.length; i++) {
        const participant = participantsToAdd[i];
        
        try {
          console.log(`📤 Adding ${participant.finalJid} (from ${participant.originalJid})...`);
          
          // Add one user at a time for rate limit protection
          const addResult = await sock.groupParticipantsUpdate(
            targetGroupId,
            [participant.finalJid],
            "add"
          );
          
          console.log(`🔍 Add result: ${JSON.stringify(addResult)}`);
          
          // Process result with better error handling
          if (addResult && addResult.length > 0) {
            const result = addResult[0];
            console.log(`🔍 First result: ${JSON.stringify(result)}`);
            
            if (result && result.status === "200") {
              results.totalAdded++;
              console.log(`✅ Successfully added ${participant.finalJid}`);
              
              // Send mention message to destination group
              try {
                const mentionMessage = `🎉 **Welcome to the group!**\n\n@${participant.finalJid.split('@')[0]} has been added from "${await getGroupName(sock, sourceGroupId)}"! 👋`;
                await sock.sendMessage(targetGroupId, { 
                  text: mentionMessage,
                  mentions: [participant.finalJid]
                });
              } catch (mentionError) {
                console.log(`❌ Failed to send mention message: ${mentionError.message}`);
              }
            } else if (result && result.status === 200) {
              results.totalAdded++;
              console.log(`✅ Successfully added ${participant.finalJid}`);
              
              // Send mention message to destination group
              try {
                const mentionMessage = `🎉 **Welcome to the group!**\n\n@${participant.finalJid.split('@')[0]} has been added from "${await getGroupName(sock, sourceGroupId)}"! 👋`;
                await sock.sendMessage(targetGroupId, { 
                  text: mentionMessage,
                  mentions: [participant.finalJid]
                });
              } catch (mentionError) {
                console.log(`❌ Failed to send mention message: ${mentionError.message}`);
              }
            } else {
              results.failed++;
              const errorMsg = `Failed to add ${participant.finalJid}: ${result?.status || 'Unknown'} - ${result?.error || 'Unknown error'}`;
              results.errors.push(errorMsg);
              console.log(`❌ ${errorMsg}`);
            }
          } else {
            results.failed++;
            const errorMsg = `Failed to add ${participant.finalJid}: No result returned from WhatsApp`;
            results.errors.push(errorMsg);
            console.log(`❌ ${errorMsg}`);
          }
          
          // Wait 6 seconds between each addition (10 users per minute)
          if (i < participantsToAdd.length - 1) {
            console.log('⏳ Waiting 6s before next user...');
            await sleep(6000);
          }
          
        } catch (error) {
          results.failed++;
          const errorMsg = `Error adding ${participant.finalJid}: ${error.message}`;
          results.errors.push(errorMsg);
          console.log(`❌ ${errorMsg}`);
          
          // Still wait before next user to avoid making things worse
          if (i < participantsToAdd.length - 1) {
            console.log('⏳ Error recovery: waiting 6s before next user...');
            await sleep(6000);
          }
        }
      }
    } else {
      console.log('ℹ️ No normal users available to add');
    }
    
    // Now try to add business users
    if (businessUsers.length > 0) {
      console.log(`🏢 Starting to add ${businessUsers.length} business users...`);
      
      for (let i = 0; i < businessUsers.length; i++) {
        const participant = businessUsers[i];
        
        try {
          console.log(`📤 Adding business user ${participant.finalJid} (from ${participant.originalJid})...`);
          
          // Add one user at a time for rate limit protection
          const addResult = await sock.groupParticipantsUpdate(
            targetGroupId,
            [participant.finalJid],
            "add"
          );
          
          console.log(`🔍 Add result: ${JSON.stringify(addResult)}`);
          
          // Process result with better error handling
          if (addResult && addResult.length > 0) {
            const result = addResult[0];
            console.log(`🔍 First result: ${JSON.stringify(result)}`);
            
            if (result && result.status === "200") {
              results.totalAdded++;
              console.log(`✅ Successfully added business user ${participant.finalJid}`);
              
              // Send mention message to destination group
              try {
                const mentionMessage = `🏢 **Business user added!**\n\n@${participant.finalJid.split('@')[0]} has been added from "${await getGroupName(sock, sourceGroupId)}"! Welcome! 🎉`;
                await sock.sendMessage(targetGroupId, { 
                  text: mentionMessage,
                  mentions: [participant.finalJid]
                });
              } catch (mentionError) {
                console.log(`❌ Failed to send mention message: ${mentionError.message}`);
              }
            } else if (result && result.status === 200) {
              results.totalAdded++;
              console.log(`✅ Successfully added business user ${participant.finalJid}`);
              
              // Send mention message to destination group
              try {
                const mentionMessage = `🏢 **Business user added!**\n\n@${participant.finalJid.split('@')[0]} has been added from "${await getGroupName(sock, sourceGroupId)}"! Welcome! 🎉`;
                await sock.sendMessage(targetGroupId, { 
                  text: mentionMessage,
                  mentions: [participant.finalJid]
                });
              } catch (mentionError) {
                console.log(`❌ Failed to send mention message: ${mentionError.message}`);
              }
            } else {
              results.failed++;
              const errorMsg = `Failed to add business user ${participant.finalJid}: ${result?.status || 'Unknown'} - ${result?.error || 'Unknown error'}`;
              results.errors.push(errorMsg);
              console.log(`❌ ${errorMsg}`);
              
              // Send group invite message if business user addition failed
              try {
                const groupMetadata = await sock.groupMetadata(targetGroupId);
                const groupInviteCode = await sock.groupInviteCode(targetGroupId);
                const groupLink = `https://chat.whatsapp.com/${groupInviteCode}`;
                
                const inviteMessage = `👋 Hello! I tried adding you to our group "${groupMetadata.subject}" but couldn't add you directly. 

🎯 I'd love for you to join our community! Click here to join:
${groupLink}

📱 Looking forward to having you with us! 😊`;
                
                await sock.sendMessage(participant.finalJid, { text: inviteMessage });
                console.log(`📨 Sent group invite to business user ${participant.finalJid}`);
              } catch (inviteError) {
                console.log(`❌ Failed to send invite to ${participant.finalJid}: ${inviteError.message}`);
              }
            }
          } else {
            results.failed++;
            const errorMsg = `Failed to add business user ${participant.finalJid}: No result returned from WhatsApp`;
            results.errors.push(errorMsg);
            console.log(`❌ ${errorMsg}`);
            
            // Send group invite message if no response (likely privacy settings)
            try {
              const groupMetadata = await sock.groupMetadata(targetGroupId);
              const groupInviteCode = await sock.groupInviteCode(targetGroupId);
              const groupLink = `https://chat.whatsapp.com/${groupInviteCode}`;
              
              const inviteMessage = `👋 Hello! I tried adding you to our group "${groupMetadata.subject}" but couldn't add you directly. 

🎯 I'd love for you to join our community! Click here to join:
${groupLink}

📱 Looking forward to having you with us! 😊`;
              
              await sock.sendMessage(participant.finalJid, { text: inviteMessage });
              console.log(`📨 Sent group invite to business user ${participant.finalJid} (privacy settings)`);
            } catch (inviteError) {
              console.log(`❌ Failed to send invite to ${participant.finalJid}: ${inviteError.message}`);
            }
          }
          
          // Wait 6 seconds between each addition
          if (i < businessUsers.length - 1) {
            console.log('⏳ Waiting 6s before next business user...');
            await sleep(6000);
          }
          
        } catch (error) {
          results.failed++;
          const errorMsg = `Error adding business user ${participant.finalJid}: ${error.message}`;
          results.errors.push(errorMsg);
          console.log(`❌ ${errorMsg}`);
          
          // Still wait before next user
          if (i < businessUsers.length - 1) {
            console.log('⏳ Error recovery: waiting 6s before next business user...');
            await sleep(6000);
          }
        }
      }
    } else {
      console.log('ℹ️ No business users available to add');
    }
    
    console.log('─'.repeat(30));
    console.log(`🎉 Member copy completed!`);
    console.log('Copy Summary');
    console.log(`Added: ${results.totalAdded}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Skipped: ${results.totalSkipped}`);
    console.log('─'.repeat(30));
    
  } catch (error) {
    console.error('❌ Fatal error in copyGroupMembers:', error);
    results.errors.push(`Fatal error: ${error.message}`);
  }
  
  return results;
}

/**
 * Get detailed group member statistics
 * @param {Object} sock - Baileys socket instance
 * @param {string} groupId - Group JID
 * @returns {Promise<Object>} - Group stats
 */
async function getGroupMemberStats(sock, groupId) {
  try {
    const metadata = await sock.groupMetadata(groupId);
    const participants = metadata?.participants || [];
    
    const stats = {
      total: participants.length,
      admins: participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').length,
      regular: participants.filter(p => !p.admin).length,
      bot: participants.filter(p => p.id === sock.user.id).length
    };
    
    return stats;
  } catch (error) {
    console.error('❌ Error getting group stats:', error);
    return { total: 0, admins: 0, regular: 0, bot: 0 };
  }
}

/**
 * Scan all group members with detailed logging and profile info
 * @param {Object} sock - Baileys socket instance
 * @param {string} groupId - Group JID
 * @returns {Promise<Object>} - Detailed scan results
 */
async function scanGroupMembers(sock, groupId) {
  try {
    const metadata = await sock.groupMetadata(groupId);
    const participants = metadata.participants;
    
    console.log(`📊 Group ${groupId} has ${participants.length} participants`);
    console.log('📋 Starting detailed participant scan...');
    console.log('─'.repeat(30));
    
    const scanResults = {
      total: participants.length,
      addable: 0,
      notAddable: 0,
      lidUsers: 0,
      pnUsers: 0,
      profilesFound: 0,
      members: []
    };
    
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      const jid = participant.id;
      const lid = participant.lid || null;
      const number = jid?.split('@')[0];
      
      // Determine if addable
      const isAddable = jid.endsWith('@s.whatsapp.net');
      const status = isAddable ? 'Addable' : 'Not Addable';
      
      // Update counters
      if (isAddable) {
        scanResults.addable++;
        scanResults.pnUsers++;
      } else {
        scanResults.notAddable++;
        scanResults.lidUsers++;
      }
      
      // Log participant details
      console.log('─'.repeat(30));
      console.log('👤 Participant Info');
      console.log('Number :', number);
      console.log('JID    :', jid);
      console.log('LID    :', lid || 'null');
      console.log('Status :', status);
      
      // Try to fetch profile info
      try {
        const profilePic = await sock.profilePictureUrl(jid).catch(() => null);
        console.log('Profile URL:', profilePic || 'Not available');
        
        if (profilePic) {
          scanResults.profilesFound++;
        }
        
        // Store member info
        scanResults.members.push({
          jid,
          lid,
          number,
          status,
          profilePic,
          isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin'
        });
        
      } catch (err) {
        console.log('Profile URL: Not available (fetch error)');
        
        // Store member info without profile
        scanResults.members.push({
          jid,
          lid,
          number,
          status,
          profilePic: null,
          isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin'
        });
      }
      
      // IMPORTANT: small delay to avoid WhatsApp rate-limit
      if (i < participants.length - 1) {
        await sleep(2000);
      }
    }
    
    console.log('─'.repeat(30));
    console.log('🎉 Scan completed!');
    
    // Final summary
    console.log('Scan Summary');
    console.log(`Total: ${scanResults.total}`);
    console.log(`Addable: ${scanResults.addable}`);
    console.log(`Not Addable: ${scanResults.notAddable}`);
    console.log(`PN Users: ${scanResults.pnUsers}`);
    console.log(`LID Users: ${scanResults.lidUsers}`);
    console.log(`Profiles Found: ${scanResults.profilesFound}`);
    console.log('─'.repeat(30));
    
    return scanResults;
    
  } catch (error) {
    console.error('❌ Error scanning group members:', error);
    return {
      total: 0,
      addable: 0,
      notAddable: 0,
      lidUsers: 0,
      pnUsers: 0,
      profilesFound: 0,
      members: [],
      error: error.message
    };
  }
}

module.exports = {
  copyGroupMembers,
  getGroupMemberStats,
  scanGroupMembers
};

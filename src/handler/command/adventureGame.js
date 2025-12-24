const { gamePreview } = require('./game');
const { registerCommand } = require('./commandRegistry');
const { saveGameState, loadGameState, deleteGameState } = require('../../database/database');

// Constants
const RESULT_TYPES = {
    CONTINUE: 'continue',
    VICTORY: 'victory',
    DEFEAT: 'defeat',
    FLEE: 'flee',
    SPECIAL: 'special'
};

const EVENT_CHANCES = {
    TREASURE: 15,
    TRAP: 10,
    MERCHANT: 8,
    HEALING: 12
};

// Helpers
function cleanBotId(id) {
    if (!id) return id;
    return String(id).split(':')[0].split('@')[0];
}
function extractTextFromMsg(msg) {
    return msg?.message?.conversation
        || msg?.message?.extendedTextMessage?.text
        || msg?.message?.extendedTextMessage?.contextInfo?.text
        || msg?.message?.buttonsResponseMessage?.selectedButtonId
        || msg?.message?.buttonsResponseMessage?.selectedDisplayText
        || msg?.message?.listResponseMessage?.singleSelectReply?.title
        || '';
}

// State containers
const adventureGames = new Map(); // key: botId (clean)
const lastPromptIds = new Map();  // key: `${chatId}-${botId}` -> promptId

function setLastPromptId(chatId, botId, promptId) {
    if (!chatId || !botId) return;
    lastPromptIds.set(`${chatId}-${botId}`, promptId || null);
}
function getLastPromptId(chatId, botId) {
    return lastPromptIds.get(`${chatId}-${botId}`) || null;
}

// AdventureGame class
class AdventureGame {
    constructor(botId, savedState = null) {
        this.botId = cleanBotId(botId);
        this.player = {
            id: this.botId,
            health: 100,
            maxHealth: 100,
            inventory: [],
            currentLocation: 'start',
            level: 1,
            exp: 0,
            gold: 0,
            activeQuests: new Set(),
            completedQuests: new Set(),
            ...(savedState?.player || {})
        };

        // convert arrays to sets if loaded
        if (Array.isArray(this.player.activeQuests)) {
            this.player.activeQuests = new Set(this.player.activeQuests);
        }
        if (Array.isArray(this.player.completedQuests)) {
            this.player.completedQuests = new Set(this.player.completedQuests);
        }

        this.isActive = savedState?.isActive ?? true;
        this.lastAction = savedState?.lastAction ?? Date.now();
        this.currentEncounter = savedState?.currentEncounter ?? null; // transient combat state
    }

    getLocationInfo() {
        try {
            const story = require('../../data/adventureStory.json');
            return story.locations?.[this.player.currentLocation] || null;
        } catch (err) {
            console.error('Failed to load story JSON', err);
            return null;
        }
    }

    gainExp(amount) {
        this.player.exp = (this.player.exp || 0) + (amount || 0);
        try {
            const story = require('../../data/adventureStory.json');
            // find next level threshold
            const nextLevelDef = story.levels?.find(l => l.level === (this.player.level + 1));
            const threshold = nextLevelDef ? nextLevelDef.requiredExp : (this.player.level * 100);
            if (this.player.exp >= threshold) {
                this.player.exp -= threshold;
                this.player.level = (this.player.level || 1) + 1;
                this.player.maxHealth = 100 + (this.player.level - 1) * 10;
                this.player.health = this.player.maxHealth;
                return true;
            }
        } catch (err) {
            console.error('gainExp error', err);
        }
        return false;
    }

    addItem(item) {
        if (!item) return;
        this.player.inventory = this.player.inventory || [];
        this.player.inventory.push(item);
    }

    hasItem(itemName) {
        if (!itemName) return false;
        return (this.player.inventory || []).some(i => String(i).toLowerCase() === itemName.toLowerCase());
    }

    removeItem(itemName) {
        if (!itemName) return false;
        const i = (this.player.inventory || []).findIndex(x => String(x).toLowerCase() === itemName.toLowerCase());
        if (i >= 0) {
            this.player.inventory.splice(i, 1);
            return true;
        }
        return false;
    }

    heal(amount) {
        if (!amount) return;
        this.player.health = Math.min(this.player.maxHealth || 100, (this.player.health || 0) + amount);
    }

    damage(amount) {
        if (!amount) return false;
        this.player.health = Math.max(0, (this.player.health || 0) - amount);
        return this.player.health <= 0;
    }

    startQuest(q) {
        if (!q) return;
        this.player.activeQuests = this.player.activeQuests || new Set();
        this.player.activeQuests.add(q);
    }

    completeQuest(q) {
        this.player.completedQuests = this.player.completedQuests || new Set();
        this.player.activeQuests = this.player.activeQuests || new Set();
        if (this.player.activeQuests.has(q)) {
            this.player.activeQuests.delete(q);
            this.player.completedQuests.add(q);
            return true;
        }
        return false;
    }

    toJSON() {
        return {
            player: {
                ...this.player,
                // convert sets to arrays
                activeQuests: Array.from(this.player.activeQuests || []),
                completedQuests: Array.from(this.player.completedQuests || [])
            },
            isActive: this.isActive,
            lastAction: this.lastAction,
            currentEncounter: this.currentEncounter || null
        };
    }

    static fromJSON(botId, data) {
        return new AdventureGame(botId, data || {});
    }
}

// Core handlers

async function startOrResumeAdventure(sock, msg, args = []) {
    const chatId = msg?.key?.remoteJid;
    if (!chatId) return;
    const botRaw = sock?.user?.id;
    const botId = cleanBotId(botRaw);

    if ((args[0] || '').toLowerCase() === 'help') {
        return showAdventureHelp(sock, chatId, botId);
    }

    // load or restore global game
    let game = adventureGames.get(botId);
    if (!game) {
        // robust loading: loadGameState may be sync or async
        let saved = null;
        try {
            const maybePromise = loadGameState(botId);
            saved = (maybePromise && typeof maybePromise.then === 'function')
                ? await maybePromise
                : maybePromise;
        } catch (err) {
            saved = null;
        }

        game = AdventureGame.fromJSON(botId, saved);
        adventureGames.set(botId, game);
    }

    const location = game.getLocationInfo();
    const welcomeText = game.player.level > 1
        ? `🗺️ Adventure Continues!\nLevel: ${game.player.level} | Gold: ${game.player.gold}\n\n`
        : `🗺️ Your Adventure Begins!\n\n`;

    const locDesc = location ? `${location.description}\n\nAvailable actions:\n${(location.options || []).map(o => `• ${o}`).join('\n')}` : 'Your map is blank.';

    const sent = await sock.sendMessage(chatId, {
        text: welcomeText + locDesc + `\n\nReply to this message with one of the actions to proceed.`,
        contextInfo: gamePreview('⚔️ Adventure Game', `Level ${game.player.level}`)
    });

    setLastPromptId(chatId, botId, sent?.key?.id || sent?.key?.stanzaId || null);
    try { await saveGameState(botId, game.toJSON()); } catch {}
    return true;
}

async function handleAdventureAction(sock, msg, actionRaw) {
    const chatId = msg?.key?.remoteJid;
    if (!chatId) return;
    const botId = cleanBotId(sock.user.id);
    const game = adventureGames.get(botId);
    if (!game) return;

    // normalize action
    const actionKey = String(actionRaw || '').toLowerCase().trim().split(/\s+/)[0];
    const location = game.getLocationInfo();
    if (!location) {
        game.player.currentLocation = 'start';
    }

    const loc = game.getLocationInfo();
    const actionData = loc?.actions?.[actionKey];
    if (!actionData) {
        const sent = await sock.sendMessage(chatId, {
            text: `❌ Invalid action!\n\nAvailable actions:\n${(loc?.options || []).map(opt => `• ${opt}`).join('\n')}`,
            contextInfo: gamePreview('⚔️ Adventure Game', `Level ${game.player.level}`)
        });
        setLastPromptId(chatId, botId, sent?.key?.id || null);
        return;
    }

    // apply action effects
    let responseText = (actionData.text || 'You do that...') + '\n\n';

    if (actionData.item) {
        game.addItem(actionData.item);
        responseText += `🎒 You obtained: ${actionData.item}\n`;
    }
    if (actionData.gold) {
        game.player.gold = (game.player.gold || 0) + (actionData.gold || 0);
        responseText += `💰 ${actionData.gold} gold added.\n`;
    }
    if (actionData.exp) {
        const leveled = game.gainExp(actionData.exp);
        responseText += `⭐ +${actionData.exp} EXP\n`;
        if (leveled) responseText += `🎉 Level Up! Now Lvl ${game.player.level}\n`;
    }
    if (typeof actionData.heal !== 'undefined') {
        if (actionData.heal < 0) {
            game.damage(Math.abs(actionData.heal));
            responseText += `💥 You took ${Math.abs(actionData.heal)} damage.\n`;
        } else {
            game.heal(actionData.heal);
            responseText += `❤️ You recovered ${actionData.heal} HP.\n`;
        }
    }
    if (actionData.quest) {
        game.startQuest(actionData.quest);
        responseText += `📜 Quest started: ${actionData.quest}\n`;
    }
    if (actionData.nextLocation) {
        game.player.currentLocation = actionData.nextLocation;
        const newLoc = game.getLocationInfo();
        if (newLoc) {
            responseText += `\n📍 New location: ${newLoc.title}\n${newLoc.description}\n\nAvailable actions:\n${(newLoc.options || []).map(o => `• ${o}`).join('\n')}`;
        } else {
            // fallback
            game.player.currentLocation = 'start';
            const fallback = game.getLocationInfo();
            responseText += `\n⚠️ Unknown location; returned to start.\n${fallback.description}`;
        }
    }

    // Encounter handling
    if (actionData.encounter) {
        const started = await handleEncounter(sock, chatId, game, actionData.encounter);
        if (started) return; // combat prompt sent and saved
    }

    // send response
    const sent = await sock.sendMessage(chatId, {
        text: responseText,
        contextInfo: gamePreview('⚔️ Adventure Game', `Level ${game.player.level} | HP ${game.player.health}`)
    });
    setLastPromptId(chatId, botId, sent?.key?.id || null);

    // chance for random event if not an encounter
    if (!actionData.encounter && Math.random() < 0.15) {
        await handleRandomEvent(sock, chatId, game);
    }

    await saveGameState(botId, game.toJSON()).catch(()=>{});
    return true;
}

async function handleEncounter(sock, chatId, game, encounterKey) {
    const story = require('../../data/adventureStory.json');
    const monsterDef = story.monsters?.[encounterKey];
    if (!monsterDef) return null;

    // clone monster for this encounter
    const monster = { ...monsterDef };

    const encounterText = `⚔️ Combat Encounter!\n\nYou face: ${monster.name}\nHP: ${monster.hp} | ATK: ${monster.atk}\n\nYour HP: ${game.player.health}\n\nOptions:\n• fight\n• flee`;
    const sent = await sock.sendMessage(chatId, {
        text: encounterText,
        contextInfo: gamePreview('⚔️ Combat', `VS ${monster.name}`)
    });

    // store encounter on game and persist
    game.currentEncounter = { type: encounterKey, monster, state: 'started' };
    setLastPromptId(chatId, game.botId, sent?.key?.id || null);
    await saveGameState(game.botId, game.toJSON()).catch(()=>{});
    return true;
}

async function handleCombatAction(sock, msg, game, action) {
    const chatId = msg?.key?.remoteJid;
    if (!chatId || !game?.currentEncounter) return false;

    const monster = game.currentEncounter.monster;
    let result = null;
    let combatLog = '';

    if (action === 'fight') {
        const playerDmg = Math.floor(5 + (game.player.level || 1) * 2 + Math.random() * 8);
        monster.hp -= playerDmg;
        combatLog += `You hit ${monster.name} for ${playerDmg} damage.\n`;

        if (monster.hp > 0) {
            const monsterDmg = Math.floor(monster.atk * (0.8 + Math.random() * 0.4));
            const died = game.damage(monsterDmg);
            combatLog += `${monster.name} hits you for ${monsterDmg} damage.\n`;
            if (died) result = RESULT_TYPES.DEFEAT;
        } else {
            result = RESULT_TYPES.VICTORY;
        }

        if (result === RESULT_TYPES.VICTORY) {
            combatLog += `\n🎉 You defeated ${monster.name}!\n`;
            game.gainExp(monster.exp || 0);
            game.player.gold = (game.player.gold || 0) + (monster.gold || 0);
            combatLog += `+${monster.exp || 0} EXP  +${monster.gold || 0} gold\n`;

            if (Math.random() < 0.3) {
                const loot = getRandomLoot(monster);
                if (loot) {
                    game.addItem(loot);
                    combatLog += `🎁 Loot: ${loot}\n`;
                }
            }
        }
    } else if (action === 'flee') {
        if (Math.random() < 0.7) {
            const fleeDmg = Math.floor((game.currentEncounter.monster.atk || 5) * 0.5);
            game.damage(fleeDmg);
            combatLog = `💨 You fled but took ${fleeDmg} damage while escaping.\n`;
            result = RESULT_TYPES.FLEE;
        } else {
            const monsterDmg = Math.floor((game.currentEncounter.monster.atk || 5) * 1.2);
            game.damage(monsterDmg);
            combatLog = `❌ Failed to flee. ${monster.name} hits you for ${monsterDmg} damage.\n`;
        }
    } else {
        // invalid combat action
        const sent = await sock.sendMessage(chatId, {
            text: "⚔️ In combat, reply with: fight or flee",
            contextInfo: gamePreview('⚔️ Combat', `VS ${monster.name}`)
        });
        setLastPromptId(chatId, game.botId, sent?.key?.id || null);
        return true;
    }

    // resolve outcome
    if (result === RESULT_TYPES.VICTORY || result === RESULT_TYPES.FLEE || game.player.health <= 0) {
        // clear encounter
        game.currentEncounter = null;

        if (game.player.health <= 0) {
            // defeat handling
            combatLog += `\n☠️ You were defeated. You wake at the start with half health.\n`;
            game.player.gold = Math.floor((game.player.gold || 0) * 0.8);
            game.player.health = Math.max(20, Math.floor((game.player.maxHealth || 100) / 2));
            game.player.currentLocation = 'start';
        }

        // send combat result then show location options
        const sentResult = await sock.sendMessage(chatId, {
            text: combatLog,
            contextInfo: gamePreview('⚔️ Combat Result', `HP ${game.player.health}`)
        });
        setLastPromptId(chatId, game.botId, sentResult?.key?.id || null);

        // show current location options
        const loc = game.getLocationInfo();
        const sentLoc = await sock.sendMessage(chatId, {
            text: `📍 Current Location: ${loc?.title || 'Unknown'}\n\n${loc?.description || ''}\n\nAvailable actions:\n${(loc?.options || []).map(o => `• ${o}`).join('\n')}`,
            contextInfo: gamePreview('🗺️ Adventure', `Level ${game.player.level}`)
        });
        setLastPromptId(chatId, game.botId, sentLoc?.key?.id || null);
    } else {
        // combat continues: send combat log and wait for next reply
        const sent = await sock.sendMessage(chatId, {
            text: combatLog + `\nMonster HP: ${monster.hp}\nYour HP: ${game.player.health}\n\nReply: fight / flee`,
            contextInfo: gamePreview('⚔️ Combat', `VS ${monster.name}`)
        });
        setLastPromptId(chatId, game.botId, sent?.key?.id || null);
    }

    await saveGameState(game.botId, game.toJSON()).catch(()=>{});
    return true;
}

function getRandomLoot(monster) {
    const common = ['Health Potion', 'Bandages', 'Monster Fang', 'Old Coin'];
    const rare = ['Magic Ring', 'Enchanted Amulet', 'Rare Gem'];
    const epic = ['Dragonfang Blade', 'Shadow Cloak'];
    const roll = Math.random();
    if (roll < 0.05 && (monster?.hp || 0) > 200) return epic[Math.floor(Math.random()*epic.length)];
    if (roll < 0.15) return rare[Math.floor(Math.random()*rare.length)];
    return common[Math.floor(Math.random()*common.length)];
}

async function handleRandomEvent(sock, chatId, game) {
    const roll = Math.random() * 100;
    let text = '';
    let event = null;

    if (roll < EVENT_CHANCES.TREASURE) {
        const gold = Math.floor(10 + (game.player.level || 1) * 5 + Math.random() * 20);
        game.player.gold = (game.player.gold || 0) + gold;
        const loot = getRandomLoot({ hp: 100 });
        game.addItem(loot);
        text = `💎 Lucky Find! You discover ${gold} gold and a ${loot}.`;
        event = RESULT_TYPES.SPECIAL;
    } else if (roll < EVENT_CHANCES.TREASURE + EVENT_CHANCES.TRAP) {
        const dmg = Math.floor(5 + (game.player.level || 1) * 2);
        game.damage(dmg);
        text = `⚠️ Trap! You take ${dmg} damage. HP: ${game.player.health}`;
        event = RESULT_TYPES.SPECIAL;
    } else if (roll < EVENT_CHANCES.TREASURE + EVENT_CHANCES.TRAP + EVENT_CHANCES.MERCHANT) {
        text = `🏪 Wandering Merchant\nItems for sale:\n• Health Potion - 50\n• Strong Sword - 100\n• Magic Shield - 150\n\nReply "buy <item>" to purchase. Your gold: ${game.player.gold}`;
        event = RESULT_TYPES.SPECIAL;
    } else if (roll < EVENT_CHANCES.TREASURE + EVENT_CHANCES.TRAP + EVENT_CHANCES.MERCHANT + EVENT_CHANCES.HEALING) {
        const heal = Math.floor((game.player.maxHealth || 100) * 0.3);
        game.heal(heal);
        text = `💖 Healing Spring: You heal ${heal} HP. Current HP: ${game.player.health}`;
        event = RESULT_TYPES.SPECIAL;
    }

    if (event) {
        const sent = await sock.sendMessage(chatId, {
            text,
            contextInfo: gamePreview('🎲 Random Event', `Level ${game.player.level}`)
        });
        setLastPromptId(chatId, game.botId, sent?.key?.id || null);
        await saveGameState(game.botId, game.toJSON()).catch(()=>{});
        return true;
    }
    return false;
}

// Inventory / item / merchant helpers
async function showInventory(sock, chatId, game) {
    const inv = (game.player.inventory || []).length ? (game.player.inventory || []).map(i => `• ${i}`).join('\n') : '(Empty)';
    const quests = Array.from(game.player.activeQuests || []);
    const qText = quests.length ? quests.map(q => `• ${q}`).join('\n') : '(None)';

    const txt = `🎒 Inventory\n\nLevel: ${game.player.level}\nHP: ${game.player.health}/${game.player.maxHealth}\nGold: ${game.player.gold}\nEXP: ${game.player.exp}\n\nItems:\n${inv}\n\nActive Quests:\n${qText}`;
    const sent = await sock.sendMessage(chatId, { text: txt, contextInfo: gamePreview('🎒 Inventory', `Level ${game.player.level}`) });
    setLastPromptId(chatId, game.botId, sent?.key?.id || null);
    return true;
}

async function handleItemUse(sock, chatId, game, itemName) {
    if (!game.hasItem(itemName)) {
        const sent = await sock.sendMessage(chatId, { text: "❌ You don't have that item.", contextInfo: gamePreview('🎒 Item', '') });
        setLastPromptId(chatId, game.botId, sent?.key?.id || null);
        return true;
    }

    const item = itemName.toLowerCase();
    if (item === 'health potion') {
        game.heal(50);
        game.removeItem(itemName);
        const sent = await sock.sendMessage(chatId, { text: `❤️ Used Health Potion. HP: ${game.player.health}/${game.player.maxHealth}`, contextInfo: gamePreview('🎒 Item', '') });
        setLastPromptId(chatId, game.botId, sent?.key?.id || null);
        await saveGameState(game.botId, game.toJSON()).catch(()=>{});
        return true;
    }

    const sent = await sock.sendMessage(chatId, { text: 'This item cannot be used now.', contextInfo: gamePreview('🎒 Item', '') });
    setLastPromptId(chatId, game.botId, sent?.key?.id || null);
    return true;
}

async function handleMerchantAction(sock, chatId, game, actionText) {
    const act = (actionText || '').toLowerCase();
    if (!act.startsWith('buy ')) return false;
    const itemName = actionText.substring(4).trim();
    const shop = [
        { name: 'Health Potion', cost: 50 },
        { name: 'Strong Sword', cost: 100 },
        { name: 'Magic Shield', cost: 150 }
    ];
    const item = shop.find(s => s.name.toLowerCase() === itemName.toLowerCase());
    if (!item) {
        const sent = await sock.sendMessage(chatId, { text: 'Item not available.', contextInfo: gamePreview('🏪 Shop','') });
        setLastPromptId(chatId, game.botId, sent?.key?.id || null);
        return true;
    }
    if ((game.player.gold || 0) < item.cost) {
        const sent = await sock.sendMessage(chatId, { text: 'Not enough gold.', contextInfo: gamePreview('🏪 Shop','') });
        setLastPromptId(chatId, game.botId, sent?.key?.id || null);
        return true;
    }
    game.player.gold -= item.cost;
    game.addItem(item.name);
    const sent = await sock.sendMessage(chatId, { text: `✅ Bought ${item.name}. Gold: ${game.player.gold}`, contextInfo: gamePreview('🏪 Shop','') });
    setLastPromptId(chatId, game.botId, sent?.key?.id || null);
    await saveGameState(game.botId, game.toJSON()).catch(()=>{});
    return true;
}
// /**
//  * Handle replies for adventure game.
//  * - In groups: only accept replies that quote the bot prompt (quoted message id must match game's lastPromptId).
//  * - In DMs: accept plain text actions (no quoting required).
//  */
// async function handleAdventureReply(sock, msg) {
//     if (!msg?.key?.remoteJid) return false;
//     const chatId = msg.key.remoteJid;
//     const botId = sock.user.id;
//     const isGroup = chatId.endsWith('@g.us');
    
//     // Get text from message
//     const text = msg.message?.conversation || 
//                  msg.message?.extendedTextMessage?.text || '';
//     if (!text.trim()) return false;

//     // Check for valid game
//     const game = adventureGames.get(botId);
//     if (!game) return false;

//     // In groups, validate reply matches last prompt
//     if (isGroup) {
//         const lastPromptId = getLastPromptId(chatId, botId);
//         const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
//         if (!lastPromptId || !quotedId || quotedId !== lastPromptId) {
//             return false;
//         }
//     }

//     // Process action
//     try {
//         await handleAdventureAction(sock, msg, text.trim());
//         return true;
//     } catch (err) {
//         console.error('Adventure reply error:', err);
//         return false;
//     }
// }
// Reply handler
// Extract text from any message structure
function extractText(msg) {
    return msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || msg.message?.extendedTextMessage?.contextInfo?.text
        || '';
}

/**
 * Handle replies for the adventure game.
 * - In groups: only accept replies that quote the bot prompt (lastPromptId).
 * - In DMs: accept plain text actions without strict validation.
 * - Owner/bot messages are always accepted.
 */
async function handleAdventureReply(sock, msg) {
    if (!msg?.key?.remoteJid) return false;
    const chatId = msg.key.remoteJid;
    const botId = cleanBotId(sock.user.id);

    // Get game instance
    const game = adventureGames.get(botId);
    if (!game || !game.isActive) {
        log('No active game for:', botId);
        return false;
    }

    // Check if this is a reply message
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (!contextInfo) {
        log('Not a reply message');
        return false;
    }

    // Get the ID of the message being replied to
    const repliedMsgId = contextInfo.stanzaId || contextInfo.quotedMessageId;
    const expectedPromptId = getLastPromptId(chatId, botId);

    // Check if this is a reply to our last game prompt
    if (!repliedMsgId || repliedMsgId !== expectedPromptId) {
        log('Not replying to current game prompt', {
            replied: repliedMsgId,
            expected: expectedPromptId
        });
        await sendGameMessage(sock, chatId,
            "❌ Please reply to the most recent game message to continue.",
            {
                previewTitle: 'Adventure Game',
                previewSubtitle: 'Action Required'
            }
        );
        return false;
    }

    // Extract text from reply
    const text = msg.message?.extendedTextMessage?.text || '';
    if (!text.trim()) {
        log('Empty reply text');
        return false;
    }

    const action = text.trim().toLowerCase();
    log(`Processing "${action}" from player in ${chatId}`);

    // Rest of your existing action handling code...
    if (action === 'inventory' || action === 'inv') {
        return showInventory(sock, chatId, game);
    }

    if (action.startsWith('use ')) {
        const itemName = text.substring(4).trim();
        return handleItemUse(sock, chatId, game, itemName);
    }

    if (action.startsWith('buy ')) {
        return handleMerchantAction(sock, chatId, game, text);
    }

    // Handle combat
    if (game.currentEncounter?.state === 'started') {
        if (action === 'fight' || action === 'flee') {
            return handleCombatAction(sock, msg, game, action);
        }
        
        await sendGameMessage(sock, chatId, 
            "⚔️ In combat! Choose:\n• fight\n• flee",
            {
                previewTitle: 'Combat',
                previewSubtitle: `VS ${game.currentEncounter.monster.name}`,
                trackPrompt: true
            }
        );
        return true;
    }

    // Process normal action
    try {
        const location = game.getLocationInfo();
        const validActions = location?.options?.map(opt => opt.toLowerCase()) || [];
        
        if (!validActions.includes(action)) {
            await sendGameMessage(sock, chatId,
                `❌ Invalid action!\n\nAvailable actions:\n${validActions.map(a => `• ${a}`).join('\n')}`,
                {
                    previewTitle: 'Adventure',
                    previewSubtitle: `Level ${game.player.level}`,
                    trackPrompt: true
                }
            );
            return true;
        }

        await handleAdventureAction(sock, msg, action);
        return true;
    } catch (err) {
        console.error('[Adventure] Error:', err);
        return false;
    }
}



// Help
async function showAdventureHelp(sock, chatId, playerId) {
    const helpText = `🗺️ Adventure Help\n\n` +
        `Commands:\n` +
        `• rpg start - Start/resume\n` +
        `• rpg help - This help\n\n` +
        `In-game:\n` +
        `• Reply to the bot prompt with one of the listed actions\n` +
        `• In combat reply "fight" or "flee"\n` +
        `• Use: "use <item>", see inventory with "inventory"\n`;
    const sent = await sock.sendMessage(chatId, { text: helpText, contextInfo: gamePreview('⚔️ Help','') });
    setLastPromptId(chatId, playerId, sent?.key?.id || null);
    return true;
}

// Cleanup
async function cleanupGameState(playerId) {
    const clean = cleanBotId(playerId);
    adventureGames.delete(clean);
    await deleteGameState(clean).catch(()=>{});
}

// Command registration
registerCommand('rpg', {
    description: 'Adventure RPG game',
    usage: 'rpg [start|help]',
    category: 'Games',
    aliases: ['adventure','quest'],
    examples: ['rpg start','rpg help','rpg inventory'],
    handler: async (sock, msg, args = []) => {
        const cmd = (args[0] || '').toLowerCase();
        switch (cmd) {
            case 'help': return showAdventureHelp(sock, msg.key.remoteJid, cleanBotId(sock.user.id));
            case 'inventory': {
                const botId = cleanBotId(sock.user.id);
                let game = adventureGames.get(botId);
                if (!game) {
                    const saved = await loadGameState(botId).catch(()=>null);
                    game = AdventureGame.fromJSON(botId, saved);
                    adventureGames.set(botId, game);
                }
                return showInventory(sock, msg.key.remoteJid, game);
            }
            default:
                return startOrResumeAdventure(sock, msg, args);
        }
    }
});


async function handleAdventure(sock, msg, args = []) {
    // wrapper so other modules can call handleAdventure(...)
    return startOrResumeAdventure(sock, msg, args);
}


// Exports
module.exports = {
    // handler used by commandHandler
    handleAdventure,

    // internal API
    startOrResumeAdventure,
    handleAdventureReply,
    handleAdventureAction,
    showAdventureHelp,

    // game class and state
    AdventureGame,
    adventureGames,
    lastPromptIds,

    // helpers
    cleanBotId,
    extractTextFromMsg,
    getLastPromptId,
    setLastPromptId,

    // combat / events
    handleEncounter,
    handleCombatAction,
    handleRandomEvent,
    getRandomLoot,

    // inventory/merchant
    showInventory,
    handleItemUse,
    handleMerchantAction,

    // persistence helpers (re-exported)
    saveGameState,
    loadGameState,
    deleteGameState,

    // constants
    RESULT_TYPES,
    EVENT_CHANCES,

    // cleanup
    cleanupGameState
};

const { db } = require('../../database/database');
const { postNews } = require('../command/news');

db.prepare(`
  CREATE TABLE IF NOT EXISTS news_auto_schedules (
    chat_jid TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    cadence TEXT NOT NULL CHECK (cadence IN ('morning', '12h')),
    next_run_at INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`).run();

const getSchedule = db.prepare('SELECT * FROM news_auto_schedules WHERE chat_jid = ?');
const getDueSchedules = db.prepare('SELECT * FROM news_auto_schedules WHERE next_run_at <= ?');
const removeSchedule = db.prepare('DELETE FROM news_auto_schedules WHERE chat_jid = ?');
const updateNextRun = db.prepare(`
  UPDATE news_auto_schedules
  SET next_run_at = ?, updated_at = ?
  WHERE chat_jid = ? AND next_run_at = ?
`);
const saveSchedule = db.prepare(`
  INSERT INTO news_auto_schedules (chat_jid, topic, cadence, next_run_at, created_by, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(chat_jid) DO UPDATE SET
    topic = excluded.topic,
    cadence = excluded.cadence,
    next_run_at = excluded.next_run_at,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at
`);

function getNextRunAt(cadence, from = new Date()) {
  const next = new Date(from);
  if (cadence === '12h') {
    return next.getTime() + 12 * 60 * 60 * 1000;
  }

  next.setHours(8, 0, 0, 0);
  if (next <= from) next.setDate(next.getDate() + 1);
  return next.getTime();
}

function scheduleDescription(schedule) {
  const cadence = schedule.cadence === 'morning' ? 'every morning at 8:00 AM' : 'every 12 hours';
  return `📰 Auto-news for *${schedule.topic}* is set to post ${cadence}. Next post: ${new Date(schedule.next_run_at).toLocaleString()}.`;
}

async function handleAutoNewsCommand(sock, msg, args, prefix, { isAdmin, isOwner }) {
  const chatJid = msg.key.remoteJid;
  const isGroup = chatJid.endsWith('@g.us');
  const isNewsletter = chatJid.endsWith('@newsletter');
  const autoIndex = args.findIndex(arg => arg.toLowerCase() === 'auto');
  const topic = args.slice(0, autoIndex).join(' ').trim();
  const options = args.slice(autoIndex + 1).map(option => option.toLowerCase());
  const action = options[0];

  if (!isGroup && !isNewsletter) {
    await sock.sendMessage(chatJid, {
      text: `❌ Set up auto-news in the group or channel where you want posts sent.\nUsage: ${prefix}news <topic> auto morning|12h`
    }, { quoted: msg });
    return;
  }

  if (isGroup && !isAdmin && !isOwner) {
    await sock.sendMessage(chatJid, {
      text: '❌ Only group admins can manage auto-news.'
    }, { quoted: msg });
    return;
  }

  if (action === 'off') {
    const result = removeSchedule.run(chatJid);
    await sock.sendMessage(chatJid, {
      text: result.changes
        ? '✅ Auto-news has been stopped for this chat.'
        : 'ℹ️ Auto-news is not set up for this chat.'
    }, { quoted: msg });
    return;
  }

  if (action === 'status') {
    const schedule = getSchedule.get(chatJid);
    await sock.sendMessage(chatJid, {
      text: schedule ? scheduleDescription(schedule) : 'ℹ️ Auto-news is not set up for this chat.'
    }, { quoted: msg });
    return;
  }

  if (!topic || (action && action !== 'morning' && action !== '12h') || options.length > 1) {
    await sock.sendMessage(chatJid, {
      text: `Usage:\n${prefix}news <topic> auto morning\n${prefix}news <topic> auto 12h\n${prefix}news auto status\n${prefix}news auto off\nIf omitted, the schedule defaults to morning at 8:00 AM server local time.`
    }, { quoted: msg });
    return;
  }

  const cadence = action || 'morning';
  const now = Date.now();
  const createdBy = msg.key.participant || chatJid;
  const schedule = {
    topic,
    cadence,
    next_run_at: getNextRunAt(cadence, new Date(now))
  };
  saveSchedule.run(chatJid, topic, cadence, schedule.next_run_at, createdBy, now);

  await sock.sendMessage(chatJid, {
    text: `✅ ${scheduleDescription(schedule)}\nUse ${prefix}news auto off to stop it.`
  }, { quoted: msg });
}

async function runDueSchedules(sock) {
  const now = Date.now();
  for (const schedule of getDueSchedules.all(now)) {
    const nextRunAt = getNextRunAt(schedule.cadence, new Date(now));
    const updated = updateNextRun.run(nextRunAt, now, schedule.chat_jid, schedule.next_run_at);
    if (!updated.changes) continue;

    try {
      await postNews(sock, schedule.chat_jid, { topic: schedule.topic });
    } catch (error) {
      console.error(`[autoNews] Scheduled post failed for ${schedule.chat_jid}:`, error);
    }
  }
}

let schedulerTimer = null;
let schedulerSocket = null;
let schedulerRunning = false;

function startAutoNewsScheduler(sock) {
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerSocket = sock;
  schedulerTimer = setInterval(() => {
    if (schedulerRunning || schedulerSocket !== sock) return;
    schedulerRunning = true;
    runDueSchedules(sock)
      .catch(error => console.error('[autoNews] Scheduler failed:', error))
      .finally(() => {
        schedulerRunning = false;
      });
  }, 60_000);
  schedulerTimer.unref?.();

  if (!schedulerRunning) {
    schedulerRunning = true;
    runDueSchedules(sock)
      .catch(error => console.error('[autoNews] Scheduler failed:', error))
      .finally(() => {
        schedulerRunning = false;
      });
  }
}

function stopAutoNewsScheduler(sock) {
  if (schedulerSocket !== sock) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
  schedulerSocket = null;
}

module.exports = {
  handleAutoNewsCommand,
  runDueSchedules,
  startAutoNewsScheduler,
  stopAutoNewsScheduler,
  getNextRunAt
};

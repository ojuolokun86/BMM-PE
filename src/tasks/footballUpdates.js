// e:\Bot development\BOT V2\BMM DEV V2\src\tasks\footballUpdates.js

const { checkUpcomingMatches, checkYesterdaysResults } = require('../handler/features/footballUpdates');
//const { setIntervalAsync } = require('set-interval-async/fixed');

// Check for updates every hour
const UPDATE_INTERVAL = 60 * 60 * 1000; // 1 hour

// Time to check for yesterday's results (runs once per day at 8 AM)
const RESULTS_CHECK_HOUR = 8;

function startFootballUpdates() {
  console.log('🚀 Starting football updates scheduler...');
  
  // Initial check
  checkUpcomingMatches().catch(console.error);
  checkYesterdaysResults().catch(console.error);
  
  // Schedule periodic checks
  setInterval(checkUpcomingMatches, UPDATE_INTERVAL);
  
  // Schedule daily results check
  scheduleDailyCheck();
}

function scheduleDailyCheck() {
  const now = new Date();
  let timeUntilNextCheck = new Date(now);
  
  // Set target time to 8 AM
  timeUntilNextCheck.setHours(RESULTS_CHECK_HOUR, 0, 0, 0);
  
  // If it's already past 8 AM today, schedule for tomorrow
  if (now > timeUntilNextCheck) {
    timeUntilNextCheck.setDate(timeUntilNextCheck.getDate() + 1);
  }
  
  const delay = timeUntilNextCheck - now;
  
  setTimeout(() => {
    checkYesterdaysResults().catch(console.error);
    // Schedule next check for the next day
    scheduleDailyCheck();
  }, delay);
  
  console.log(`⏰ Next results check scheduled for: ${timeUntilNextCheck}`);
}

module.exports = {
  startFootballUpdates
};
function buildFallbackCongratulationTemplate({ userJid, league, team, previousTrophies, newTotal, override = false }) {
  const userName = `@${userJid.split('@')[0]}`

  const templates = [
    `🎉 Congratulations ${userName}!\n\nAfter having ${previousTrophies} trophies to your name, you've done it again!\n\n🏟️ ${league}\n⚽ ${team}\n\n🏆 Your new total is ${newTotal} trophies!\n\nYour skill, consistency and determination are incredible. Another trophy added to an already impressive legacy! 👑🔥`,
    `🎉 ${userName}, this is huge!\n\nYou had ${previousTrophies} trophies before this incredible achievement, and now you've reached ${newTotal}!\n\n🏟️ ${league}\n⚽ ${team}\n\n🏆 Another trophy, another statement of greatness. Your form and focus are simply outstanding! 🔥💙`,
    `🎉 Congratulations ${userName}!\n\n${override ? 'You had ' + previousTrophies + ' trophies before this win, and now you have ' + newTotal + '!' : 'After having ' + previousTrophies + ' trophies to your name, you\'ve added another brilliant victory!'}\n\n🏟️ ${league}\n⚽ ${team}\n\n🏆 Your new total is ${newTotal} trophies!\n\nWhat an incredible achievement. You are truly making this legacy shine! 👑✨`,
    `👏 Huge congratulations ${userName}!\n\nYou had ${previousTrophies} trophies before this stunning result, and now you've moved to ${newTotal}!\n\n🏟️ ${league}\n⚽ ${team}\n\n🏆 Another trophy added to the story. Your consistency, talent and mentality are elite. Keep winning! 🚀🔥`,
    `🎉 Congratulations ${userName}!\n\nThis is another remarkable moment in your journey. With ${previousTrophies} trophies already in your name, you now stand at ${newTotal}!\n\n🏟️ ${league}\n⚽ ${team}\n\n🏆 A brilliant achievement and a huge moment of celebration. Keep building the legacy! 👑💪`
  ]

  return templates[Math.floor(Math.random() * templates.length)]
}

module.exports = {
  buildFallbackCongratulationTemplate
}

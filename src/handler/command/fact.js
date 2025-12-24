// src/handler/command/fact.js

// Primary: Useless Facts (real-world facts, no API key)
// Fallback: Numbers API (plain text, no key)
async function fetchFact() {
    // Try Useless Facts first
    try {
      const res = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { redirect: 'follow' });
      if (res.ok) {
        const data = await res.json();
        if (data?.text) return data.text.trim();
      }
    } catch (_) {}
  
    // Fallback to Numbers API
    try {
      const res = await fetch('http://numbersapi.com/random/trivia');
      if (res.ok) {
        const text = await res.text();
        if (text) return text.trim();
      }
    } catch (_) {}
  
    throw new Error('No fact available at the moment');
  }
  
  module.exports = async function factCommand(sock, from, msg/*, { prefix, args } */) {
    try {
      //await sendToChat(sock, from, { message: '📚 Fetching a real fact...' }, { quoted: msg });
      const fact = await fetchFact();
      await sock.sendMessage(from, { text: `🧠 Fact:\n\n${fact}` }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(from, { text: `❌ Error fetching fact: ${e.message}` }, { quoted: msg });
    }
  };
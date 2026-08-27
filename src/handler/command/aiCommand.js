const { callAI, AI_PROVIDERS } = require('../../utils/aiProviderManager');

const AI_PROVIDERS_LEGACY = {
    'gpt': {
        name: "🤖 GPT-4O-Mini",
        url: (query) => `https://api.giftedtech.co.ke/api/ai/gpt4o-mini?apikey=gifted&q=${encodeURIComponent(query)}`,
        method: 'GET',
        responseParser: (data) => {
            if (data && data.result) return data.result;
            if (data && data.message) return data.message;
            if (data && data.response) return data.response;
            if (data && data.answer) return data.answer;
            return "No response from GPT-4O-Mini";
        },
        errorMessage: "GPT-4O-Mini is currently unavailable."
    },
    'bmm': {
        name: "🤖 BMM AI",
        url: 'https://ai-gateway.ojuolokun86.workers.dev',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        requestBody: (query) => ({
            messages: [
                {
                    role: "user",
                    content: query
                }
            ]
        }),
        responseParser: (data) => {
            if (data && data.reply) return data.reply;
            if (data && data.response) return data.response;
            if (data && data.result) return data.result;
            if (data && data.message) return data.message;
            if (data && data.answer) return data.answer;
            if (data && data.content) return data.content;
            return "No response from BMM AI";
        },
        errorMessage: "BMM AI is currently unavailable."
    }
};

function formatAIResponse(provider, response) {
    const header = `╭───  *${provider.name}*  ───╮\n\n`;
    const footer = `\n\n╰───  *BMM AI System*  ───╯`;
    const formattedResponse = response
        .split('\n')
        .map(line => `│ ${line}`)
        .join('\n');
    
    return header + formattedResponse + footer;
}

async function getAIResponse(provider, query) {
    const sessionId = `ai-command:${provider && provider.name ? provider.name : 'default'}`;
    const result = await callAI(sessionId, [{ role: 'user', content: query }]);
    if (!result.success) {
        throw new Error(result.error || 'AI request failed');
    }
    return result.text;
}

async function aiCommand(sock, chatId, msg, { prefix, args, command: cmd }) {
    const query = args.join(' ').trim();
    
    if (!query) {
        const helpMessage = `
╭───  *AI COMMAND CENTER*  ───╮

│ *Available Commands:*
│
│ • *${prefix}ai <message>*
│   └─ Use any available AI model
│
│ • *${prefix}gpt <message>*
│   └─ Chat with GPT-4O-Mini
│
│ • *${prefix}bmm <message>*
│   └─ Chat with BMM AI
│
│ Example: *${prefix}ai* How does quantum computing work?

╰───  *BMM AI System*  ───╯
        `;
        
        return sock.sendMessage(chatId, { text: helpMessage });
    }

    try {
        await sock.sendMessage(chatId, {
            text: "⏳ *Processing your request...*"
        });

        const sessionKey = `ai-command:${chatId}`;
        const result = await callAI(sessionKey, [{ role: 'user', content: query }], {
            preferredOrder: cmd === 'bmm' ? ['groq', 'cloudflare'] : cmd === 'gpt' ? ['cloudflare', 'groq'] : ['groq', 'cloudflare']
        });

        if (result.success) {
            const providerName = AI_PROVIDERS[result.provider]?.name || result.provider;
            const formattedResponse = formatAIResponse({ name: providerName }, result.text);
            return sock.sendMessage(chatId, {
                text: formattedResponse
            });
        }

        throw new Error('All AI providers are currently unavailable.');

    } catch (error) {
        console.error('AI command error:', error);
        const errorMessage = `
╭───  *AI SYSTEM ERROR*  ───╮

│ ❌ Unable to get a response from any AI service.
│
│ Possible reasons:
│ • High traffic on AI servers
│ • Temporary service issues
│ • Network connectivity problems
│
│ Please try again in a few minutes.
│ If this persists, contact the bot administrator.

╰───  *BMM AI System*  ───╯
        `;
return sock.sendMessage(chatId, { text: errorMessage });
    }
}

module.exports = aiCommand;
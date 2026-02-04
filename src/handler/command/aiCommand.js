const axios = require('axios');
// Using sock.sendMessage directly instead of sendToChat

const AI_PROVIDERS = {
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
    try {
        const config = {
            timeout: 30000,
            validateStatus: function (status) {
                return status >= 200 && status < 500;
            }
        };

        const url = typeof provider.url === 'function' ? provider.url(query) : provider.url;
       // console.log(`[AI] Making ${provider.method} request to:`, url);
        
        let response;
        if (provider.method === 'POST') {
            const requestData = provider.requestBody ? provider.requestBody(query) : { query };
            if (provider.headers) {
                config.headers = provider.headers;
            }
            //console.log('[AI] Request data:', requestData);
            response = await axios.post(url, requestData, config);
        } else {
            response = await axios.get(url, config);
        }
        

       // console.log(`[AI] Response status: ${response.status}`);
       // console.log('[AI] Response data:', JSON.stringify(response.data, null, 2));

        if (response.status !== 200) {
            throw new Error(`API returned status ${response.status}`);
        }

        const result = provider.responseParser(response.data);
        if (!result) {
            throw new Error('Empty or invalid response from AI provider');
        }
        return result;
    } catch (error) {
        console.error(`Error with ${provider.name}:`, error.message);
        if (error.response) {
            console.error('Response error data:', error.response.data);
        }
        throw error;
    }
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

        // Select provider based on command
        let providersToTry;
        if (cmd === 'bmm') {
            providersToTry = [AI_PROVIDERS.bmm];
        } else if (cmd === 'gpt') {
            providersToTry = [AI_PROVIDERS.gpt];
        } else {
            // Default: try GPT first, then BMM as fallback
            providersToTry = [AI_PROVIDERS.gpt, AI_PROVIDERS.bmm];
        }

        for (const [index, currentProvider] of providersToTry.entries()) {
            try {
                const aiResponse = await getAIResponse(currentProvider, query);
                if (aiResponse) {
                    const formattedResponse = formatAIResponse(currentProvider, aiResponse);
                    return sock.sendMessage(chatId, {
                        text: formattedResponse
                    });
                }
            } catch (error) {
                console.error(`Attempt ${index + 1} with ${currentProvider.name} failed:`, error.message);
                
                if (index < providersToTry.length - 1) {
                    await sock.sendMessage(chatId, {
                        text: `⚠️ ${currentProvider.errorMessage} Trying next available AI...`
                    });
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
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

╰───  *BMM AI System*  ───╯
        `;
return sock.sendMessage(chatId, { text: errorMessage });
    }
}

module.exports = aiCommand;
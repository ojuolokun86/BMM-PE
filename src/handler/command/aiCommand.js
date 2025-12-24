const axios = require('axios');
const sendToChat = require('../../utils/sendToChat');

const AI_PROVIDERS = {
    'gpt': {
        name: "🤖 GPT-3.5",
        url: (query) => `https://lance-frank-asta.onrender.com/api/gpt?q=${encodeURIComponent(query)}`,
        method: 'GET',
        responseParser: (data) => {
            if (data && data.result) return data.result;
            if (data && data.message) return data.message;
            if (data && data.response) return data.response;
            return "No response from GPT-3.5";
        },
        errorMessage: "GPT-3.5 is currently unavailable."
    },
    'llama': {
        name: "🦙 Meta Llama",
        url: (query) => `https://api.giftedtech.co.ke/api/ai/meta-llama?apikey=gifted&q=${encodeURIComponent(query)}`,
        method: 'GET',
        responseParser: (data) => {
            if (data && data.result) return data.result;
            if (data && data.answer) return data.answer;
            if (data && data.response) return data.response;
            return "No response from Llama";
        },
        errorMessage: "Llama AI is currently unavailable."
    },
    'mistral': {
        name: "🌬️ Mistral AI",
        url: (query) => `https://api.giftedtech.co.ke/api/ai/mistral?apikey=gifted&q=${encodeURIComponent(query)}`,
        method: 'GET',
        responseParser: (data) => {
            if (data && data.result) return data.result;
            if (data && data.answer) return data.answer;
            if (data && data.response) return data.response;
            return "No response from Mistral";
        },
        errorMessage: "Mistral AI is currently unavailable."
    },
   'deepseek': {
            name: "🔍 DeepSeek V3",
            url: (query) => `https://api.giftedtech.co.ke/api/ai/deepseek-v3?apikey=gifted&q=${encodeURIComponent(query)}`,
            method: 'GET',
            responseParser: (data) => {
                // Handle case when API returns success but no result
                if (data && data.status === 200 && data.success) {
                    return "I'm sorry, I couldn't generate a response. Please try again or ask a different question.";
                }
                if (data && data.result) return data.result;
                if (data && data.answer) return data.answer;
                if (data && data.response) return data.response;
                return "No response from DeepSeek";
            },
            errorMessage: "DeepSeek V3 is currently unavailable."
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
            const requestData = provider.getData ? provider.getData(query) : { query };
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
│   └─ Chat with GPT-3.5
│
│ • *${prefix}llama <message>*
│   └─ Chat with Meta Llama
│
│ • *${prefix}mistral <message>*
│   └─ Chat with Mistral AI
│
│ • *${prefix}deepseek <message>*
│   └─ Chat with DeepSeek V3
│
│ Example: *${prefix}ai* How does quantum computing work?

╰───  *BMM AI System*  ───╯
        `;
        
        return sendToChat(sock, chatId, { message: helpMessage });
    }

    try {
        await sendToChat(sock, chatId, {
            message: "⏳ *Processing your request...*"
        });

        let providersToTry = [];
        
        if (cmd === 'gpt') {
            providersToTry = [AI_PROVIDERS.gpt, AI_PROVIDERS.llama, AI_PROVIDERS.mistral, AI_PROVIDERS.deepseek];
        } else if (cmd === 'llama') {
            providersToTry = [AI_PROVIDERS.llama, AI_PROVIDERS.gpt, AI_PROVIDERS.mistral];
        } else if (cmd === 'mistral') {
            providersToTry = [AI_PROVIDERS.mistral, AI_PROVIDERS.gpt, AI_PROVIDERS.llama];
        } else if (cmd === 'deepseek' || cmd === 'ds') {
            providersToTry = [AI_PROVIDERS.deepseek, AI_PROVIDERS.gpt, AI_PROVIDERS.mistral];
        } else {
            providersToTry = Object.values(AI_PROVIDERS).sort(() => Math.random() - 0.5);
        }

        for (const [index, currentProvider] of providersToTry.entries()) {
            try {
                const aiResponse = await getAIResponse(currentProvider, query);
                if (aiResponse) {
                    const formattedResponse = formatAIResponse(currentProvider, aiResponse);
                    return sendToChat(sock, chatId, {
                        message: formattedResponse
                    });
                }
            } catch (error) {
                console.error(`Attempt ${index + 1} with ${currentProvider.name} failed:`, error.message);
                
                if (index < providersToTry.length - 1) {
                    await sendToChat(sock, chatId, {
                        message: `⚠️ ${currentProvider.errorMessage} Trying next available AI...`
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
        return sendToChat(sock, chatId, { message: errorMessage });
    }
}

module.exports = aiCommand;
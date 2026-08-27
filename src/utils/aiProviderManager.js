const axios = require('axios');

const AI_PROVIDERS = {
  cloudflare: {
    name: 'Cloudflare AI',
    url: 'https://ai-gateway.ojuolokun86.workers.dev',
    method: 'POST',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    },
    buildPayload(messages) {
      return { messages: normalizeMessages(messages) };
    },
    parseResponse(data) {
      if (typeof data === 'string') {
        return data.trim() || null;
      }
      if (!data || typeof data !== 'object') {
        return null;
      }

      const candidates = [
        data.reply,
        data.response,
        data.result,
        data.message,
        data.answer,
        data.content,
        data.text
      ];

      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
          return candidate.trim();
        }
      }

      const choicesText = data?.choices?.[0]?.message?.content;
      if (typeof choicesText === 'string' && choicesText.trim()) {
        return choicesText.trim();
      }

      const choiceText = data?.choices?.[0]?.text;
      if (typeof choiceText === 'string' && choiceText.trim()) {
        return choiceText.trim();
      }

      return null;
    }
  },
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    method: 'POST',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_API_KEY}`
    },
    buildPayload(messages) {
      return {
        model: 'openai/gpt-oss-120b',
        messages: normalizeMessages(messages)
      };
    },
    parseResponse(data) {
      if (typeof data === 'string') {
        return data.trim() || null;
      }
      if (!data || typeof data !== 'object') {
        return null;
      }

      const choicesText = data?.choices?.[0]?.message?.content;
      if (typeof choicesText === 'string' && choicesText.trim()) {
        return choicesText.trim();
      }

      const choiceText = data?.choices?.[0]?.text;
      if (typeof choiceText === 'string' && choiceText.trim()) {
        return choiceText.trim();
      }

      const candidates = [
        data.reply,
        data.response,
        data.result,
        data.message,
        data.answer,
        data.content,
        data.text
      ];

      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
          return candidate.trim();
        }
      }

      return null;
    }
  }
};

const AI_SESSION_MEMORY = new Map();

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [{ role: 'user', content: '' }];
  }

  return messages.map((message) => {
    if (typeof message === 'string') {
      return { role: 'user', content: message };
    }

    const role = message?.role || 'user';
    const content = typeof message?.content === 'string'
      ? message.content
      : JSON.stringify(message?.content ?? message ?? '');

    return {
      role,
      content
    };
  }).filter((message) => message.content && String(message.content).trim());
}

function getPriorityOrder(currentProvider) {
  const all = ['groq', 'cloudflare'];
  if (!currentProvider) return ['groq', 'cloudflare'];
  return [currentProvider, ...all.filter((provider) => provider !== currentProvider)];
}

function getSessionState(sessionId) {
  const key = sessionId || 'default';
  if (!AI_SESSION_MEMORY.has(key)) {
    AI_SESSION_MEMORY.set(key, {
      active_ai_provider: 'groq'
    });
  }
  return AI_SESSION_MEMORY.get(key);
}

function setSessionProvider(sessionId, provider) {
  const key = sessionId || 'default';
  const state = getSessionState(key);
  state.active_ai_provider = provider;
  AI_SESSION_MEMORY.set(key, state);
}

function safeErrorMessage(error) {
  if (!error) return 'unknown AI error';
  if (error.response && error.response.data) {
    if (typeof error.response.data === 'string') {
      return error.response.data.slice(0, 120);
    }
    if (error.response.data?.error) {
      return typeof error.response.data.error === 'string'
        ? error.response.data.error.slice(0, 120)
        : 'provider returned an invalid error payload';
    }
  }
  if (error.message) return error.message.slice(0, 120);
  return 'provider request failed';
}

async function callProvider(providerKey, messages) {
  const provider = AI_PROVIDERS[providerKey];
  if (!provider) {
    return {
      success: false,
      provider: providerKey,
      error: `Unknown provider: ${providerKey}`
    };
  }

  const payload = provider.buildPayload(messages);

  try {
    console.log(`[AI] Calling ${provider.name}...`);

    const response = await axios.post(provider.url, payload, {
      timeout: provider.timeout,
      headers: provider.headers || { 'Content-Type': 'application/json' },
      validateStatus: (status) => status >= 200 && status < 500
    });

    const rawText = provider.parseResponse(response.data);
    const isEmptyBody = response.status === 200 && (!response.data || (typeof response.data === 'string' && !response.data.trim()) || rawText === null || rawText === undefined);

    if (response.status !== 200 || isEmptyBody || !rawText) {
      const reason = response.status !== 200
        ? `HTTP ${response.status}`
        : 'empty or invalid response';
      throw new Error(`${provider.name} failed: ${reason}`);
    }

    const text = String(rawText).trim();
    console.log(`[AI] ${provider.name} response successful`);

    return {
      success: true,
      provider: providerKey,
      text
    };
  } catch (error) {
    const message = safeErrorMessage(error);
    console.log(`[AI] ${provider.name} failed: ${message}`);
    return {
      success: false,
      provider: providerKey,
      error: message
    };
  }
}

async function callAI(sessionId, messages, options = {}) {
  const preparedMessages = normalizeMessages(messages);
  const sessionState = getSessionState(sessionId);
  const preferredOrder = options.preferredOrder || getPriorityOrder(sessionState.active_ai_provider);

  console.log(`[AI] Session provider: ${sessionState.active_ai_provider || 'groq'} | sessionId: ${sessionId}`);

  let lastFailure = null;

  for (const providerKey of preferredOrder) {
    const result = await callProvider(providerKey, preparedMessages);
    if (result.success) {
      setSessionProvider(sessionId, providerKey);
      console.log(`[AI] Session provider changed to ${providerKey}`);
      return {
        success: true,
        provider: providerKey,
        text: result.text
      };
    }

    lastFailure = result.error || 'provider request failed';

    if (providerKey !== preferredOrder[preferredOrder.length - 1]) {
      console.log(`[AI] Falling back to next provider...`);
    }
  }

  return {
    success: false,
    provider: sessionState.active_ai_provider || 'groq',
    error: lastFailure || 'All AI providers failed'
  };
}

module.exports = {
  AI_PROVIDERS,
  AI_SESSION_MEMORY,
  getSessionState,
  setSessionProvider,
  normalizeMessages,
  callAI,
  callProvider
};

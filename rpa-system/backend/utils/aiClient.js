// Lightweight AI client abstraction supporting OpenAI and Anthropic (Claude)
const OpenAI = (() => {
  try {
    return require('openai');
  } catch (e) {
    return null;
  }
})();

const fetch = global.fetch || (typeof require === 'function' ? require('node-fetch') : null);

function detectProvider(modelName) {
  const providerEnv = (process.env.DEFAULT_AI_PROVIDER || '').toLowerCase();
  if (providerEnv === 'anthropic') return 'anthropic';
  if (providerEnv === 'openai') return 'openai';
  if (modelName && typeof modelName === 'string' && modelName.toLowerCase().includes('claude')) return 'anthropic';
  return 'openai';
}

function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!OpenAI || !apiKey) return null;
  const client = new OpenAI({ apiKey });
  // normalize to expected interface: client.chat.completions.create
  return client;
}

function createAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!fetch || !apiKey) return null;

  // Return a minimal wrapper with chat.completions.create compatible signature
  return {
    chat: {
      completions: {
        async create({ model, messages, temperature = 0.7, max_tokens }) {
          // Convert messages to a single prompt
          const prompt = Array.isArray(messages)
            ? messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
            : String(messages || '');

          const body = {
            model: model || process.env.OPENAI_MODEL || 'claude-haiku-4.5',
            input: prompt,
            temperature: temperature,
            max_tokens: max_tokens || 2000
          };

          const res = await fetch('https://api.anthropic.com/v1/responses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
          });

          if (!res.ok) {
            const text = await res.text();
            const err = new Error(`Anthropic API error: ${res.status} ${text}`);
            err.status = res.status;
            throw err;
          }

          const data = await res.json();

          // Map Anthropic response to an OpenAI-like shape used in code
          const content = (data?.result?.output_text) || (Array.isArray(data?.outputs) && data.outputs[0]?.content?.[0]?.text) || '';
          return {
            choices: [{ message: { content } }],
            usage: data?.usage || {}
          };
        }
      }
    }
  };
}

function createAIClient() {
  const modelName = process.env.OPENAI_MODEL || process.env.DEFAULT_AI_MODEL || '';
  const provider = detectProvider(modelName);
  if (provider === 'anthropic') {
    const c = createAnthropicClient();
    if (c) return c;
    // fallback to OpenAI if Anthropic not configured
  }
  const openai = createOpenAIClient();
  if (openai) return openai;
  return null;
}

module.exports = { createAIClient };

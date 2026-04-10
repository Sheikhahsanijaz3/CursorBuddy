/**
 * Selection Inference Service
 *
 * Runs a fast, lightweight inference to generate contextual action
 * suggestions for selected text. Uses a separate model/provider
 * from the main chat inference so it can be faster/cheaper.
 */

const Anthropic = require('@anthropic-ai/sdk').default;
const OpenAI = require('openai').default;
const { loadSettings } = require('../lib/settings-cache.js');
const log = require('../lib/session-logger.js');

const SUGGESTION_SYSTEM_PROMPT = `You analyze selected text and suggest 2-4 short contextual actions the user might want. Return ONLY valid JSON — no markdown, no explanation.

Return format: {"suggestions": [{"action": "<id>", "label": "<short label>", "prompt": "<full prompt to execute if chosen>"}]}

Action IDs: explain, fix, translate, summarize, rewrite, debug, search, reply, define, improve, convert, continue

Examples:
- Code with bug → [{"action":"debug","label":"Debug this","prompt":"Find and fix the bug in this code: ..."}, {"action":"explain","label":"Explain","prompt":"Explain this code: ..."}]
- Foreign text → [{"action":"translate","label":"Translate","prompt":"Translate to English: ..."}]
- Error message → [{"action":"debug","label":"Fix error","prompt":"Explain this error and suggest a fix: ..."}]
- Prose → [{"action":"improve","label":"Improve","prompt":"Improve this writing: ..."}, {"action":"summarize","label":"Summarize","prompt":"Summarize: ..."}]

Be contextual — only suggest actions that make sense for the content. Keep labels under 15 chars.`;

async function getSuggestions(text, opts = {}) {
  const settings = loadSettings();
  
  // Allow model/provider override from settings or opts
  const provider = opts.provider || settings.selectionProvider || settings.provider || 'anthropic';
  const model = opts.model || settings.selectionModel || getDefaultModel(provider);
  
  log.event('selection:inference-start', { provider, model, textLength: text.length });
  
  try {
    let result;
    const truncated = text.length > 2000 ? text.slice(0, 2000) + '...' : text;
    
    if (provider === 'anthropic') {
      result = await runAnthropicSuggestion(model, truncated, settings);
    } else {
      result = await runOpenAISuggestion(provider, model, truncated, settings);
    }
    
    log.event('selection:inference-done', { suggestions: result.length });
    return result;
  } catch (err) {
    log.event('selection:inference-error', { error: err.message });
    return [{ action: 'explain', label: 'Explain this', prompt: `Explain this text:\n\n${text}` }];
  }
}

function getDefaultModel(provider) {
  switch (provider) {
    case 'anthropic': return 'claude-sonnet-4-20250514';
    case 'openai': return 'gpt-4o-mini';
    case 'ollama': return 'llama3.2';
    case 'lmstudio': return 'default';
    default: return 'claude-sonnet-4-20250514';
  }
}

async function runAnthropicSuggestion(model, text, settings) {
  const apiKey = settings.anthropicApiKey || settings.anthropicKey;
  if (!apiKey) throw new Error('No Anthropic API key');
  
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 300,
    system: SUGGESTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Selected text:\n\n${text}` }],
  });
  
  return parseSuggestions(response.content[0]?.text || '', text);
}

async function runOpenAISuggestion(provider, model, text, settings) {
  const baseURL = getBaseURL(provider, settings);
  const apiKey = getAPIKey(provider, settings);
  
  const client = new OpenAI({ baseURL, apiKey });
  const response = await client.chat.completions.create({
    model,
    max_tokens: 300,
    messages: [
      { role: 'system', content: SUGGESTION_SYSTEM_PROMPT },
      { role: 'user', content: `Selected text:\n\n${text}` },
    ],
  });
  
  return parseSuggestions(response.choices[0]?.message?.content || '', text);
}

function getBaseURL(provider, settings) {
  switch (provider) {
    case 'openai': return settings.openaiBaseUrl || 'https://api.openai.com/v1';
    case 'ollama': return settings.ollamaBaseUrl || 'http://localhost:11434/v1';
    case 'lmstudio': return settings.lmstudioBaseUrl || 'http://localhost:1234/v1';
    default: return 'https://api.openai.com/v1';
  }
}

function getAPIKey(provider, settings) {
  switch (provider) {
    case 'openai': return settings.openaiApiKey || settings.openaiKey || '';
    case 'ollama': return 'ollama';
    case 'lmstudio': return 'lmstudio';
    default: return settings.openaiApiKey || '';
  }
}

function parseSuggestions(raw, originalText) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const suggestions = parsed.suggestions || parsed;
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        return suggestions.slice(0, 4).map(s => ({
          action: s.action || 'explain',
          label: (s.label || 'Explain').slice(0, 20),
          prompt: s.prompt || `${s.label || 'Explain'}:\n\n${originalText}`,
        }));
      }
    }
  } catch (_) {}
  
  // Fallback
  return [{ action: 'explain', label: 'Explain this', prompt: `Explain this:\n\n${originalText}` }];
}

/** Run a chosen action through the main inference pipeline */
async function runAction(actionPrompt, opts = {}) {
  // This just returns the prompt — the caller wires it to the main inference
  return actionPrompt;
}

module.exports = { getSuggestions, runAction, SUGGESTION_SYSTEM_PROMPT };

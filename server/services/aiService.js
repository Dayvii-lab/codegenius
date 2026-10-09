'use strict';

/**
 * OpenAI-compatible chat completions client.
 * Works with OpenAI, Groq, Together, OpenRouter, etc.
 */

function ensureConfigured() {
  if (!process.env.AI_API_KEY) {
    const err = new Error(
      'AI provider is not configured. Set AI_API_KEY, AI_BASE_URL, and AI_MODEL in your .env file.'
    );
    err.status = 503;
    throw err;
  }
  if (!process.env.AI_BASE_URL) {
    const err = new Error('AI_BASE_URL is not set.');
    err.status = 503;
    throw err;
  }
  if (!process.env.AI_MODEL) {
    const err = new Error('AI_MODEL is not set.');
    err.status = 503;
    throw err;
  }
}

function buildMessages({ system, history, userText, images }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });

  for (const m of history || []) {
    if (!m || !m.role || !m.content) continue;
    if (m.role === 'system') continue;
    messages.push({ role: m.role, content: m.content });
  }

  if (images && images.length) {
    const parts = [{ type: 'text', text: userText || 'Analyze the attached image(s).' }];
    for (const img of images) {
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${img.mime};base64,${img.base64}` },
      });
    }
    messages.push({ role: 'user', content: parts });
  } else {
    messages.push({ role: 'user', content: userText });
  }

  return messages;
}

async function callChat({ system, history, userText, images, model, stream }) {
  ensureConfigured();

  const base = process.env.AI_BASE_URL.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;

  const useModel = model || (images && images.length ? process.env.AI_VISION_MODEL || process.env.AI_MODEL : process.env.AI_MODEL);

  const body = {
    model: useModel,
    messages: buildMessages({ system, history, userText, images }),
    stream: Boolean(stream),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const e = new Error(`AI provider request failed: ${err.message}`);
    e.status = 502;
    throw e;
  }

  if (!response.ok) {
    clearTimeout(timeout);
    const text = await response.text().catch(() => '');
    const e = new Error(`AI provider responded with ${response.status}: ${text.slice(0, 500)}`);
    e.status = response.status === 429 ? 429 : 502;
    throw e;
  }

  if (!stream) {
    const data = await response.json();
    clearTimeout(timeout);
    const content = data?.choices?.[0]?.message?.content ?? '';
    return { content, raw: data };
  }

  return { stream: response.body, clearTimeout };
}

module.exports = { callChat };

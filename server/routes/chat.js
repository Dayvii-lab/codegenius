'use strict';

const express = require('express');
const { chatLimiter } = require('../middleware/rateLimiter');
const { callChat } = require('../services/aiService');
const { isConfigured: visionReady, analyzeImages } = require('../services/visionService');
const {
  createConversation,
  appendMessage,
  getConversation,
  getHistory,
} = require('../services/conversationService');
const { getOwnerKey } = require('../services/ownerService');

const router = express.Router();

const SYSTEM_PROMPT =
  'You are CodePilot AI, an expert programming assistant. ' +
  'Provide accurate, practical, well-structured answers. Use Markdown. ' +
  'For code, use fenced code blocks with language labels. ' +
  'Prefer official docs and current best practices. ' +
  'If you are unsure, say so. Never claim to have executed code you did not run.';

router.post('/', chatLimiter, async (req, res, next) => {
  try {
    const ownerKey = getOwnerKey(req);
    const { conversationId, message, images } = req.body || {};

    if (!message && (!images || !images.length)) {
      return res.status(400).json({ error: 'A message or at least one image is required.' });
    }
    if (message && typeof message !== 'string') {
      return res.status(400).json({ error: 'Message must be a string.' });
    }
    if (message && message.length > 20000) {
      return res.status(413).json({ error: 'Message too long.' });
    }
    if (images && (!Array.isArray(images) || images.length > 4)) {
      return res.status(400).json({ error: 'At most 4 images per request.' });
    }

    let convId = conversationId;
    if (!convId) {
      const conv = await createConversation(ownerKey, (message || 'New chat').slice(0, 60));
      convId = conv.id;
    } else {
      const conv = await getConversation(ownerKey, convId);
      if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (message) await appendMessage(convId, 'user', message, { images: images ? images.length : 0 });

    const history = await getHistory(convId, 20);

    // Vision path
    if (images && images.length) {
      if (!visionReady()) {
        return res.status(503).json({
          error: 'Vision model is not configured. Set AI_API_KEY and AI_VISION_MODEL to analyze images.',
        });
      }
      const content = await analyzeImages({ prompt: message, images, history });
      await appendMessage(convId, 'assistant', content);
      return res.json({ conversationId: convId, content });
    }

    // Streaming text path
    const accept = req.headers.accept || '';
    const wantsStream = accept.includes('text/event-stream');

    if (!process.env.AI_API_KEY) {
      return res.status(503).json({
        error:
          'AI provider is not configured. Set AI_API_KEY, AI_BASE_URL, and AI_MODEL in the server .env file.',
      });
    }

    if (!wantsStream) {
      const { content } = await callChat({
        system: SYSTEM_PROMPT,
        history,
        userText: message,
        stream: false,
      });
      await appendMessage(convId, 'assistant', content);
      return res.json({ conversationId: convId, content });
    }

    // SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(`event: meta\ndata: ${JSON.stringify({ conversationId: convId })}\n\n`);

    let full = '';
    let aborted = false;
    req.on('close', () => {
      aborted = true;
    });

    try {
      const { stream } = await callChat({
        system: SYSTEM_PROMPT,
        history,
        userText: message,
        stream: true,
      });

      const reader = stream.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (!aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content || '';
            if (delta) {
              full += delta;
              res.write(`event: delta\ndata: ${JSON.stringify({ text: delta })}\n\n`);
            }
          } catch {
            /* ignore malformed lines */
          }
        }
      }

      await appendMessage(convId, 'assistant', full);
      res.write(`event: done\ndata: ${JSON.stringify({ conversationId: convId })}\n\n`);
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    } finally {
      res.end();
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;

'use strict';

const express = require('express');
const { chatLimiter } = require('../middleware/rateLimiter');
const searchService = require('../services/searchService');
const { callChat } = require('../services/aiService');
const { getOwnerKey } = require('../services/ownerService');
const { createConversation, appendMessage, getHistory } = require('../services/conversationService');

const router = express.Router();

router.post('/', chatLimiter, async (req, res, next) => {
  try {
    const ownerKey = getOwnerKey(req);
    const { query, conversationId } = req.body || {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'A query string is required.' });
    }
    if (!searchService.isConfigured()) {
      return res.status(503).json({
        error: 'Web search is not configured. Set SEARCH_API_KEY and SEARCH_API_URL on the server.',
      });
    }
    if (!process.env.AI_API_KEY) {
      return res.status(503).json({ error: 'AI provider is not configured.' });
    }

    let convId = conversationId;
    if (!convId) {
      const conv = await createConversation(ownerKey, `Research: ${query.slice(0, 50)}`);
      convId = conv.id;
    }
    await appendMessage(convId, 'user', query, { mode: 'research' });

    const results = await searchService.search(query, { maxResults: 5 });

    // Optionally enrich with page text for top 2 results
    const enriched = [];
    for (const r of results.results.slice(0, 2)) {
      const text = await searchService.fetchPageText(r.url).catch(() => null);
      enriched.push({ ...r, excerpt: text ? text.slice(0, 4000) : '' });
    }
    const rest = results.results.slice(2);
    const all = [...enriched, ...rest];

    const evidence = all
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}\nExcerpt: ${r.excerpt || '(not fetched)'}`
      )
      .join('\n\n');

    const history = await getHistory(convId, 10);

    const system =
      'You are CodePilot AI in research mode. Use ONLY the evidence provided to answer. ' +
      'Cite sources inline like [1], [2] matching the evidence list. ' +
      'If evidence is insufficient, say so clearly. Do not invent URLs, dates, or facts.';

    const userText =
      `Question: ${query}\n\nEvidence:\n${evidence}\n\n` +
      `Write a clear, well-organized answer with a "Sources" section listing each cited URL.`;

    const { content } = await callChat({ system, history, userText, stream: false });

    await appendMessage(convId, 'assistant', content, { mode: 'research', sources: all });

    res.json({
      conversationId: convId,
      content,
      sources: all.map((r) => ({ title: r.title, url: r.url })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

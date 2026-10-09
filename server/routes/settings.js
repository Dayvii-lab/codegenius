'use strict';

const express = require('express');

const router = express.Router();

router.get('/capabilities', (req, res) => {
  res.json({
    ai: Boolean(process.env.AI_API_KEY),
    vision: Boolean(process.env.AI_API_KEY && (process.env.AI_VISION_MODEL || process.env.AI_MODEL)),
    search: Boolean(process.env.SEARCH_API_KEY && process.env.SEARCH_API_URL),
    model: process.env.AI_MODEL || null,
    visionModel: process.env.AI_VISION_MODEL || null,
    // Temporary diagnostics
    aiBaseUrl: process.env.AI_BASE_URL || 'MISSING',
    aiKeyPrefix: process.env.AI_API_KEY ? process.env.AI_API_KEY.slice(0, 8) + '...' : 'MISSING',
    aiKeyLength: process.env.AI_API_KEY ? process.env.AI_API_KEY.length : 0,
  });
});

module.exports = router;

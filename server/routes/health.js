'use strict';

const express = require('express');
const { isDatabaseEnabled } = require('../database/db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    name: 'CodePilot AI',
    time: new Date().toISOString(),
    aiConfigured: Boolean(process.env.AI_API_KEY),
    visionConfigured: Boolean(process.env.AI_API_KEY && (process.env.AI_VISION_MODEL || process.env.AI_MODEL)),
    searchConfigured: Boolean(process.env.SEARCH_API_KEY && process.env.SEARCH_API_URL),
    database: isDatabaseEnabled() ? 'postgres' : 'guest-memory',
  });
});

module.exports = router;

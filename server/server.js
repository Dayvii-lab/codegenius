'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { securityHeaders, requestSizeGuard } = require('./middleware/security');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const healthRoute = require('./routes/health');
const chatRoute = require('./routes/chat');
const researchRoute = require('./routes/research');
const uploadsRoute = require('./routes/uploads');
const projectsRoute = require('./routes/projects');
const conversationsRoute = require('./routes/conversations');
const settingsRoute = require('./routes/settings');

const { initDatabase, isDatabaseEnabled } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Core middleware ---
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(securityHeaders);
app.use(
  cors({
    origin: process.env.APP_BASE_URL || true,
    credentials: true,
  })
);
app.use(cookieParser(process.env.SESSION_SECRET || 'dev-only-secret'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(requestSizeGuard);

// --- Static frontend ---
app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    index: 'index.html',
    extensions: ['html'],
  })
);

// --- API routes ---
app.use('/api', apiLimiter);
app.use('/api/health', healthRoute);
app.use('/api/chat', chatRoute);
app.use('/api/research', researchRoute);
app.use('/api/uploads', uploadsRoute);
app.use('/api/projects', projectsRoute);
app.use('/api/conversations', conversationsRoute);
app.use('/api/settings', settingsRoute);

// --- SPA fallback for non-API routes ---
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use('/api', notFound);
app.use(errorHandler);

// --- Startup ---
async function start() {
  console.log('[CodePilot AI] Starting server...');
  console.log(`[CodePilot AI] NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  console.log(`[CodePilot AI] AI provider configured: ${Boolean(process.env.AI_API_KEY)}`);
  console.log(`[CodePilot AI] Search provider configured: ${Boolean(process.env.SEARCH_API_KEY)}`);

  try {
    await initDatabase();
    console.log(`[CodePilot AI] Database: ${isDatabaseEnabled() ? 'enabled' : 'guest mode (in-memory)'}`);
  } catch (err) {
    console.error('[CodePilot AI] Database init failed, continuing in guest mode:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`[CodePilot AI] Listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[CodePilot AI] Fatal startup error:', err);
  process.exit(1);
});

module.exports = app;

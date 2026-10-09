'use strict';

function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const safeMessage = isProd && status >= 500 ? 'Internal server error' : err.message;

  // Never log secrets or full bodies
  console.error(`[Error] ${req.method} ${req.originalUrl} -> ${status}: ${err.message}`);

  if (res.headersSent) return;
  res.status(status).json({
    error: safeMessage,
    ...(isProd ? {} : { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };

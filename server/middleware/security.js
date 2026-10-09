'use strict';

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
}

function requestSizeGuard(req, res, next) {
  const len = Number(req.headers['content-length'] || 0);
  const MAX = 25 * 1024 * 1024; // 25 MB hard cap
  if (len && len > MAX) {
    return res.status(413).json({ error: 'Request too large.' });
  }
  next();
}

module.exports = { securityHeaders, requestSizeGuard };

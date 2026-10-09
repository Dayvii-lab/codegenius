'use strict';

const crypto = require('crypto');

const COOKIE = 'cp_owner';

function getOwnerKey(req) {
  // If authenticated (not implemented yet), use req.user.id.
  // Otherwise use an anonymous cookie identity.
  let key = req.cookies?.[COOKIE];
  if (!key || typeof key !== 'string' || key.length < 16) {
    key = crypto.randomBytes(18).toString('hex');
    if (req.res) {
      req.res.cookie(COOKIE, key, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 365,
      });
    }
  }
  return key;
}

module.exports = { getOwnerKey };

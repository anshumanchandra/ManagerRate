// ==========================================
// Anonymization Utilities
// ==========================================
// Hash IP + User-Agent for rate limiting and abuse prevention.
// This is NOT for identification — it's a one-way hash that
// prevents the same device from spamming, while being
// impossible to reverse into a real identity.

const crypto = require('crypto');

/**
 * Generate anonymous hash from request.
 * Used for: rate limiting, duplicate vote prevention, abuse tracking.
 * NOT used for: identifying reviewers.
 */
function getAnonymousHash(req) {
  const salt = process.env.HASH_SALT || 'default-change-in-production';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const raw = `${ip}|${ua}|${salt}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Generate a weaker hash (IP only) for broader rate limiting.
 */
function getIpHash(req) {
  const salt = process.env.HASH_SALT || 'default-change-in-production';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  return crypto.createHash('sha256').update(`${ip}|${salt}`).digest('hex');
}

module.exports = { getAnonymousHash, getIpHash };

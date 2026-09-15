// ==========================================
// Rate Limiting — Prevent Spam & Abuse
// ==========================================

const rateLimit = require('express-rate-limit');

/**
 * Global rate limit: 100 requests per 15 minutes per IP.
 * Prevents brute force and general abuse.
 */
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: {
    error: 'Too many requests. Please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,  // Return rate limit info in headers
  legacyHeaders: false,
});

/**
 * Review submission: 3 reviews per hour per IP.
 * Prevents review bombing.
 */
const reviewLimiter = rateLimit({
  windowMs: parseInt(process.env.REVIEW_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max: parseInt(process.env.REVIEW_RATE_LIMIT_MAX) || 3,
  message: {
    error: 'You have submitted too many reviews. Please try again in an hour.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Helpful votes: 20 per hour per IP.
 */
const voteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    error: 'Too many votes. Please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Report submission: 5 per hour per IP.
 */
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many reports. Please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { globalLimiter, reviewLimiter, voteLimiter, reportLimiter };

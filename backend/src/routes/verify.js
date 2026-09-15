// ==========================================
// Email Verification Routes — Server-Side
// ==========================================
// Replaces the insecure client-side email verification with
// a proper server-side flow:
//
//   1. Client sends { email, company } → server validates domain,
//      generates code, emails it.
//   2. Client sends { email, code } → server validates, returns
//      a signed JWT verification token.
//   3. Client submits review with the token → server validates
//      JWT and marks review as "verified".
//
// Security properties:
//   • Domain mapping lives server-side only (not inspectable)
//   • Codes are single-use, 6-digit, 10-minute TTL
//   • Rate limited: 3 codes per email per hour
//   • JWT token is signed with a server secret
//   • Email is never stored in plain text — only hashed for audit

const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { emailMatchesCompany } = require('../config/companyDomains');
const { sendVerificationCode } = require('../services/emailService');

var router = express.Router();

// ── In-memory code store ────────────────────────────────────
// Structure: Map<email, { code, company, expiresAt, attempts }>
// In production, replace with Redis for multi-instance support.
var codeStore = new Map();

// Rate tracking: Map<email, { count, windowStart }>
var rateLimitStore = new Map();

var CODE_TTL_MS = 10 * 60 * 1000;         // 10 minutes
var MAX_CODES_PER_HOUR = 3;
var RATE_WINDOW_MS = 60 * 60 * 1000;      // 1 hour
var MAX_VERIFY_ATTEMPTS = 5;               // Max wrong code attempts per code
var TOKEN_EXPIRY_SECONDS = 60 * 60;        // 1 hour JWT

// ── Helpers ─────────────────────────────────────────────────

/**
 * Generate a cryptographically random 6-digit code.
 * Uses crypto.randomInt for uniform distribution (no modulo bias).
 */
function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Schedule automatic cleanup of an expired code.
 */
function scheduleCleanup(email, ttl) {
  setTimeout(function () {
    var entry = codeStore.get(email);
    if (entry && entry.expiresAt <= Date.now()) {
      codeStore.delete(email);
    }
  }, ttl + 1000); // +1s grace
}

/**
 * Check per-email rate limit (3 codes per hour).
 * Returns true if the request should be blocked.
 */
function isRateLimited(email) {
  var now = Date.now();
  var entry = rateLimitStore.get(email);

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    // New window
    rateLimitStore.set(email, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= MAX_CODES_PER_HOUR) {
    return true;
  }

  entry.count++;
  return false;
}

/**
 * Minimal JWT implementation using HMAC-SHA256.
 * We avoid a full jsonwebtoken dependency — verification tokens
 * are simple and short-lived, so a hand-rolled HMAC JWT is fine.
 */
function getJwtSecret() {
  var secret = process.env.JWT_VERIFY_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_VERIFY_SECRET must be set in production (min 16 chars)');
    }
    secret = 'dev-only-insecure-jwt-secret-change-me';
  }
  return secret;
}

function base64UrlEncode(data) {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

function signJwt(payload) {
  var secret = getJwtSecret();
  var header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  var body = base64UrlEncode(JSON.stringify(payload));
  var signature = crypto
    .createHmac('sha256', secret)
    .update(header + '.' + body)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return header + '.' + body + '.' + signature;
}

function verifyJwt(token) {
  try {
    var parts = token.split('.');
    if (parts.length !== 3) return null;

    var secret = getJwtSecret();
    var expectedSig = crypto
      .createHmac('sha256', secret)
      .update(parts[0] + '.' + parts[1])
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Timing-safe comparison to prevent timing attacks
    if (parts[2].length !== expectedSig.length) return null;
    var sigBuffer = Buffer.from(parts[2]);
    var expectedBuffer = Buffer.from(expectedSig);
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    var payload = JSON.parse(base64UrlDecode(parts[1]));

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Hash an email address for audit storage.
 * Uses SHA-256 with the server's HASH_SALT.
 */
function hashEmail(email) {
  var salt = process.env.HASH_SALT || 'default-change-in-production';
  return crypto
    .createHash('sha256')
    .update(email.toLowerCase().trim() + '|' + salt)
    .digest('hex');
}

// ── Validation middleware ───────────────────────────────────

var validateSendCode = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email too long'),

  body('company')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Company name must be 2-200 characters'),
];

var validateConfirmCode = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 254 }),

  body('code')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Code must be exactly 6 digits'),
];

function handleValidation(req, res, next) {
  var errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(function (e) {
        return { field: e.path, message: e.msg };
      }),
    });
  }
  next();
}

// ═══════════════════════════════════════════════════════════
// POST /api/verify/send-code
// ═══════════════════════════════════════════════════════════

router.post('/send-code', validateSendCode, handleValidation, async function (req, res) {
  try {
    var email = req.body.email.toLowerCase().trim();
    var company = req.body.company.trim();

    // 1. Rate limit: 3 codes per email per hour
    if (isRateLimited(email)) {
      return res.status(429).json({
        error: 'Too many verification attempts. Please try again later.',
        retryAfter: '1 hour',
      });
    }

    // 2. Validate email domain matches company (server-side check)
    var domainCheck = emailMatchesCompany(email, company);

    if (!domainCheck.matches && domainCheck.confidence !== 'unknown_company') {
      return res.status(400).json({
        error: 'Email domain does not match the selected company.',
        detail: 'Please use your work email address for ' + company + '.',
      });
    }

    // For unknown companies, we still send the code but won't
    // mark the verification as "domain_confirmed". The review
    // will show "email_verified" but not "domain_verified".

    // 3. Generate 6-digit code
    var code = generateCode();

    // 4. Store code with TTL
    var expiresAt = Date.now() + CODE_TTL_MS;
    codeStore.set(email, {
      code: code,
      company: company,
      domainMatch: domainCheck.matches,
      domainConfidence: domainCheck.confidence,
      expiresAt: expiresAt,
      attempts: 0,
      createdAt: Date.now(),
    });
    scheduleCleanup(email, CODE_TTL_MS);

    // 5. Send email
    var result = await sendVerificationCode(email, code);

    res.json({
      success: true,
      message: 'Verification code sent to ' + email.replace(/^(.{2})(.*)(@.*)$/, function (m, a, b, c) {
        return a + b.replace(/./g, '*') + c;
      }),
      provider: process.env.NODE_ENV === 'development' ? result.provider : undefined,
      expiresIn: '10 minutes',
    });

  } catch (error) {
    console.error('POST /api/verify/send-code error:', error);
    res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/verify/confirm-code
// ═══════════════════════════════════════════════════════════

router.post('/confirm-code', validateConfirmCode, handleValidation, async function (req, res) {
  try {
    var email = req.body.email.toLowerCase().trim();
    var code = req.body.code.trim();

    // 1. Look up stored code
    var entry = codeStore.get(email);

    if (!entry) {
      return res.status(400).json({
        error: 'No verification code found. Please request a new code.',
      });
    }

    // 2. Check expiry
    if (entry.expiresAt <= Date.now()) {
      codeStore.delete(email);
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new code.',
      });
    }

    // 3. Check attempt limit (prevent brute force on the 6-digit code)
    if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
      codeStore.delete(email);
      return res.status(429).json({
        error: 'Too many incorrect attempts. Please request a new code.',
      });
    }

    // 4. Timing-safe code comparison
    var codeBuffer = Buffer.from(code);
    var storedBuffer = Buffer.from(entry.code);
    if (codeBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(codeBuffer, storedBuffer)) {
      entry.attempts++;
      var remaining = MAX_VERIFY_ATTEMPTS - entry.attempts;
      return res.status(400).json({
        error: 'Incorrect verification code.',
        attemptsRemaining: remaining,
      });
    }

    // 5. Code is correct — consume it (single use)
    codeStore.delete(email);

    // 6. Sign a verification JWT
    var now = Math.floor(Date.now() / 1000);
    var payload = {
      sub: hashEmail(email),    // Hashed email — NOT plain text
      company: entry.company,
      domainMatch: entry.domainMatch,
      domainConfidence: entry.domainConfidence,
      purpose: 'email_verification',
      iat: now,
      exp: now + TOKEN_EXPIRY_SECONDS,
    };

    var token = signJwt(payload);

    res.json({
      success: true,
      message: 'Email verified successfully.',
      verificationToken: token,
      expiresIn: TOKEN_EXPIRY_SECONDS + ' seconds',
      domainVerified: entry.domainMatch,
    });

  } catch (error) {
    console.error('POST /api/verify/confirm-code error:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// ═══════════════════════════════════════════════════════════
// Exported utilities (for use in reviews.js)
// ═══════════════════════════════════════════════════════════

module.exports = router;
module.exports.verifyJwt = verifyJwt;
module.exports.hashEmail = hashEmail;

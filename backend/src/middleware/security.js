// ==========================================
// Security Middleware — Helmet, CORS, HPP, CSP
// ==========================================

const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');

/**
 * Apply all security headers via Helmet.
 */
function securityHeaders() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        fontSrc: ["https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    // Force HTTPS
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Prevent MIME sniffing
    noSniff: true,
    // Referrer policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Hide X-Powered-By
    hidePoweredBy: true,
    // XSS filter (legacy browser support)
    xssFilter: true,
  });
}

/**
 * CORS configuration — only allow trusted origins.
 */
function corsConfig() {
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');

  return cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.) in dev
      if (!origin && process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // Cache preflight for 24h
  });
}

/**
 * HTTP Parameter Pollution protection.
 * Prevents ?sort=asc&sort=desc type attacks.
 */
function paramPollutionProtection() {
  return hpp();
}

module.exports = { securityHeaders, corsConfig, paramPollutionProtection };

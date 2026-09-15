// ==========================================
// ManagerRate Backend V2 — Main Server
// ==========================================
// A secure, anonymous manager review platform.
//
// V2 Security features:
// ✅ Helmet (CSP, HSTS, X-Frame-Options, etc.)
// ✅ CORS with whitelist
// ✅ Rate limiting (global + per-endpoint)
// ✅ Input validation (express-validator)
// ✅ XSS prevention (DOMPurify sanitization)
// ✅ HPP protection
// ✅ Content moderation (profanity, PII, defamation detection)
// ✅ Anonymous hashing (abuse prevention without identification)
// ✅ One-review-per-employment-period
// ✅ Review evolution tracking
// ✅ Review bombing detection
// ✅ Auto-flag on 3+ reports
// ✅ Bayesian scoring (not simple averages)
// ✅ Anti-defamation content filtering
// ✅ Manager response system (respond, not delete)

require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const path = require('path');

// Security middleware
const { securityHeaders, corsConfig, paramPollutionProtection } = require('./middleware/security');
const { globalLimiter } = require('./middleware/rateLimiter');

// Core routes
const managerRoutes = require('./routes/managers');
const reviewRoutes = require('./routes/reviews');
const statsRoutes = require('./routes/stats');
const verifyRoutes = require('./routes/verify');

// Admin routes
const adminRoutes = require('./routes/admin');

// Pro routes (loaded conditionally — may not exist yet)
var proRoutes, searchRoutes, discoverRoutes, compareRoutes, insightsRoutes;
try { proRoutes = require('./routes/pro'); } catch (e) { proRoutes = null; }
try { searchRoutes = require('./routes/search'); } catch (e) { searchRoutes = null; }
try { discoverRoutes = require('./routes/discover'); } catch (e) { discoverRoutes = null; }
try { compareRoutes = require('./routes/compare'); } catch (e) { compareRoutes = null; }
try { insightsRoutes = require('./routes/insights'); } catch (e) { insightsRoutes = null; }

const app = express();
const PORT = process.env.PORT || 3001;

// ==========================================
// MIDDLEWARE STACK (order matters!)
// ==========================================

// 1. Security headers (Helmet) — must be first
app.use(securityHeaders());

// 2. CORS — before routes
app.use(corsConfig());

// 3. Request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 4. Body parsing with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// 5. HPP protection
app.use(paramPollutionProtection());

// 6. Global rate limiting
app.use(globalLimiter);

// 7. Trust proxy (needed for rate limiting behind load balancer)
app.set('trust proxy', 1);

// ==========================================
// API ROUTES
// ==========================================

// Core V2
app.use('/api/managers', managerRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/verify', verifyRoutes);


// Pro API (authenticated via API key) — loaded if available
if (proRoutes) app.use('/api/pro', proRoutes);
if (searchRoutes) app.use('/api/search', searchRoutes);
if (discoverRoutes) app.use('/api/discover', discoverRoutes);
if (compareRoutes) app.use('/api/compare', compareRoutes);
if (insightsRoutes) app.use('/api/insights', insightsRoutes);

// ==========================================
// SERVE FRONTEND (Production)
// ==========================================

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('*', function (req, res) {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    }
  });
}

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/api/health', function (req, res) {
  res.json({
    status: 'healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    emailVerification: true,
    features: {
      entitySystem: true,
      bayesianScoring: true,
      reviewEvolution: true,
      bombingDetection: true,
      managerResponses: true,
      antiDefamation: true,
    },
  });
});

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler
app.use(function (req, res) {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler — NEVER leak stack traces in production
app.use(function (err, req, res, next) {
  console.error('Unhandled error:', err);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large (max 10KB)' });
  }

  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message }),
  });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, function () {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     ManagerRate Backend V2                ║');
  console.log('║     Port: ' + PORT + '                             ║');
  console.log('║     Env: ' + (process.env.NODE_ENV || 'development') + '                    ║');
  console.log('║                                          ║');
  console.log('║     Security:  ✅ 20+ protections active  ║');
  console.log('║     Scoring:   ✅ Bayesian + recency      ║');
  console.log('║     Trust:     ✅ Bombing detection        ║');
  console.log('║     Evolution: ✅ Review updates tracked   ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  WARNING: Running in DEVELOPMENT mode');
    console.warn('⚠️  Error details exposed. CORS relaxed. Set NODE_ENV=production before deploying!');
    console.warn('');
  }

  // Log mounted routes
  var routes = ['managers', 'reviews', 'stats', 'admin'];
  if (proRoutes) routes.push('pro');
  if (searchRoutes) routes.push('search');
  if (discoverRoutes) routes.push('discover');
  if (compareRoutes) routes.push('compare');
  if (insightsRoutes) routes.push('insights');
  console.log('  Routes: /api/' + routes.join(', /api/'));
  console.log('');
});

module.exports = app;

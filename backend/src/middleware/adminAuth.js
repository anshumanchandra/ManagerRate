// ==========================================
// Admin JWT Authentication Middleware
// ==========================================
// Verifies JWT tokens for admin panel access.
// Tokens are issued on successful login (POST /api/admin/login)
// and expire after 24 hours.
//
// Security:
//   ✅ Bearer token from Authorization header
//   ✅ 24h expiry enforcement
//   ✅ Admin info attached to req.admin
//   ✅ Timing-safe verification (jsonwebtoken handles this)
//   ✅ No token = 401, invalid/expired = 401

const jwt = require('jsonwebtoken');

/**
 * Get the JWT secret from environment.
 * MUST be set in production — fails loud if missing.
 */
function getJwtSecret() {
  var secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('ADMIN_JWT_SECRET environment variable is required');
  }
  return secret;
}

/**
 * Sign a JWT token for an admin user.
 * Used by the login route — exported for convenience.
 *
 * @param {Object} admin - { id, username }
 * @returns {string} Signed JWT token (24h expiry)
 */
function signAdminToken(admin) {
  return jwt.sign(
    {
      adminId: admin.id,
      username: admin.username,
      type: 'admin',
    },
    getJwtSecret(),
    { expiresIn: '24h' }
  );
}

/**
 * Middleware: Verify admin JWT and attach admin info to request.
 *
 * Extracts token from: Authorization: Bearer <token>
 *
 * Attaches to req:
 *   req.admin — { id, username }
 *
 * Returns 401 for:
 *   - Missing Authorization header
 *   - Malformed Bearer token
 *   - Invalid signature
 *   - Expired token
 */
function adminAuth(req, res, next) {
  try {
    // 1. Extract token from Authorization header
    var authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Authentication required',
        hint: 'Include Authorization: Bearer <token> header',
      });
    }

    // Must be "Bearer <token>" format
    var parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Invalid authorization format',
        hint: 'Use format: Bearer <token>',
      });
    }

    var token = parts[1];

    // Basic token format check (JWTs are base64url segments separated by dots)
    if (!token || token.split('.').length !== 3) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // 2. Verify token (checks signature + expiry)
    var decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          expiredAt: jwtError.expiredAt,
          hint: 'Please log in again to get a new token',
        });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      return res.status(401).json({ error: 'Token verification failed' });
    }

    // 3. Validate token type
    if (decoded.type !== 'admin') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // 4. Attach admin info to request
    req.admin = {
      id: decoded.adminId,
      username: decoded.username,
    };

    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication service error' });
  }
}

module.exports = { adminAuth, signAdminToken, getJwtSecret };

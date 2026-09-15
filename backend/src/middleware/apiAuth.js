// ==========================================
// API Key Authentication Middleware
// ==========================================
// Authenticates Pro API requests using hashed API keys.
// Keys are NEVER stored in plaintext — only SHA-256 hashes.

const crypto = require('crypto');
const prisma = require('../config/database');

/**
 * Hash an API key for database lookup.
 * Must match the hashing in apiKeyGen.js.
 */
function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Middleware: Authenticate API key and attach org + permissions to req.
 *
 * Extracts key from:
 *   1. X-API-Key header (preferred)
 *   2. api_key query parameter (convenience)
 *
 * Attaches to req:
 *   req.org         — { id, name, email, plan, companyName }
 *   req.permissions — ["managers:read", "reports:read", ...]
 *   req.apiKeyId    — for usage logging
 *   req.apiKeyRateLimit — max requests per hour
 */
function apiAuth(requiredPermission) {
  return async (req, res, next) => {
    const startTime = Date.now();

    try {
      // 1. Extract API key
      const rawKey = req.headers['x-api-key'] || req.query.api_key;

      if (!rawKey) {
        return res.status(401).json({
          error: 'API key required',
          hint: 'Pass your key via X-API-Key header or api_key query parameter.',
          docs: '/api/pro/docs',
        });
      }

      // Basic format check
      if (typeof rawKey !== 'string' || rawKey.length < 20 || rawKey.length > 128) {
        return res.status(401).json({ error: 'Invalid API key format' });
      }

      // 2. Hash and lookup
      const keyHash = hashKey(rawKey);
      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: {
          organization: true,
        },
      });

      if (!apiKey) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // 3. Check status
      if (apiKey.status !== 'active') {
        return res.status(403).json({
          error: 'API key has been revoked',
          hint: 'Contact support to reactivate or generate a new key.',
        });
      }

      // 4. Check expiration
      if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
        return res.status(403).json({
          error: 'API key has expired',
          hint: 'Contact support to renew your API key.',
        });
      }

      // 5. Check permissions
      const permissions = Array.isArray(apiKey.permissions) ? apiKey.permissions : [];

      if (requiredPermission && !permissions.includes(requiredPermission)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: requiredPermission,
          yourPermissions: permissions,
        });
      }

      // 6. Rate limiting per API key (rolling window — hourly)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentUsage = await prisma.apiUsageLog.count({
        where: {
          apiKeyId: apiKey.id,
          createdAt: { gte: oneHourAgo },
        },
      });

      const remaining = Math.max(0, apiKey.rateLimit - recentUsage);

      // Set rate limit headers
      res.set('X-RateLimit-Limit', String(apiKey.rateLimit));
      res.set('X-RateLimit-Remaining', String(remaining));
      res.set('X-RateLimit-Reset', new Date(Date.now() + 60 * 60 * 1000).toISOString());

      if (remaining <= 0) {
        return res.status(429).json({
          error: 'API rate limit exceeded',
          limit: apiKey.rateLimit,
          resetAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          hint: 'Upgrade your plan for higher limits.',
        });
      }

      // 7. Attach org info to request
      req.org = {
        id: apiKey.organization.id,
        name: apiKey.organization.name,
        email: apiKey.organization.email,
        plan: apiKey.organization.plan,
        companyName: apiKey.organization.companyName,
      };
      req.permissions = permissions;
      req.apiKeyId = apiKey.id;
      req.apiKeyRateLimit = apiKey.rateLimit;

      // 8. Update last used timestamp (non-blocking)
      prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      }).catch((err) => console.error('Failed to update lastUsedAt:', err.message));

      // 9. Log usage after response completes
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        prisma.apiUsageLog.create({
          data: {
            apiKeyId: apiKey.id,
            endpoint: req.originalUrl.split('?')[0], // Strip query params
            method: req.method,
            statusCode: res.statusCode,
            responseTimeMs: responseTime,
          },
        }).catch((err) => console.error('Failed to log API usage:', err.message));
      });

      next();
    } catch (error) {
      console.error('API Auth error:', error);
      return res.status(500).json({ error: 'Authentication service error' });
    }
  };
}

/**
 * Convenience: check plan level.
 * Use after apiAuth to restrict endpoints by plan.
 */
function requirePlan(minPlans) {
  return (req, res, next) => {
    if (!req.org) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!minPlans.includes(req.org.plan)) {
      return res.status(403).json({
        error: 'Plan upgrade required',
        currentPlan: req.org.plan,
        requiredPlans: minPlans,
        hint: 'Visit /pricing to upgrade your plan.',
      });
    }
    next();
  };
}

module.exports = { apiAuth, requirePlan, hashKey };

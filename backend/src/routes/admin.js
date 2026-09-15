// ==========================================
// Admin Routes — Secure Admin Panel API
// ==========================================
// All routes require admin JWT authentication.
// Destructive actions are logged to AuditLog.
//
// Routes:
//   POST   /api/admin/login           — authenticate, get JWT
//   GET    /api/admin/dashboard        — aggregate stats
//   GET    /api/admin/reviews          — paginated review list (search/filter/sort)
//   DELETE /api/admin/reviews/:id      — delete review + audit log
//   PATCH  /api/admin/reviews/:id/flag — toggle flagged status
//   GET    /api/admin/managers         — all managers with stats
//   DELETE /api/admin/managers/:key    — delete manager + all reviews
//   PATCH  /api/admin/managers/:key    — edit manager name/LinkedIn

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, param, query, validationResult } = require('express-validator');

const prisma = require('../config/database');
const { adminAuth, signAdminToken } = require('../middleware/adminAuth');

// ==========================================
// VALIDATION HELPERS
// ==========================================

/**
 * Handle validation errors — return 400 with structured details.
 */
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

/**
 * Log an admin action to the AuditLog table.
 * Non-blocking — errors are logged but don't break the request.
 */
async function logAudit(adminId, action, targetType, targetId, details) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId,
        action: action,
        targetType: targetType,
        targetId: String(targetId),
        details: details || null,
      },
    });
  } catch (err) {
    console.error('AuditLog write failed:', err.message);
  }
}

// ==========================================
// POST /api/admin/login
// ==========================================
// Public — no JWT required.
// Validates credentials, returns JWT token.

var validateLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Username must be 2-50 characters')
    .isAlphanumeric()
    .withMessage('Username must be alphanumeric'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8-128 characters'),

  handleValidation,
];

router.post('/login', validateLogin, async function (req, res) {
  try {
    var username = req.body.username.trim().toLowerCase();
    var password = req.body.password;

    // 1. Find admin user
    var admin = await prisma.adminUser.findUnique({
      where: { username: username },
    });

    if (!admin) {
      // Constant-time: still run bcrypt compare to prevent timing attacks
      await bcrypt.compare(password, '$2a$12$invalidhashpaddingtopreventsidechannel');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2. Verify password
    var passwordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3. Generate JWT
    var token = signAdminToken({ id: admin.id, username: admin.username });

    // 4. Update last login timestamp (non-blocking)
    prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    }).catch(function (err) {
      console.error('Failed to update lastLoginAt:', err.message);
    });

    // 5. Audit log
    await logAudit(admin.id, 'LOGIN', 'AdminUser', admin.id, 'Successful login');

    res.json({
      success: true,
      token: token,
      admin: {
        id: admin.id,
        username: admin.username,
      },
      expiresIn: '24h',
    });
  } catch (error) {
    console.error('POST /api/admin/login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// ALL ROUTES BELOW REQUIRE ADMIN JWT
// ==========================================
router.use(adminAuth);

// ==========================================
// GET /api/admin/dashboard
// ==========================================
// Returns aggregate stats for the admin dashboard.

router.get('/dashboard', async function (req, res) {
  try {
    // Run all counts in parallel
    var results = await Promise.all([
      // Total reviews
      prisma.review.count(),
      // Total managers
      prisma.manager.count(),
      // Flagged reviews (status = 'flagged' OR flagged = true)
      prisma.review.count({
        where: {
          OR: [
            { status: 'flagged' },
            { flagged: true },
          ],
        },
      }),
      // Distinct companies
      prisma.review.findMany({
        select: { company: true },
        distinct: ['company'],
      }),
      // Average rating
      prisma.rating.aggregate({
        _avg: { score: true },
      }),
      // Recommend percentage
      prisma.review.findMany({
        where: { status: 'published' },
        select: { recommends: true },
      }),
      // Recent reviews (last 7 days)
      prisma.review.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      // Held reviews
      prisma.review.count({ where: { status: 'held' } }),
      // Pending reports
      prisma.report.count({ where: { status: 'pending' } }),
    ]);

    var totalReviews = results[0];
    var totalManagers = results[1];
    var flaggedCount = results[2];
    var companies = results[3];
    var avgRatingResult = results[4];
    var allReviews = results[5];
    var recentCount = results[6];
    var heldCount = results[7];
    var pendingReports = results[8];

    var recommendPct = allReviews.length > 0
      ? Math.round(allReviews.filter(function (r) { return r.recommends; }).length / allReviews.length * 100)
      : 0;

    res.json({
      totalReviews: totalReviews,
      totalManagers: totalManagers,
      flaggedCount: flaggedCount,
      companyCount: companies.length,
      avgRating: avgRatingResult._avg.score
        ? parseFloat(avgRatingResult._avg.score.toFixed(2))
        : 0,
      recommendPct: recommendPct,
      recentReviews7d: recentCount,
      heldCount: heldCount,
      pendingReports: pendingReports,
    });
  } catch (error) {
    console.error('GET /api/admin/dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// GET /api/admin/reviews
// ==========================================
// Paginated review list with search, filter, and sort.
//
// Query params:
//   page     — page number (default 1)
//   limit    — results per page (default 20, max 100)
//   search   — search in pros, cons, company, manager name
//   filter   — all | flagged | recent (last 7d) | held | published
//   sort     — newest | oldest | rating_high | rating_low | most_reported

var validateReviewList = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be 1-100'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query must be under 200 characters'),

  query('filter')
    .optional()
    .isIn(['all', 'flagged', 'recent', 'held', 'published'])
    .withMessage('Filter must be: all, flagged, recent, held, or published'),

  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'rating_high', 'rating_low', 'most_reported'])
    .withMessage('Sort must be: newest, oldest, rating_high, rating_low, or most_reported'),

  handleValidation,
];

router.get('/reviews', validateReviewList, async function (req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    var search = req.query.search || '';
    var filter = req.query.filter || 'all';
    var sort = req.query.sort || 'newest';

    var skip = (page - 1) * limit;

    // Build WHERE clause
    var where = {};

    // Filter
    if (filter === 'flagged') {
      where.OR = [
        { status: 'flagged' },
        { flagged: true },
      ];
    } else if (filter === 'recent') {
      where.createdAt = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    } else if (filter === 'held') {
      where.status = 'held';
    } else if (filter === 'published') {
      where.status = 'published';
    }
    // 'all' — no filter

    // Search
    if (search) {
      var searchConditions = [
        { pros: { contains: search, mode: 'insensitive' } },
        { cons: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { manager: { name: { contains: search, mode: 'insensitive' } } },
      ];

      if (where.OR) {
        // Combine existing OR (from filter) with search using AND
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    // Build ORDER BY
    var orderBy;
    if (sort === 'newest') orderBy = { createdAt: 'desc' };
    else if (sort === 'oldest') orderBy = { createdAt: 'asc' };
    else orderBy = { createdAt: 'desc' }; // default fallback

    // Query reviews
    var reviewsPromise = prisma.review.findMany({
      where: where,
      include: {
        manager: {
          select: { id: true, name: true, linkedinSlug: true },
        },
        ratings: true,
        _count: {
          select: {
            helpfulVotes: true,
            reports: true,
          },
        },
      },
      orderBy: orderBy,
      skip: skip,
      take: limit,
    });

    var countPromise = prisma.review.count({ where: where });

    var resultsArray = await Promise.all([reviewsPromise, countPromise]);
    var reviews = resultsArray[0];
    var totalCount = resultsArray[1];

    // Post-query sort for computed fields
    if (sort === 'rating_high' || sort === 'rating_low') {
      reviews.forEach(function (r) {
        var scores = r.ratings.map(function (rt) { return rt.score; });
        r._computedAvg = scores.length > 0
          ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length
          : 0;
      });
      if (sort === 'rating_high') {
        reviews.sort(function (a, b) { return b._computedAvg - a._computedAvg; });
      } else {
        reviews.sort(function (a, b) { return a._computedAvg - b._computedAvg; });
      }
    } else if (sort === 'most_reported') {
      reviews.sort(function (a, b) { return b._count.reports - a._count.reports; });
    }

    // Format response
    var formattedReviews = reviews.map(function (r) {
      var scores = r.ratings.map(function (rt) { return rt.score; });
      var avgRating = scores.length > 0
        ? parseFloat((scores.reduce(function (a, b) { return a + b; }, 0) / scores.length).toFixed(2))
        : 0;

      return {
        id: r.id,
        managerName: r.manager.name,
        managerId: r.manager.id,
        managerSlug: r.manager.linkedinSlug,
        company: r.company,
        status: r.status,
        flagged: r.flagged || false,
        recommends: r.recommends,
        pros: r.pros,
        cons: r.cons,
        advice: r.advice,
        avgRating: avgRating,
        ratings: Object.fromEntries(r.ratings.map(function (rt) { return [rt.category, rt.score]; })),
        helpfulCount: r._count.helpfulVotes,
        reportCount: r._count.reports,
        tenure: r.tenure,
        relationship: r.relationship,
        currentEmployee: r.currentEmployee,
        verificationStatus: r.verificationStatus,
        strengths: r.strengths,
        weaknesses: r.weaknesses,
        createdAt: r.createdAt,
      };
    });

    res.json({
      reviews: formattedReviews,
      pagination: {
        page: page,
        limit: limit,
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// DELETE /api/admin/reviews/:id
// ==========================================
// Hard-delete a review. Logged to AuditLog.

var validateReviewId = [
  param('id').isUUID().withMessage('Invalid review ID format'),
  handleValidation,
];

router.delete('/reviews/:id', validateReviewId, async function (req, res) {
  try {
    var reviewId = req.params.id;

    // Verify review exists
    var review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        manager: { select: { name: true } },
      },
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Capture details before deletion for audit log
    var auditDetails = JSON.stringify({
      managerId: review.managerId,
      managerName: review.manager.name,
      company: review.company,
      status: review.status,
      createdAt: review.createdAt,
    });

    // Delete review (cascades to ratings, helpful votes, reports, etc.)
    await prisma.review.delete({
      where: { id: reviewId },
    });

    // Audit log
    await logAudit(
      req.admin.id,
      'DELETE_REVIEW',
      'Review',
      reviewId,
      auditDetails
    );

    res.json({
      success: true,
      message: 'Review deleted successfully',
      deletedId: reviewId,
    });
  } catch (error) {
    console.error('DELETE /api/admin/reviews/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// PATCH /api/admin/reviews/:id/flag
// ==========================================
// Toggle the flagged boolean on a review.

router.patch('/reviews/:id/flag', validateReviewId, async function (req, res) {
  try {
    var reviewId = req.params.id;

    // Get current state
    var review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, flagged: true, status: true },
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    var newFlagged = !review.flagged;

    // Update flagged status and review status
    var updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        flagged: newFlagged,
        status: newFlagged ? 'flagged' : 'published',
      },
    });

    // Audit log
    await logAudit(
      req.admin.id,
      newFlagged ? 'FLAG_REVIEW' : 'UNFLAG_REVIEW',
      'Review',
      reviewId,
      JSON.stringify({ previousStatus: review.status, newFlagged: newFlagged })
    );

    res.json({
      success: true,
      reviewId: reviewId,
      flagged: updatedReview.flagged,
      status: updatedReview.status,
    });
  } catch (error) {
    console.error('PATCH /api/admin/reviews/:id/flag error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// GET /api/admin/managers
// ==========================================
// List all managers with review stats.

var validateManagerList = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be 1-100'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query must be under 200 characters'),

  handleValidation,
];

router.get('/managers', validateManagerList, async function (req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    var search = req.query.search || '';

    var skip = (page - 1) * limit;

    var where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { linkedinSlug: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
      ];
    }

    var managersPromise = prisma.manager.findMany({
      where: where,
      include: {
        reviews: {
          include: { ratings: true },
        },
        _count: {
          select: { reviews: true, responses: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: limit,
    });

    var countPromise = prisma.manager.count({ where: where });

    var resultsArray = await Promise.all([managersPromise, countPromise]);
    var managers = resultsArray[0];
    var totalCount = resultsArray[1];

    var formattedManagers = managers.map(function (m) {
      // Calculate average rating across all reviews
      var allRatings = m.reviews.flatMap(function (r) { return r.ratings; });
      var avgRating = allRatings.length > 0
        ? parseFloat((allRatings.reduce(function (s, r) { return s + r.score; }, 0) / allRatings.length).toFixed(2))
        : 0;

      // Recommend percentage
      var recommendPct = m.reviews.length > 0
        ? Math.round(m.reviews.filter(function (r) { return r.recommends; }).length / m.reviews.length * 100)
        : 0;

      // Flagged review count
      var flaggedCount = m.reviews.filter(function (r) {
        return r.status === 'flagged' || r.flagged;
      }).length;

      // Distinct companies
      var companySet = {};
      m.reviews.forEach(function (r) { companySet[r.company] = 1; });

      return {
        id: m.id,
        name: m.name,
        linkedinUrl: m.linkedinUrl,
        linkedinSlug: m.linkedinSlug,
        city: m.city,
        department: m.department,
        title: m.title,
        reviewCount: m._count.reviews,
        responseCount: m._count.responses,
        avgRating: avgRating,
        recommendPct: recommendPct,
        flaggedReviews: flaggedCount,
        companies: Object.keys(companySet),
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      };
    });

    res.json({
      managers: formattedManagers,
      pagination: {
        page: page,
        limit: limit,
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/managers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// DELETE /api/admin/managers/:key
// ==========================================
// Delete a manager and ALL their reviews.
// :key can be a UUID (id) or a LinkedIn slug.
// Cascading delete handled by Prisma schema (onDelete: Cascade).

var validateManagerKey = [
  param('key')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Manager key is required')
    .matches(/^[a-zA-Z0-9\-]+$/)
    .withMessage('Invalid manager key format'),

  handleValidation,
];

router.delete('/managers/:key', validateManagerKey, async function (req, res) {
  try {
    var key = req.params.key;

    // Look up by UUID first, then by slug
    var manager;
    var isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

    if (isUuid) {
      manager = await prisma.manager.findUnique({
        where: { id: key },
        include: { _count: { select: { reviews: true } } },
      });
    } else {
      manager = await prisma.manager.findUnique({
        where: { linkedinSlug: key },
        include: { _count: { select: { reviews: true } } },
      });
    }

    if (!manager) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    // Capture details before deletion
    var auditDetails = JSON.stringify({
      name: manager.name,
      linkedinSlug: manager.linkedinSlug,
      reviewCount: manager._count.reviews,
    });

    // Delete manager (cascades to all reviews, ratings, votes, reports, responses, evolutions)
    await prisma.manager.delete({
      where: { id: manager.id },
    });

    // Audit log
    await logAudit(
      req.admin.id,
      'DELETE_MANAGER',
      'Manager',
      manager.id,
      auditDetails
    );

    res.json({
      success: true,
      message: 'Manager and all associated reviews deleted',
      deletedManager: {
        id: manager.id,
        name: manager.name,
        reviewsDeleted: manager._count.reviews,
      },
    });
  } catch (error) {
    console.error('DELETE /api/admin/managers/:key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// PATCH /api/admin/managers/:key
// ==========================================
// Edit manager name and/or LinkedIn URL.

var validateManagerEdit = [
  param('key')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Manager key is required')
    .matches(/^[a-zA-Z0-9\-]+$/)
    .withMessage('Invalid manager key format'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Name must be 2-200 characters')
    .matches(/^[\p{L}\p{M}\s'\-\.]{2,200}$/u)
    .withMessage('Name contains invalid characters'),

  body('linkedinUrl')
    .optional()
    .trim()
    .matches(/^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-]{3,100}\/?$/)
    .withMessage('Invalid LinkedIn URL format'),

  handleValidation,
];

router.patch('/managers/:key', validateManagerEdit, async function (req, res) {
  try {
    var key = req.params.key;

    // Look up manager
    var manager;
    var isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

    if (isUuid) {
      manager = await prisma.manager.findUnique({ where: { id: key } });
    } else {
      manager = await prisma.manager.findUnique({ where: { linkedinSlug: key } });
    }

    if (!manager) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    // Build update payload
    var updateData = {};
    var changes = {};

    if (req.body.name && req.body.name !== manager.name) {
      changes.name = { from: manager.name, to: req.body.name };
      updateData.name = req.body.name;
    }

    if (req.body.linkedinUrl && req.body.linkedinUrl !== manager.linkedinUrl) {
      // Extract slug from new LinkedIn URL
      var urlMatch = req.body.linkedinUrl.match(/linkedin\.com\/in\/([a-zA-Z0-9\-]+)/);
      var newSlug = urlMatch ? urlMatch[1].toLowerCase() : null;

      if (!newSlug) {
        return res.status(400).json({ error: 'Could not extract LinkedIn slug from URL' });
      }

      // Check for slug conflicts
      var existingSlug = await prisma.manager.findUnique({
        where: { linkedinSlug: newSlug },
      });
      if (existingSlug && existingSlug.id !== manager.id) {
        return res.status(409).json({ error: 'A manager with this LinkedIn profile already exists' });
      }

      changes.linkedinUrl = { from: manager.linkedinUrl, to: req.body.linkedinUrl };
      changes.linkedinSlug = { from: manager.linkedinSlug, to: newSlug };
      updateData.linkedinUrl = req.body.linkedinUrl.replace(/\/$/, ''); // trim trailing slash
      updateData.linkedinSlug = newSlug;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No changes provided' });
    }

    // Apply update
    var updatedManager = await prisma.manager.update({
      where: { id: manager.id },
      data: updateData,
    });

    // Audit log
    await logAudit(
      req.admin.id,
      'EDIT_MANAGER',
      'Manager',
      manager.id,
      JSON.stringify(changes)
    );

    res.json({
      success: true,
      manager: {
        id: updatedManager.id,
        name: updatedManager.name,
        linkedinUrl: updatedManager.linkedinUrl,
        linkedinSlug: updatedManager.linkedinSlug,
      },
      changes: changes,
    });
  } catch (error) {
    console.error('PATCH /api/admin/managers/:key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

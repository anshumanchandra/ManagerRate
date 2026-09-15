// ==========================================
// Search Routes — Manager Search Engine
// ==========================================
// GET /api/search          — Full-text search with filters
// GET /api/search/suggestions — Autocomplete suggestions

const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { query, validationResult } = require('express-validator');
const { CATEGORIES } = require('../config/categories');
const {
  bayesianScore, confidenceLevel, recentScore,
  categoryAverages, simpleAverage, recommendPercent,
} = require('../utils/scoring');

// Validation middleware
function handleValidation(req, res, next) {
  var errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(function (e) { return { field: e.path, message: e.msg }; }),
    });
  }
  next();
}

var validateSearch = [
  query('q').optional().trim().isLength({ max: 200 }).withMessage('Search query too long'),
  query('city').optional().trim().isLength({ max: 200 }),
  query('department').optional().trim().isLength({ max: 200 }),
  query('company').optional().trim().isLength({ max: 200 }),
  query('minRating').optional().isFloat({ min: 0, max: 5 }),
  query('minReviews').optional().isInt({ min: 0 }),
  query('sort').optional().isIn(['relevance', 'rating_desc', 'rating_asc', 'reviews_desc', 'newest']),
  query('cursor').optional().isUUID(),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  handleValidation,
];

/**
 * GET /api/search
 * Full-text search across managers, companies, cities, departments.
 * Supports filtering, sorting, and cursor-based pagination.
 */
router.get('/', validateSearch, async function (req, res) {
  try {
    var q = req.query.q || '';
    var city = req.query.city || '';
    var department = req.query.department || '';
    var company = req.query.company || '';
    var minRating = parseFloat(req.query.minRating) || 0;
    var minReviews = parseInt(req.query.minReviews, 10) || 0;
    var sort = req.query.sort || 'relevance';
    var cursor = req.query.cursor || null;
    var limit = parseInt(req.query.limit, 10) || 20;

    // Build Prisma where clause
    var where = {
      reviews: { some: { status: 'published' } },
    };

    // Full-text search
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { reviews: { some: { company: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    // Filters
    if (company) {
      where.reviews = {
        some: {
          status: 'published',
          company: { contains: company, mode: 'insensitive' },
        },
      };
    }

    // Cursor-based pagination
    var findArgs = {
      where: where,
      include: {
        reviews: {
          where: { status: 'published' },
          include: { ratings: true },
        },
      },
      take: limit + 1, // +1 to check if more exist
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip = 1; // skip the cursor itself
    }

    // Ordering
    if (sort === 'newest') {
      findArgs.orderBy = { createdAt: 'desc' };
    } else {
      findArgs.orderBy = { name: 'asc' }; // default, we re-sort in memory for rating-based
    }

    var managers = await prisma.manager.findMany(findArgs);

    var hasMore = managers.length > limit;
    var results = managers.slice(0, limit);

    // Compute global average for Bayesian scoring
    var globalRatings = await prisma.rating.aggregate({
      where: { review: { status: 'published' } },
      _avg: { score: true },
    });
    var globalAvg = (globalRatings._avg && globalRatings._avg.score) || 3.0;

    // Enrich results
    var enriched = results
      .map(function (m, idx) {
        var reviewCount = m.reviews.length;
        var avg = simpleAverage(m.reviews);
        var bayesian = bayesianScore(avg, reviewCount, globalAvg);
        var companies = [];
        var companySet = {};
        m.reviews.forEach(function (r) { if (!companySet[r.company]) { companySet[r.company] = 1; companies.push(r.company); } });

        // Compute top strengths from category scores
        var catAvgs = categoryAverages(m.reviews);
        var topStrengths = Object.entries(catAvgs)
          .sort(function (a, b) { return b[1] - a[1]; })
          .slice(0, 3)
          .map(function (e) { return { category: e[0], score: e[1] }; });

        return {
          id: m.id,
          name: m.name,
          linkedinUrl: m.linkedinUrl,
          linkedinSlug: m.linkedinSlug,
          companies: companies,
          reviewCount: reviewCount,
          avgRating: avg,
          bayesianScore: bayesian,
          recommendPct: recommendPercent(m.reviews),
          confidenceLevel: confidenceLevel(reviewCount),
          topStrengths: topStrengths,
          recentScore: recentScore(m.reviews),
          createdAt: m.createdAt,
        };
      })
      // Post-filter by minRating and minReviews
      .filter(function (m) {
        if (minRating && m.bayesianScore < minRating) return false;
        if (minReviews && m.reviewCount < minReviews) return false;
        return true;
      });

    // Sort
    if (sort === 'rating_desc') {
      enriched.sort(function (a, b) { return b.bayesianScore - a.bayesianScore; });
    } else if (sort === 'rating_asc') {
      enriched.sort(function (a, b) { return a.bayesianScore - b.bayesianScore; });
    } else if (sort === 'reviews_desc') {
      enriched.sort(function (a, b) { return b.reviewCount - a.reviewCount; });
    }
    // 'relevance' and 'newest' keep their DB order

    var nextCursor = hasMore && results.length > 0 ? results[results.length - 1].id : null;

    res.json({
      results: enriched,
      count: enriched.length,
      pagination: {
        nextCursor: nextCursor,
        hasMore: hasMore,
        limit: limit,
      },
    });
  } catch (error) {
    console.error('GET /api/search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/search/suggestions
 * Autocomplete — returns top 5 manager names + top 5 companies matching partial query.
 */
router.get('/suggestions', [
  query('q').trim().isLength({ min: 1, max: 100 }).withMessage('Query required (1-100 chars)'),
  handleValidation,
], async function (req, res) {
  try {
    var q = req.query.q;

    // Manager name suggestions
    var managerResults = await prisma.manager.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' },
        reviews: { some: { status: 'published' } },
      },
      select: { id: true, name: true, linkedinSlug: true },
      take: 5,
      orderBy: { name: 'asc' },
    });

    // Company suggestions
    var companyResults = await prisma.review.findMany({
      where: {
        company: { contains: q, mode: 'insensitive' },
        status: 'published',
      },
      select: { company: true },
      distinct: ['company'],
      take: 5,
      orderBy: { company: 'asc' },
    });

    res.json({
      managers: managerResults.map(function (m) {
        return { id: m.id, name: m.name, slug: m.linkedinSlug };
      }),
      companies: companyResults.map(function (r) { return r.company; }),
    });
  } catch (error) {
    console.error('GET /api/search/suggestions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

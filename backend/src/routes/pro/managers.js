// ==========================================
// Pro API — Enhanced Manager Routes
// ==========================================

const express = require('express');
const router = express.Router();
const { query, param, body } = require('express-validator');
const prisma = require('../../config/database');
const { CATEGORIES } = require('../../config/categories');
const { apiAuth, requirePlan } = require('../../middleware/apiAuth');
const { handleValidationErrors } = require('../../middleware/validate');

// All routes require managers:read permission
router.use(apiAuth('managers:read'));

// ——— Shared constants ———————————————————————————————————————
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_SORTS = ['rating_desc', 'rating_asc', 'reviews_desc', 'newest'];

/**
 * GET /api/pro/managers
 * Enhanced manager search with advanced filters.
 *
 * Query params:
 *   q            — search name
 *   companies    — comma-separated company filter (e.g., "Google,AWS")
 *   minRating    — minimum average rating
 *   maxRating    — maximum average rating
 *   minReviews   — minimum review count
 *   dateFrom     — reviews after this date (ISO)
 *   dateTo       — reviews before this date (ISO)
 *   sort         — rating_desc, rating_asc, reviews_desc, newest
 *   page, limit  — pagination
 */
router.get('/',
  [
    query('q')
      .optional()
      .trim()
      .escape()
      .isLength({ max: 200 }).withMessage('Search query must be 200 characters or fewer'),
    query('companies')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('Companies list too long'),
    query('minRating')
      .optional()
      .isFloat({ min: 1, max: 5 }).withMessage('minRating must be a number between 1 and 5')
      .toFloat(),
    query('maxRating')
      .optional()
      .isFloat({ min: 1, max: 5 }).withMessage('maxRating must be a number between 1 and 5')
      .toFloat(),
    query('minReviews')
      .optional()
      .isInt({ min: 0 }).withMessage('minReviews must be a non-negative integer')
      .toInt(),
    query('dateFrom')
      .optional()
      .trim()
      .isISO8601().withMessage('dateFrom must be a valid ISO 8601 date'),
    query('dateTo')
      .optional()
      .trim()
      .isISO8601().withMessage('dateTo must be a valid ISO 8601 date'),
    query('sort')
      .optional()
      .trim()
      .isIn(ALLOWED_SORTS)
      .withMessage(`sort must be one of: ${ALLOWED_SORTS.join(', ')}`),
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('page must be an integer >= 1')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('limit must be an integer between 1 and 100')
      .toInt(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const {
        q, companies, minRating, maxRating, minReviews,
        dateFrom, dateTo,
        sort = 'rating_desc', page = 1, limit = 20,
      } = req.query;

      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const take = Math.min(parseInt(limit, 10), 50); // Cap at 50

      // Build where clause
      const where = {
        reviews: { some: { status: 'published' } },
      };

      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { linkedinSlug: { contains: q.toLowerCase() } },
        ];
      }

      // Multi-company filter
      if (companies) {
        const companyList = companies.split(',').map(c => c.trim()).filter(Boolean);
        if (companyList.length > 0) {
          where.reviews = {
            some: {
              status: 'published',
              company: { in: companyList, mode: 'insensitive' },
            },
          };
        }
      }

      // Date range filter
      if (dateFrom || dateTo) {
        const dateFilter = {};
        if (dateFrom) dateFilter.gte = new Date(dateFrom);
        if (dateTo) dateFilter.lte = new Date(dateTo);
        where.reviews = {
          ...where.reviews,
          some: {
            ...(where.reviews?.some || {}),
            createdAt: dateFilter,
          },
        };
      }

      const managers = await prisma.manager.findMany({
        where,
        include: {
          reviews: {
            where: { status: 'published' },
            include: { ratings: true },
          },
        },
        skip,
        take: take + 1,
      });

      const hasMore = managers.length > take;
      const results = managers.slice(0, take);

      // Enrich with stats
      let enriched = results.map(m => {
        const allRatings = m.reviews.flatMap(r => r.ratings);
        const avgRating = allRatings.length > 0
          ? allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length
          : 0;
        const recommendPct = m.reviews.length > 0
          ? Math.round(m.reviews.filter(r => r.recommends).length / m.reviews.length * 100)
          : 0;
        const companies = [...new Set(m.reviews.map(r => r.company))];

        const categoryAvgs = {};
        CATEGORIES.forEach(cat => {
          const scores = allRatings.filter(r => r.category === cat).map(r => r.score);
          categoryAvgs[cat] = scores.length > 0
            ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
            : 0;
        });

        return {
          id: m.id,
          name: m.name,
          linkedinUrl: m.linkedinUrl,
          linkedinSlug: m.linkedinSlug,
          companies,
          reviewCount: m.reviews.length,
          avgRating: parseFloat(avgRating.toFixed(2)),
          recommendPct,
          categoryAvgs,
        };
      });

      // Post-aggregation filters
      if (minRating) enriched = enriched.filter(m => m.avgRating >= parseFloat(minRating));
      if (maxRating) enriched = enriched.filter(m => m.avgRating <= parseFloat(maxRating));
      if (minReviews) enriched = enriched.filter(m => m.reviewCount >= parseInt(minReviews, 10));

      // Sort
      switch (sort) {
        case 'rating_asc':   enriched.sort((a, b) => a.avgRating - b.avgRating); break;
        case 'reviews_desc': enriched.sort((a, b) => b.reviewCount - a.reviewCount); break;
        case 'newest':       break; // Already in DB order
        default:             enriched.sort((a, b) => b.avgRating - a.avgRating);
      }

      res.json({
        managers: enriched,
        pagination: { page: parseInt(page, 10), limit: take, hasMore },
        filters: { q, companies, minRating, maxRating, minReviews, dateFrom, dateTo, sort },
      });
    } catch (error) {
      console.error('Pro GET /managers error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/pro/managers/:id/full
 * Full detailed manager profile with trends and stats.
 */
router.get('/:id/full',
  [
    param('id')
      .trim()
      .matches(UUID_REGEX).withMessage('Manager ID must be a valid UUID'),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const manager = await prisma.manager.findUnique({
        where: { id: req.params.id },
        include: {
          reviews: {
            where: { status: 'published' },
            include: {
              ratings: true,
              _count: { select: { helpfulVotes: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!manager) {
        return res.status(404).json({ error: 'Manager not found' });
      }

      const allRatings = manager.reviews.flatMap(r => r.ratings);

      // Overall stats
      const avgRating = allRatings.length > 0
        ? parseFloat((allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length).toFixed(2))
        : 0;
      const recommendPct = manager.reviews.length > 0
        ? Math.round(manager.reviews.filter(r => r.recommends).length / manager.reviews.length * 100)
        : 0;

      // Category averages
      const categoryAvgs = {};
      CATEGORIES.forEach(cat => {
        const scores = allRatings.filter(r => r.category === cat).map(r => r.score);
        categoryAvgs[cat] = scores.length > 0
          ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
          : 0;
      });

      // Strengths & improvement areas
      const sorted = Object.entries(categoryAvgs).sort((a, b) => b[1] - a[1]);
      const strengths = sorted.slice(0, 3).map(([cat, score]) => ({ category: cat, score }));
      const improvementAreas = sorted.slice(-3).reverse().map(([cat, score]) => ({ category: cat, score }));

      // Reviews by company
      const reviewsByCompany = {};
      manager.reviews.forEach(r => {
        if (!reviewsByCompany[r.company]) reviewsByCompany[r.company] = [];
        reviewsByCompany[r.company].push({
          id: r.id,
          recommends: r.recommends,
          pros: r.pros,
          cons: r.cons,
          advice: r.advice,
          ratings: Object.fromEntries(r.ratings.map(rt => [rt.category, rt.score])),
          helpfulCount: r._count.helpfulVotes,
          createdAt: r.createdAt,
        });
      });

      // Monthly trend (last 12 months)
      const monthlyTrend = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        const monthReviews = manager.reviews.filter(r => {
          const rd = new Date(r.createdAt);
          return rd >= monthStart && rd <= monthEnd;
        });
        const monthRatings = monthReviews.flatMap(r => r.ratings);
        const monthAvg = monthRatings.length > 0
          ? parseFloat((monthRatings.reduce((s, r) => s + r.score, 0) / monthRatings.length).toFixed(2))
          : null;

        monthlyTrend.push({
          month: monthStart.toISOString().slice(0, 7),
          avgRating: monthAvg,
          reviewCount: monthReviews.length,
          recommendPct: monthReviews.length > 0
            ? Math.round(monthReviews.filter(r => r.recommends).length / monthReviews.length * 100)
            : null,
        });
      }

      // Trend direction
      const recentMonths = monthlyTrend.filter(m => m.avgRating !== null).slice(-3);
      let trendDirection = 'stable';
      if (recentMonths.length >= 2) {
        const first = recentMonths[0].avgRating;
        const last = recentMonths[recentMonths.length - 1].avgRating;
        if (last - first > 0.3) trendDirection = 'improving';
        else if (first - last > 0.3) trendDirection = 'declining';
      }

      res.json({
        id: manager.id,
        name: manager.name,
        linkedinUrl: manager.linkedinUrl,
        linkedinSlug: manager.linkedinSlug,
        companies: Object.keys(reviewsByCompany),
        reviewCount: manager.reviews.length,
        avgRating,
        recommendPct,
        categoryAvgs,
        strengths,
        improvementAreas,
        trendDirection,
        monthlyTrend,
        reviewsByCompany,
      });
    } catch (error) {
      console.error('Pro GET /managers/:id/full error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/pro/managers/compare
 * Compare 2-5 managers side by side.
 * Query: ids=uuid1,uuid2,uuid3
 */
router.get('/compare',
  [
    query('ids')
      .exists({ checkFalsy: true }).withMessage('ids query parameter required (comma-separated UUIDs)')
      .trim()
      .custom((value) => {
        const idList = value.split(',').map(id => id.trim()).filter(Boolean);
        if (idList.length < 2 || idList.length > 5) {
          throw new Error('Provide 2-5 manager IDs to compare');
        }
        for (const id of idList) {
          if (!UUID_REGEX.test(id)) {
            throw new Error(`Invalid UUID format: ${id}`);
          }
        }
        return true;
      }),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const idList = req.query.ids.split(',').map(id => id.trim()).filter(Boolean);

      const managers = await prisma.manager.findMany({
        where: { id: { in: idList } },
        include: {
          reviews: {
            where: { status: 'published' },
            include: { ratings: true },
          },
        },
      });

      if (managers.length < 2) {
        return res.status(404).json({ error: 'At least 2 valid managers required for comparison' });
      }

      const comparison = managers.map(m => {
        const allRatings = m.reviews.flatMap(r => r.ratings);
        const avgRating = allRatings.length > 0
          ? parseFloat((allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length).toFixed(2))
          : 0;

        const categoryAvgs = {};
        CATEGORIES.forEach(cat => {
          const scores = allRatings.filter(r => r.category === cat).map(r => r.score);
          categoryAvgs[cat] = scores.length > 0
            ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
            : 0;
        });

        return {
          id: m.id,
          name: m.name,
          linkedinSlug: m.linkedinSlug,
          companies: [...new Set(m.reviews.map(r => r.company))],
          reviewCount: m.reviews.length,
          avgRating,
          recommendPct: m.reviews.length > 0
            ? Math.round(m.reviews.filter(r => r.recommends).length / m.reviews.length * 100)
            : 0,
          categoryAvgs,
        };
      });

      // Compute "winner" per category
      const categoryWinners = {};
      CATEGORIES.forEach(cat => {
        const best = comparison.reduce((a, b) =>
          (b.categoryAvgs[cat] || 0) > (a.categoryAvgs[cat] || 0) ? b : a
        );
        categoryWinners[cat] = { managerId: best.id, managerName: best.name, score: best.categoryAvgs[cat] };
      });

      res.json({
        managers: comparison,
        categoryWinners,
        overallBest: comparison.reduce((a, b) => b.avgRating > a.avgRating ? b : a),
      });
    } catch (error) {
      console.error('Pro GET /managers/compare error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/pro/managers/search/bulk
 * Search multiple managers by LinkedIn slugs.
 * Body: { slugs: ["slug1", "slug2", ...] }  (max 50)
 */
router.post('/search/bulk',
  requirePlan(['growth', 'enterprise']),
  [
    body('slugs')
      .exists({ checkFalsy: true }).withMessage('slugs array required in request body')
      .isArray({ min: 1, max: 50 }).withMessage('slugs must be an array with 1-50 items'),
    body('slugs.*')
      .isString().withMessage('Each slug must be a string')
      .trim()
      .isLength({ min: 1, max: 200 }).withMessage('Each slug must be 1-200 characters')
      .matches(/^[a-zA-Z0-9\-]+$/).withMessage('Slugs may only contain alphanumeric characters and hyphens'),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { slugs } = req.body;

      const normalizedSlugs = slugs.map(s =>
        typeof s === 'string' ? s.toLowerCase().replace(/[^a-z0-9\-]/g, '') : ''
      ).filter(Boolean);

      const managers = await prisma.manager.findMany({
        where: { linkedinSlug: { in: normalizedSlugs } },
        include: {
          reviews: {
            where: { status: 'published' },
            include: { ratings: true },
          },
        },
      });

      const results = managers.map(m => {
        const allRatings = m.reviews.flatMap(r => r.ratings);
        const avgRating = allRatings.length > 0
          ? parseFloat((allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length).toFixed(2))
          : 0;

        return {
          id: m.id,
          name: m.name,
          linkedinSlug: m.linkedinSlug,
          companies: [...new Set(m.reviews.map(r => r.company))],
          reviewCount: m.reviews.length,
          avgRating,
          recommendPct: m.reviews.length > 0
            ? Math.round(m.reviews.filter(r => r.recommends).length / m.reviews.length * 100)
            : 0,
        };
      });

      // Report which slugs were not found
      const foundSlugs = new Set(results.map(r => r.linkedinSlug));
      const notFound = normalizedSlugs.filter(s => !foundSlugs.has(s));

      res.json({
        found: results,
        notFound,
        total: results.length,
        searched: normalizedSlugs.length,
      });
    } catch (error) {
      console.error('Pro POST /managers/search/bulk error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;

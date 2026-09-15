// ==========================================
// Pro Dashboard Routes — /api/pro/dashboard
// ==========================================
// Company-specific dashboard for organizations.
// All endpoints filter data by the authenticated org's company name.
// Requires API key with "dashboard:read" permission.

const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const prisma = require('../../config/database');
const { CATEGORIES } = require('../../config/categories');
const { handleValidationErrors } = require('../../middleware/validate');

// ——— Helper: get company name from authenticated org ————————
function getCompanyName(req) {
  // req.org is set by apiAuth middleware
  if (!req.org || !req.org.companyName) {
    return null;
  }
  return req.org.companyName;
}

// ——— Helper: compute average from scores array ——————————————
function avg(scores) {
  if (!scores.length) return 0;
  return parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
}

// ——— Helper: determine trend direction ——————————————————————
// Returns "up", "down", or "stable" based on last 3+ data points
function trendDirection(values) {
  if (values.length < 3) return 'stable';
  const recent = values.slice(-3);
  const diffs = [];
  for (let i = 1; i < recent.length; i++) {
    diffs.push(recent[i] - recent[i - 1]);
  }
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  if (avgDiff > 0.1) return 'up';
  if (avgDiff < -0.1) return 'down';
  return 'stable';
}

// ——— Helper: get monthly buckets for last N months ——————————
function getMonthBuckets(months) {
  const buckets = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
    });
  }
  return buckets;
}

// ——— Shared validation: sort parameter ——————————————————————
const ALLOWED_SORTS = ['rating_desc', 'rating_asc', 'reviews_desc', 'newest'];

/**
 * GET /api/pro/dashboard/overview
 * Company-wide overview with KPIs.
 */
router.get('/overview', async (req, res) => {
  try {
    const company = getCompanyName(req);
    if (!company) {
      return res.status(400).json({ error: 'Organization company name not configured' });
    }

    // All published reviews for this company
    const reviews = await prisma.review.findMany({
      where: { company: { equals: company, mode: 'insensitive' }, status: 'published' },
      include: {
        ratings: true,
        manager: { select: { id: true, name: true, linkedinSlug: true } },
      },
    });

    if (!reviews.length) {
      return res.json({
        company,
        totalManagers: 0,
        totalReviews: 0,
        avgRating: 0,
        recommendPct: 0,
        topManagers: [],
        lowestManagers: [],
        categoryAvgs: Object.fromEntries(CATEGORIES.map(c => [c, 0])),
      });
    }

    // Unique managers
    const managerMap = {};
    reviews.forEach(r => {
      if (!managerMap[r.managerId]) {
        managerMap[r.managerId] = {
          id: r.managerId,
          name: r.manager.name,
          linkedinSlug: r.manager.linkedinSlug,
          ratings: [],
          recommends: [],
        };
      }
      const allScores = r.ratings.map(rt => rt.score);
      const reviewAvg = avg(allScores);
      managerMap[r.managerId].ratings.push(reviewAvg);
      managerMap[r.managerId].recommends.push(r.recommends);
    });

    const managers = Object.values(managerMap).map(m => ({
      id: m.id,
      name: m.name,
      linkedinSlug: m.linkedinSlug,
      avgRating: avg(m.ratings),
      reviewCount: m.ratings.length,
      recommendPct: m.recommends.length > 0
        ? Math.round(m.recommends.filter(Boolean).length / m.recommends.length * 100)
        : 0,
    }));

    // Sort for top & lowest
    const sorted = [...managers].sort((a, b) => b.avgRating - a.avgRating);
    const topManagers = sorted.slice(0, 5);
    const lowestManagers = sorted.length > 5 ? sorted.slice(-3).reverse() : [];

    // Overall stats
    const allRatings = reviews.flatMap(r => r.ratings.map(rt => rt.score));
    const overallAvg = avg(allRatings);
    const recommendPct = Math.round(
      reviews.filter(r => r.recommends).length / reviews.length * 100
    );

    // Category averages
    const categoryAvgs = {};
    CATEGORIES.forEach(cat => {
      const scores = reviews.flatMap(r =>
        r.ratings.filter(rt => rt.category === cat).map(rt => rt.score)
      );
      categoryAvgs[cat] = avg(scores);
    });

    res.json({
      company,
      totalManagers: managers.length,
      totalReviews: reviews.length,
      avgRating: overallAvg,
      recommendPct,
      topManagers,
      lowestManagers,
      categoryAvgs,
    });
  } catch (error) {
    console.error('GET /api/pro/dashboard/overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/pro/dashboard/managers
 * List all managers reviewed at this company with stats.
 */
router.get('/managers',
  [
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
      const company = getCompanyName(req);
      if (!company) {
        return res.status(400).json({ error: 'Organization company name not configured' });
      }

      const { sort = 'rating_desc' } = req.query;

      const reviews = await prisma.review.findMany({
        where: { company: { equals: company, mode: 'insensitive' }, status: 'published' },
        include: {
          ratings: true,
          manager: { select: { id: true, name: true, linkedinUrl: true, linkedinSlug: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Group by manager
      const managerMap = {};
      reviews.forEach(r => {
        if (!managerMap[r.managerId]) {
          managerMap[r.managerId] = {
            id: r.managerId,
            name: r.manager.name,
            linkedinUrl: r.manager.linkedinUrl,
            linkedinSlug: r.manager.linkedinSlug,
            reviews: [],
          };
        }
        managerMap[r.managerId].reviews.push(r);
      });

      // Build monthly data for trend per manager
      const buckets = getMonthBuckets(6);

      const managers = Object.values(managerMap).map(m => {
        const allScores = m.reviews.flatMap(r => r.ratings.map(rt => rt.score));
        const avgRating = avg(allScores);
        const recommendPct = m.reviews.length > 0
          ? Math.round(m.reviews.filter(r => r.recommends).length / m.reviews.length * 100)
          : 0;

        // Per-month averages for trend
        const monthlyAvgs = buckets.map(b => {
          const monthReviews = m.reviews.filter(r => {
            const d = new Date(r.createdAt);
            return d >= b.start && d <= b.end;
          });
          const scores = monthReviews.flatMap(r => r.ratings.map(rt => rt.score));
          return scores.length > 0 ? avg(scores) : null;
        }).filter(v => v !== null);

        const trend = trendDirection(monthlyAvgs);
        const latestReviewDate = m.reviews.length > 0
          ? m.reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt
          : null;

        // Category averages for this manager at this company
        const categoryAvgs = {};
        CATEGORIES.forEach(cat => {
          const scores = m.reviews.flatMap(r =>
            r.ratings.filter(rt => rt.category === cat).map(rt => rt.score)
          );
          categoryAvgs[cat] = avg(scores);
        });

        return {
          id: m.id,
          name: m.name,
          linkedinUrl: m.linkedinUrl,
          linkedinSlug: m.linkedinSlug,
          avgRating,
          reviewCount: m.reviews.length,
          recommendPct,
          trend,
          latestReviewDate,
          categoryAvgs,
        };
      });

      // Sort
      switch (sort) {
        case 'rating_asc': managers.sort((a, b) => a.avgRating - b.avgRating); break;
        case 'reviews_desc': managers.sort((a, b) => b.reviewCount - a.reviewCount); break;
        case 'newest': managers.sort((a, b) => new Date(b.latestReviewDate || 0) - new Date(a.latestReviewDate || 0)); break;
        case 'rating_desc':
        default: managers.sort((a, b) => b.avgRating - a.avgRating); break;
      }

      res.json({ company, managers, total: managers.length });
    } catch (error) {
      console.error('GET /api/pro/dashboard/managers error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/pro/dashboard/trends
 * Monthly trends for the last 12 months.
 */
router.get('/trends',
  [
    query('months')
      .optional()
      .isInt({ min: 1, max: 24 }).withMessage('months must be an integer between 1 and 24')
      .toInt(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const company = getCompanyName(req);
      if (!company) {
        return res.status(400).json({ error: 'Organization company name not configured' });
      }

      const months = req.query.months || 12;
      const buckets = getMonthBuckets(months);

      // Fetch all reviews from the period
      const reviews = await prisma.review.findMany({
        where: {
          company: { equals: company, mode: 'insensitive' },
          status: 'published',
          createdAt: { gte: buckets[0].start },
        },
        include: { ratings: true },
      });

      // Build monthly data
      const monthly = buckets.map(b => {
        const monthReviews = reviews.filter(r => {
          const d = new Date(r.createdAt);
          return d >= b.start && d <= b.end;
        });

        const scores = monthReviews.flatMap(r => r.ratings.map(rt => rt.score));
        const avgRating = avg(scores);
        const recommendPct = monthReviews.length > 0
          ? Math.round(monthReviews.filter(r => r.recommends).length / monthReviews.length * 100)
          : null;

        // Per-category for this month
        const categoryAvgs = {};
        CATEGORIES.forEach(cat => {
          const catScores = monthReviews.flatMap(r =>
            r.ratings.filter(rt => rt.category === cat).map(rt => rt.score)
          );
          categoryAvgs[cat] = catScores.length > 0 ? avg(catScores) : null;
        });

        return {
          label: b.label,
          year: b.year,
          month: b.month,
          reviewCount: monthReviews.length,
          avgRating: scores.length > 0 ? avgRating : null,
          recommendPct,
          categoryAvgs,
        };
      });

      // Overall trend direction
      const ratingValues = monthly.map(m => m.avgRating).filter(v => v !== null);
      const overallTrend = trendDirection(ratingValues);

      res.json({
        company,
        months: monthly,
        overallTrend,
        periodStart: buckets[0].label,
        periodEnd: buckets[buckets.length - 1].label,
      });
    } catch (error) {
      console.error('GET /api/pro/dashboard/trends error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/pro/dashboard/alerts
 * Flag concerning patterns for the company.
 */
router.get('/alerts',
  [
    query('severity')
      .optional()
      .trim()
      .isIn(['high', 'medium', 'info'])
      .withMessage('severity must be one of: high, medium, info'),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const company = getCompanyName(req);
      if (!company) {
        return res.status(400).json({ error: 'Organization company name not configured' });
      }

      const severityFilter = req.query.severity || null;
      const alerts = [];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get all reviews for this company
      const reviews = await prisma.review.findMany({
        where: { company: { equals: company, mode: 'insensitive' } },
        include: {
          ratings: true,
          manager: { select: { id: true, name: true } },
          _count: { select: { reports: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Group by manager
      const managerMap = {};
      reviews.forEach(r => {
        if (!managerMap[r.managerId]) {
          managerMap[r.managerId] = {
            id: r.managerId,
            name: r.manager.name,
            reviews: [],
          };
        }
        managerMap[r.managerId].reviews.push(r);
      });

      const buckets = getMonthBuckets(6);

      Object.values(managerMap).forEach(m => {
        const publishedReviews = m.reviews.filter(r => r.status === 'published');

        // 1. Declining ratings (3+ months downward)
        const monthlyAvgs = buckets.map(b => {
          const monthRevs = publishedReviews.filter(r => {
            const d = new Date(r.createdAt);
            return d >= b.start && d <= b.end;
          });
          const scores = monthRevs.flatMap(r => r.ratings.map(rt => rt.score));
          return scores.length > 0 ? avg(scores) : null;
        }).filter(v => v !== null);

        if (trendDirection(monthlyAvgs) === 'down') {
          alerts.push({
            type: 'declining_ratings',
            severity: 'high',
            manager: m.name,
            managerId: m.id,
            message: `${m.name}'s ratings have been declining over the past 3+ months`,
            data: { monthlyAvgs },
          });
        }

        // 2. Low recommendation rate
        if (publishedReviews.length >= 3) {
          const recPct = Math.round(
            publishedReviews.filter(r => r.recommends).length / publishedReviews.length * 100
          );
          if (recPct < 40) {
            alerts.push({
              type: 'low_recommend',
              severity: 'medium',
              manager: m.name,
              managerId: m.id,
              message: `Only ${recPct}% of reviewers recommend ${m.name}`,
              data: { recommendPct: recPct, reviewCount: publishedReviews.length },
            });
          }
        }

        // 3. Flagged reviews (3+ reports)
        const flaggedCount = m.reviews.filter(r => r._count.reports >= 3 || r.status === 'flagged').length;
        if (flaggedCount > 0) {
          alerts.push({
            type: 'flagged_reviews',
            severity: 'medium',
            manager: m.name,
            managerId: m.id,
            message: `${m.name} has ${flaggedCount} flagged review${flaggedCount > 1 ? 's' : ''}`,
            data: { flaggedCount },
          });
        }

        // 4. New reviews in last 7 days
        const recentReviews = publishedReviews.filter(r => new Date(r.createdAt) >= sevenDaysAgo);
        if (recentReviews.length > 0) {
          const recentAvg = avg(recentReviews.flatMap(r => r.ratings.map(rt => rt.score)));
          alerts.push({
            type: 'new_reviews',
            severity: 'info',
            manager: m.name,
            managerId: m.id,
            message: `${recentReviews.length} new review${recentReviews.length > 1 ? 's' : ''} for ${m.name} this week`,
            data: { count: recentReviews.length, avgRating: recentAvg },
          });
        }
      });

      // Sort: high severity first, then medium, then info
      const severityOrder = { high: 0, medium: 1, info: 2 };
      alerts.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

      // Filter by severity if requested
      const filtered = severityFilter
        ? alerts.filter(a => a.severity === severityFilter)
        : alerts;

      res.json({ company, alerts: filtered, total: filtered.length });
    } catch (error) {
      console.error('GET /api/pro/dashboard/alerts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/pro/dashboard/export
 * Export all company review data as JSON.
 */
router.get('/export',
  [
    query('dateFrom')
      .optional()
      .trim()
      .isISO8601().withMessage('dateFrom must be a valid ISO 8601 date'),
    query('dateTo')
      .optional()
      .trim()
      .isISO8601().withMessage('dateTo must be a valid ISO 8601 date'),
    query('format')
      .optional()
      .trim()
      .isIn(['json']).withMessage('format must be: json'),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const company = getCompanyName(req);
      if (!company) {
        return res.status(400).json({ error: 'Organization company name not configured' });
      }

      // Build date filter
      const dateFilter = {};
      if (req.query.dateFrom) dateFilter.gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) dateFilter.lte = new Date(req.query.dateTo);

      const where = {
        company: { equals: company, mode: 'insensitive' },
        status: 'published',
      };
      if (Object.keys(dateFilter).length > 0) {
        where.createdAt = dateFilter;
      }

      const reviews = await prisma.review.findMany({
        where,
        include: {
          ratings: true,
          manager: { select: { name: true, linkedinUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const exportData = reviews.map(r => ({
        managerName: r.manager.name,
        managerLinkedin: r.manager.linkedinUrl,
        company: r.company,
        recommends: r.recommends,
        pros: r.pros,
        cons: r.cons,
        advice: r.advice || '',
        ratings: Object.fromEntries(r.ratings.map(rt => [rt.category, rt.score])),
        overallRating: avg(r.ratings.map(rt => rt.score)),
        date: r.createdAt.toISOString().split('T')[0],
      }));

      res.json({
        company,
        exportDate: new Date().toISOString(),
        totalRecords: exportData.length,
        reviews: exportData,
      });
    } catch (error) {
      console.error('GET /api/pro/dashboard/export error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;

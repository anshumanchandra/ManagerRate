// ==========================================
// Pro API — Advanced Analytics & Statistics
// ==========================================

const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const prisma = require('../../config/database');
const { CATEGORIES } = require('../../config/categories');
const { apiAuth } = require('../../middleware/apiAuth');
const { handleValidationErrors } = require('../../middleware/validate');

// All routes require stats:read permission
router.use(apiAuth('stats:read'));

/**
 * GET /api/pro/stats/industry
 * Industry-wide benchmarks by category.
 * Averages across ALL managers and reviews in the system.
 */
router.get('/industry', async (req, res) => {
  try {
    const allRatings = await prisma.rating.findMany({
      where: { review: { status: 'published' } },
    });

    const totalReviews = await prisma.review.count({ where: { status: 'published' } });
    const totalManagers = await prisma.manager.count({
      where: { reviews: { some: { status: 'published' } } },
    });

    // Global average
    const globalAvg = allRatings.length > 0
      ? parseFloat((allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length).toFixed(2))
      : 0;

    // Per-category benchmarks
    const benchmarks = {};
    CATEGORIES.forEach(cat => {
      const scores = allRatings.filter(r => r.category === cat).map(r => r.score);
      const avg = scores.length > 0
        ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
        : 0;
      const min = scores.length > 0 ? Math.min(...scores) : 0;
      const max = scores.length > 0 ? Math.max(...scores) : 0;

      // Standard deviation
      const mean = avg;
      const variance = scores.length > 0
        ? scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length
        : 0;
      const stdDev = parseFloat(Math.sqrt(variance).toFixed(2));

      benchmarks[cat] = { avg, min, max, stdDev, sampleSize: scores.length };
    });

    // Score distribution (1-5)
    const distribution = [0, 0, 0, 0, 0];
    allRatings.forEach(r => {
      if (r.score >= 1 && r.score <= 5) distribution[r.score - 1]++;
    });

    res.json({
      globalAverage: globalAvg,
      totalReviews,
      totalManagers,
      benchmarks,
      distribution,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Pro GET /stats/industry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/pro/stats/trends
 * Rating trends over time (monthly averages for last 12 months).
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
      const monthCount = req.query.months || 12;

      const reviews = await prisma.review.findMany({
        where: { status: 'published' },
        include: { ratings: true },
        orderBy: { createdAt: 'asc' },
      });

      const monthly = [];
      for (let i = monthCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

        const monthReviews = reviews.filter(r => {
          const rd = new Date(r.createdAt);
          return rd >= monthStart && rd <= monthEnd;
        });

        const monthRatings = monthReviews.flatMap(r => r.ratings);
        const avgRating = monthRatings.length > 0
          ? parseFloat((monthRatings.reduce((s, r) => s + r.score, 0) / monthRatings.length).toFixed(2))
          : null;

        // Per-category for this month
        const catAvgs = {};
        CATEGORIES.forEach(cat => {
          const scores = monthRatings.filter(r => r.category === cat).map(r => r.score);
          catAvgs[cat] = scores.length > 0
            ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
            : null;
        });

        monthly.push({
          month: monthStart.toISOString().slice(0, 7),
          avgRating,
          reviewCount: monthReviews.length,
          recommendPct: monthReviews.length > 0
            ? Math.round(monthReviews.filter(r => r.recommends).length / monthReviews.length * 100)
            : null,
          categoryAvgs: catAvgs,
        });
      }

      // Overall trend direction
      const withData = monthly.filter(m => m.avgRating !== null);
      let direction = 'stable';
      if (withData.length >= 3) {
        const first = withData[0].avgRating;
        const last = withData[withData.length - 1].avgRating;
        if (last - first > 0.2) direction = 'improving';
        else if (first - last > 0.2) direction = 'declining';
      }

      res.json({
        monthly,
        direction,
        totalDataPoints: withData.length,
      });
    } catch (error) {
      console.error('Pro GET /stats/trends error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/pro/stats/companies
 * Company leaderboard — ranked by average manager rating.
 */
router.get('/companies',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('limit must be an integer between 1 and 100')
      .toInt(),
    query('minReviews')
      .optional()
      .isInt({ min: 0 }).withMessage('minReviews must be a non-negative integer')
      .toInt(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const limit = req.query.limit || 25;
      const minReviews = req.query.minReviews || 0;

      const reviews = await prisma.review.findMany({
        where: { status: 'published' },
        include: { ratings: true, manager: { select: { id: true, name: true } } },
      });

      // Group by company
      const companyMap = {};
      reviews.forEach(r => {
        if (!companyMap[r.company]) {
          companyMap[r.company] = { reviews: [], managers: new Set(), ratings: [] };
        }
        companyMap[r.company].reviews.push(r);
        companyMap[r.company].managers.add(r.manager.id);
        companyMap[r.company].ratings.push(...r.ratings);
      });

      let leaderboard = Object.entries(companyMap).map(([company, data]) => {
        const avgRating = parseFloat(
          (data.ratings.reduce((s, r) => s + r.score, 0) / data.ratings.length).toFixed(2)
        );
        const recommendPct = Math.round(
          data.reviews.filter(r => r.recommends).length / data.reviews.length * 100
        );

        // Top categories for this company
        const catAvgs = {};
        CATEGORIES.forEach(cat => {
          const scores = data.ratings.filter(r => r.category === cat).map(r => r.score);
          catAvgs[cat] = scores.length > 0
            ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
            : 0;
        });
        const sortedCats = Object.entries(catAvgs).sort((a, b) => b[1] - a[1]);

        return {
          company,
          avgRating,
          recommendPct,
          reviewCount: data.reviews.length,
          managerCount: data.managers.size,
          topCategory: sortedCats[0] ? { name: sortedCats[0][0], score: sortedCats[0][1] } : null,
          weakestCategory: sortedCats[sortedCats.length - 1]
            ? { name: sortedCats[sortedCats.length - 1][0], score: sortedCats[sortedCats.length - 1][1] }
            : null,
        };
      });

      // Apply minReviews filter
      if (minReviews > 0) {
        leaderboard = leaderboard.filter(c => c.reviewCount >= minReviews);
      }

      leaderboard.sort((a, b) => b.avgRating - a.avgRating);

      res.json({
        leaderboard: leaderboard.slice(0, limit),
        totalCompanies: leaderboard.length,
      });
    } catch (error) {
      console.error('Pro GET /stats/companies error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/pro/stats/categories
 * Deep dive into each category across all managers.
 */
router.get('/categories',
  [
    query('category')
      .optional()
      .trim()
      .isIn(CATEGORIES)
      .withMessage(`category must be one of: ${CATEGORIES.join(', ')}`),
    query('months')
      .optional()
      .isInt({ min: 1, max: 24 }).withMessage('months must be an integer between 1 and 24')
      .toInt(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const categoryFilter = req.query.category || null;
      const trendMonths = req.query.months || 6;

      const allRatings = await prisma.rating.findMany({
        where: { review: { status: 'published' } },
        include: { review: { select: { company: true, createdAt: true } } },
      });

      // If filtering by a single category, limit the analysis
      const categoriesToAnalyze = categoryFilter ? [categoryFilter] : CATEGORIES;

      const categoryDeepDive = categoriesToAnalyze.map(cat => {
        const catRatings = allRatings.filter(r => r.category === cat);
        const scores = catRatings.map(r => r.score);

        if (scores.length === 0) {
          return { category: cat, avg: 0, distribution: [0, 0, 0, 0, 0], topCompany: null, sampleSize: 0 };
        }

        const avg = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));

        // Distribution
        const dist = [0, 0, 0, 0, 0];
        scores.forEach(s => { if (s >= 1 && s <= 5) dist[s - 1]++; });

        // Best company for this category
        const byCompany = {};
        catRatings.forEach(r => {
          const comp = r.review.company;
          if (!byCompany[comp]) byCompany[comp] = [];
          byCompany[comp].push(r.score);
        });

        let topCompany = null;
        let topCompanyAvg = 0;
        Object.entries(byCompany).forEach(([comp, compScores]) => {
          if (compScores.length >= 2) { // Need at least 2 ratings
            const compAvg = compScores.reduce((a, b) => a + b, 0) / compScores.length;
            if (compAvg > topCompanyAvg) {
              topCompanyAvg = compAvg;
              topCompany = { company: comp, avg: parseFloat(compAvg.toFixed(2)), reviews: compScores.length };
            }
          }
        });

        // Trend for this category (last N months)
        const trend = [];
        for (let i = trendMonths - 1; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
          const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
          const monthScores = catRatings
            .filter(r => new Date(r.review.createdAt) >= monthStart && new Date(r.review.createdAt) <= monthEnd)
            .map(r => r.score);
          trend.push({
            month: monthStart.toISOString().slice(0, 7),
            avg: monthScores.length > 0
              ? parseFloat((monthScores.reduce((a, b) => a + b, 0) / monthScores.length).toFixed(2))
              : null,
          });
        }

        return {
          category: cat,
          avg,
          distribution: dist,
          topCompany,
          sampleSize: scores.length,
          trend,
        };
      });

      // Rank categories (only when showing all)
      const ranked = [...categoryDeepDive].sort((a, b) => b.avg - a.avg);

      res.json({
        categories: categoryDeepDive,
        ranked: ranked.map((c, i) => ({ rank: i + 1, category: c.category, avg: c.avg })),
        highestRated: ranked[0]?.category || null,
        lowestRated: ranked[ranked.length - 1]?.category || null,
      });
    } catch (error) {
      console.error('Pro GET /stats/categories error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;

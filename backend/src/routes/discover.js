// ==========================================
// Discover Routes — SEO-friendly Discovery Pages
// ==========================================
// Company pages, best manager lists, leaderboards

const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { query, param, validationResult } = require('express-validator');
const { CATEGORIES } = require('../config/categories');
const {
  bayesianScore, confidenceLevel,
  categoryAverages, simpleAverage, recommendPercent,
} = require('../utils/scoring');

function handleValidation(req, res, next) {
  var errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

// ==========================================
// Helper: Enrich a manager record
// ==========================================
function enrichManager(m, globalAvg) {
  var avg = simpleAverage(m.reviews);
  var companies = [];
  var companySet = {};
  m.reviews.forEach(function (r) {
    if (!companySet[r.company]) { companySet[r.company] = 1; companies.push(r.company); }
  });
  return {
    id: m.id,
    name: m.name,
    linkedinSlug: m.linkedinSlug,
    companies: companies,
    reviewCount: m.reviews.length,
    avgRating: avg,
    bayesianScore: bayesianScore(avg, m.reviews.length, globalAvg),
    recommendPct: recommendPercent(m.reviews),
    confidenceLevel: confidenceLevel(m.reviews.length),
    categoryAvgs: categoryAverages(m.reviews),
  };
}

// Get global average for Bayesian scoring
async function getGlobalAvg() {
  var result = await prisma.rating.aggregate({
    where: { review: { status: 'published' } },
    _avg: { score: true },
  });
  return (result._avg && result._avg.score) || 3.0;
}

// ==========================================
// GET /api/discover/company/:companyName
// Company overview page
// ==========================================
router.get('/company/:companyName', [
  param('companyName').trim().isLength({ min: 1, max: 200 }),
  handleValidation,
], async function (req, res) {
  try {
    var companyName = req.params.companyName;

    // Find all managers with reviews at this company
    var managers = await prisma.manager.findMany({
      where: {
        reviews: {
          some: { company: { equals: companyName, mode: 'insensitive' }, status: 'published' },
        },
      },
      include: {
        reviews: {
          where: { status: 'published', company: { equals: companyName, mode: 'insensitive' } },
          include: { ratings: true },
        },
      },
    });

    if (managers.length === 0) {
      return res.status(404).json({ error: 'No managers found at this company' });
    }

    var globalAvg = await getGlobalAvg();
    var enriched = managers.map(function (m) { return enrichManager(m, globalAvg); });
    enriched.sort(function (a, b) { return b.bayesianScore - a.bayesianScore; });

    // Company-wide stats
    var allReviews = [];
    managers.forEach(function (m) { allReviews = allReviews.concat(m.reviews); });
    var companyAvg = simpleAverage(allReviews);
    var companyRecommend = recommendPercent(allReviews);
    var companyCategoryAvgs = categoryAverages(allReviews);

    // Monthly review volume (last 12 months)
    var now = new Date();
    var monthlyVolume = [];
    for (var i = 11; i >= 0; i--) {
      var monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      var count = allReviews.filter(function (r) {
        var d = new Date(r.createdAt);
        return d >= monthStart && d <= monthEnd;
      }).length;
      monthlyVolume.push({
        month: monthStart.toISOString().slice(0, 7),
        count: count,
      });
    }

    res.json({
      company: companyName,
      managerCount: managers.length,
      totalReviews: allReviews.length,
      avgRating: companyAvg,
      recommendPct: companyRecommend,
      categoryAvgs: companyCategoryAvgs,
      bestRated: enriched.slice(0, 3),
      lowestRated: enriched.slice(-3).reverse(),
      monthlyVolume: monthlyVolume,
    });
  } catch (error) {
    console.error('GET /api/discover/company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// GET /api/discover/company/:companyName/managers
// Paginated manager listing for a company
// ==========================================
router.get('/company/:companyName/managers', [
  param('companyName').trim().isLength({ min: 1, max: 200 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('sort').optional().isIn(['rating_desc', 'rating_asc', 'reviews_desc', 'newest']),
  handleValidation,
], async function (req, res) {
  try {
    var companyName = req.params.companyName;
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 20;
    var sort = req.query.sort || 'rating_desc';
    var skip = (page - 1) * limit;

    var managers = await prisma.manager.findMany({
      where: {
        reviews: {
          some: { company: { equals: companyName, mode: 'insensitive' }, status: 'published' },
        },
      },
      include: {
        reviews: {
          where: { status: 'published', company: { equals: companyName, mode: 'insensitive' } },
          include: { ratings: true },
        },
      },
    });

    var globalAvg = await getGlobalAvg();
    var enriched = managers.map(function (m) { return enrichManager(m, globalAvg); });

    // Sort
    if (sort === 'rating_desc') enriched.sort(function (a, b) { return b.bayesianScore - a.bayesianScore; });
    else if (sort === 'rating_asc') enriched.sort(function (a, b) { return a.bayesianScore - b.bayesianScore; });
    else if (sort === 'reviews_desc') enriched.sort(function (a, b) { return b.reviewCount - a.reviewCount; });
    else if (sort === 'newest') enriched.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

    var paginated = enriched.slice(skip, skip + limit);

    res.json({
      company: companyName,
      managers: paginated,
      pagination: {
        page: page,
        limit: limit,
        total: enriched.length,
        hasMore: skip + limit < enriched.length,
      },
    });
  } catch (error) {
    console.error('GET /api/discover/company/managers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// GET /api/discover/best
// Best-rated managers with filters
// ==========================================
router.get('/best', [
  query('city').optional().trim().isLength({ max: 200 }),
  query('department').optional().trim().isLength({ max: 200 }),
  query('company').optional().trim().isLength({ max: 200 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  handleValidation,
], async function (req, res) {
  try {
    var company = req.query.company || '';
    var limit = parseInt(req.query.limit, 10) || 20;

    // Build where
    var reviewWhere = { status: 'published' };
    if (company) reviewWhere.company = { contains: company, mode: 'insensitive' };

    var managers = await prisma.manager.findMany({
      where: {
        reviews: { some: reviewWhere },
      },
      include: {
        reviews: {
          where: reviewWhere,
          include: { ratings: true },
        },
      },
    });

    var globalAvg = await getGlobalAvg();
    var enriched = managers
      .map(function (m) { return enrichManager(m, globalAvg); })
      .filter(function (m) { return m.reviewCount >= 5; }) // Minimum 5 reviews
      .sort(function (a, b) { return b.bayesianScore - a.bayesianScore; })
      .slice(0, limit);

    res.json({
      title: 'Best Rated Managers' + (company ? ' at ' + company : ''),
      managers: enriched,
      count: enriched.length,
      minReviewsRequired: 5,
    });
  } catch (error) {
    console.error('GET /api/discover/best error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// GET /api/discover/companies
// Company leaderboard
// ==========================================
router.get('/companies', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidation,
], async function (req, res) {
  try {
    var limit = parseInt(req.query.limit, 10) || 30;

    // Get all published reviews with ratings
    var reviews = await prisma.review.findMany({
      where: { status: 'published' },
      include: { ratings: true, manager: { select: { name: true, id: true } } },
    });

    // Group by company
    var companyMap = {};
    reviews.forEach(function (r) {
      if (!companyMap[r.company]) {
        companyMap[r.company] = { reviews: [], managerIds: {} };
      }
      companyMap[r.company].reviews.push(r);
      companyMap[r.company].managerIds[r.managerId] = r.manager.name;
    });

    var globalAvg = await getGlobalAvg();

    var companies = Object.entries(companyMap)
      .map(function (entry) {
        var name = entry[0];
        var data = entry[1];
        var managerCount = Object.keys(data.managerIds).length;
        var avg = simpleAverage(data.reviews);

        // Find top-rated manager at this company
        var managerScores = {};
        data.reviews.forEach(function (r) {
          if (!managerScores[r.managerId]) managerScores[r.managerId] = { ratings: [], name: data.managerIds[r.managerId] };
          managerScores[r.managerId].ratings = managerScores[r.managerId].ratings.concat(r.ratings);
        });

        var topManager = null;
        var topScore = 0;
        Object.entries(managerScores).forEach(function (e) {
          var mAvg = e[1].ratings.reduce(function (s, rt) { return s + rt.score; }, 0) / e[1].ratings.length;
          if (mAvg > topScore) { topScore = mAvg; topManager = e[1].name; }
        });

        return {
          company: name,
          managerCount: managerCount,
          reviewCount: data.reviews.length,
          avgRating: avg,
          bayesianScore: bayesianScore(avg, data.reviews.length, globalAvg),
          recommendPct: recommendPercent(data.reviews),
          topRatedManager: topManager,
          topManagerRating: parseFloat(topScore.toFixed(2)),
        };
      })
      .filter(function (c) { return c.managerCount >= 2; }) // Min 2 managers
      .sort(function (a, b) { return b.bayesianScore - a.bayesianScore; })
      .slice(0, limit);

    res.json({
      companies: companies,
      count: companies.length,
    });
  } catch (error) {
    console.error('GET /api/discover/companies error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

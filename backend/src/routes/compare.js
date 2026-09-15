// ==========================================
// Compare Routes — Manager Comparison API
// ==========================================
// GET /api/compare?ids=uuid1,uuid2,uuid3

const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { query, validationResult } = require('express-validator');
const { CATEGORIES } = require('../config/categories');
const {
  bayesianScore, confidenceLevel,
  categoryAverages, simpleAverage, recommendPercent,
  recentScore, recencyBreakdown,
} = require('../utils/scoring');

function handleValidation(req, res, next) {
  var errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

/**
 * GET /api/compare?ids=uuid1,uuid2,uuid3
 * Side-by-side comparison of 2-5 managers.
 */
router.get('/', [
  query('ids')
    .exists().withMessage('ids parameter required')
    .custom(function (val) {
      var ids = val.split(',').map(function (s) { return s.trim(); });
      if (ids.length < 2) throw new Error('Need at least 2 manager IDs');
      if (ids.length > 5) throw new Error('Maximum 5 managers for comparison');
      // Validate each is UUID-like
      var uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      ids.forEach(function (id) {
        if (!uuidPattern.test(id)) throw new Error('Invalid UUID: ' + id);
      });
      return true;
    }),
  handleValidation,
], async function (req, res) {
  try {
    var ids = req.query.ids.split(',').map(function (s) { return s.trim(); });

    // Fetch all managers
    var managers = await prisma.manager.findMany({
      where: { id: { in: ids } },
      include: {
        reviews: {
          where: { status: 'published' },
          include: { ratings: true },
        },
      },
    });

    if (managers.length < 2) {
      return res.status(404).json({ error: 'Could not find enough managers. Need at least 2.' });
    }

    // Get global average for Bayesian scoring
    var globalResult = await prisma.rating.aggregate({
      where: { review: { status: 'published' } },
      _avg: { score: true },
    });
    var globalAvg = (globalResult._avg && globalResult._avg.score) || 3.0;

    // Build comparison data for each manager
    var comparison = managers.map(function (m) {
      var avg = simpleAverage(m.reviews);
      var catAvgs = categoryAverages(m.reviews);

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
        recentScore: recentScore(m.reviews),
        recommendPct: recommendPercent(m.reviews),
        confidenceLevel: confidenceLevel(m.reviews.length),
        categoryScores: catAvgs,
        recency: recencyBreakdown(m.reviews),
      };
    });

    // Sort by bayesian score (best first)
    comparison.sort(function (a, b) { return b.bayesianScore - a.bayesianScore; });

    // Generate "Better at" / "Worse at" highlights for each pair
    var highlights = [];
    for (var i = 0; i < comparison.length; i++) {
      for (var j = i + 1; j < comparison.length; j++) {
        var a = comparison[i];
        var b = comparison[j];
        var aBetter = [];
        var bBetter = [];

        CATEGORIES.forEach(function (cat) {
          var diff = (a.categoryScores[cat] || 0) - (b.categoryScores[cat] || 0);
          if (diff > 0.3) aBetter.push({ category: cat, diff: parseFloat(diff.toFixed(2)) });
          else if (diff < -0.3) bBetter.push({ category: cat, diff: parseFloat(Math.abs(diff).toFixed(2)) });
        });

        aBetter.sort(function (x, y) { return y.diff - x.diff; });
        bBetter.sort(function (x, y) { return y.diff - x.diff; });

        highlights.push({
          managerA: a.name,
          managerB: b.name,
          aBetterAt: aBetter.slice(0, 3),
          bBetterAt: bBetter.slice(0, 3),
          overallWinner: a.bayesianScore > b.bayesianScore ? a.name : b.name,
          overallDiff: parseFloat(Math.abs(a.bayesianScore - b.bayesianScore).toFixed(2)),
        });
      }
    }

    // Category-by-category table
    var categoryTable = CATEGORIES.map(function (cat) {
      var row = { category: cat };
      comparison.forEach(function (m) {
        row[m.id] = m.categoryScores[cat] || 0;
      });

      // Find best and worst for this category
      var scores = comparison.map(function (m) { return { id: m.id, name: m.name, score: m.categoryScores[cat] || 0 }; });
      scores.sort(function (a, b) { return b.score - a.score; });
      row.best = scores[0];
      row.worst = scores[scores.length - 1];

      return row;
    });

    res.json({
      managers: comparison,
      highlights: highlights,
      categoryTable: categoryTable,
      comparedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GET /api/compare error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

// ==========================================
// Insights Routes — AI-style Manager Analysis
// ==========================================
// GET /api/insights/:managerId — Full manager intelligence report

const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { param, validationResult } = require('express-validator');
const { CATEGORIES } = require('../config/categories');
const {
  bayesianScore, confidenceLevel, recentScore,
  recencyBreakdown, categoryAverages, simpleAverage, recommendPercent,
} = require('../utils/scoring');

function handleValidation(req, res, next) {
  var errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

/**
 * Extract frequent phrases from an array of text strings.
 * Returns top N most common 2-4 word phrases.
 */
function extractCommonPhrases(texts, topN) {
  topN = topN || 5;
  var phraseCount = {};

  // Common stop words to filter
  var stops = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it',
    'they', 'them', 'their', 'not', 'no', 'very', 'really', 'just',
    'also', 'so', 'too', 'much', 'more', 'most', 'some', 'any', 'all',
  ]);

  texts.forEach(function (text) {
    if (!text) return;
    var words = text.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(function (w) { return w.length > 2 && !stops.has(w); });

    // Extract 2-word and 3-word phrases
    for (var len = 2; len <= 3; len++) {
      for (var i = 0; i <= words.length - len; i++) {
        var phrase = words.slice(i, i + len).join(' ');
        phraseCount[phrase] = (phraseCount[phrase] || 0) + 1;
      }
    }
  });

  // Sort by frequency and return top N (min 2 occurrences)
  return Object.entries(phraseCount)
    .filter(function (e) { return e[1] >= 2; })
    .sort(function (a, b) { return b[1] - a[1]; })
    .slice(0, topN)
    .map(function (e) { return { phrase: e[0], count: e[1] }; });
}

/**
 * Calculate standard deviation of an array.
 */
function stdDev(arr) {
  if (arr.length < 2) return 0;
  var mean = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
  var sq = arr.reduce(function (s, v) { return s + Math.pow(v - mean, 2); }, 0);
  return Math.sqrt(sq / (arr.length - 1));
}

/**
 * Calculate rating trend slope (simple linear regression).
 * Returns: "improving" | "stable" | "declining"
 */
function ratingTrend(reviews) {
  if (reviews.length < 3) return { direction: 'insufficient_data', slope: 0, monthlyAvgs: [] };

  // Group by month
  var monthly = {};
  reviews.forEach(function (r) {
    var month = new Date(r.createdAt).toISOString().slice(0, 7);
    if (!monthly[month]) monthly[month] = [];
    var avg = 0;
    if (r.ratings && r.ratings.length > 0) {
      avg = r.ratings.reduce(function (s, rt) { return s + rt.score; }, 0) / r.ratings.length;
    }
    monthly[month].push(avg);
  });

  // Calculate monthly averages, sorted by date
  var monthlyAvgs = Object.entries(monthly)
    .map(function (e) {
      return {
        month: e[0],
        avg: parseFloat((e[1].reduce(function (a, b) { return a + b; }, 0) / e[1].length).toFixed(2)),
        count: e[1].length,
      };
    })
    .sort(function (a, b) { return a.month.localeCompare(b.month); });

  // Simple linear regression on monthly avgs
  var n = monthlyAvgs.length;
  if (n < 2) return { direction: 'insufficient_data', slope: 0, monthlyAvgs: monthlyAvgs };

  var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  monthlyAvgs.forEach(function (d, i) {
    sumX += i;
    sumY += d.avg;
    sumXY += i * d.avg;
    sumX2 += i * i;
  });

  var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  var direction = 'stable';
  if (slope > 0.05) direction = 'improving';
  else if (slope < -0.05) direction = 'declining';

  return {
    direction: direction,
    slope: parseFloat(slope.toFixed(4)),
    monthlyAvgs: monthlyAvgs,
  };
}

/**
 * GET /api/insights/:managerId
 * Generate comprehensive manager insights report.
 */
router.get('/:managerId', [
  param('managerId').isUUID().withMessage('Invalid manager ID'),
  handleValidation,
], async function (req, res) {
  try {
    var manager = await prisma.manager.findUnique({
      where: { id: req.params.managerId },
      include: {
        reviews: {
          where: { status: 'published' },
          include: { ratings: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!manager) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    var reviews = manager.reviews;
    if (reviews.length === 0) {
      return res.json({
        manager: { id: manager.id, name: manager.name },
        message: 'No published reviews available for insights.',
      });
    }

    // Global average for Bayesian
    var globalResult = await prisma.rating.aggregate({
      where: { review: { status: 'published' } },
      _avg: { score: true },
    });
    var globalAvg = (globalResult._avg && globalResult._avg.score) || 3.0;

    // --- Basic stats ---
    var avg = simpleAverage(reviews);
    var catAvgs = categoryAverages(reviews);

    var companies = [];
    var companySet = {};
    reviews.forEach(function (r) {
      if (!companySet[r.company]) { companySet[r.company] = 1; companies.push(r.company); }
    });

    // --- Top strengths and weaknesses (from category scores) ---
    var sortedCats = Object.entries(catAvgs)
      .filter(function (e) { return e[1] > 0; })
      .sort(function (a, b) { return b[1] - a[1]; });

    var topStrengths = sortedCats.slice(0, 3).map(function (e) { return { category: e[0], score: e[1] }; });
    var topWeaknesses = sortedCats.slice(-3).reverse().map(function (e) { return { category: e[0], score: e[1] }; });

    // --- Red flags: any category consistently below 2.5 ---
    var redFlags = sortedCats
      .filter(function (e) { return e[1] < 2.5 && e[1] > 0; })
      .map(function (e) { return { category: e[0], score: e[1], severity: e[1] < 2.0 ? 'critical' : 'warning' }; });

    // --- Common themes from pros and cons ---
    var allPros = reviews.map(function (r) { return r.pros; });
    var allCons = reviews.map(function (r) { return r.cons; });

    var positiveThemes = extractCommonPhrases(allPros, 5);
    var negativeThemes = extractCommonPhrases(allCons, 5);

    // --- Disagreement detection (high std dev categories) ---
    var allRatings = [];
    reviews.forEach(function (r) { allRatings = allRatings.concat(r.ratings); });

    var disagreements = [];
    CATEGORIES.forEach(function (cat) {
      var scores = allRatings.filter(function (r) { return r.category === cat; }).map(function (r) { return r.score; });
      if (scores.length >= 3) {
        var sd = stdDev(scores);
        if (sd > 1.2) {
          var positiveCount = scores.filter(function (s) { return s >= 4; }).length;
          var negativeCount = scores.filter(function (s) { return s <= 2; }).length;
          disagreements.push({
            category: cat,
            stdDev: parseFloat(sd.toFixed(2)),
            positivePct: Math.round(positiveCount / scores.length * 100),
            negativePct: Math.round(negativeCount / scores.length * 100),
            message: 'Employees disagree about ' + cat,
          });
        }
      }
    });

    // --- Rating trend ---
    var trend = ratingTrend(reviews);

    // --- Manager vs Company comparison ---
    var companyComparisons = {};
    companies.forEach(function (comp) {
      // This manager's rating at this company
      var compReviews = reviews.filter(function (r) { return r.company === comp; });
      var mgrAvgAtComp = simpleAverage(compReviews);
      companyComparisons[comp] = {
        managerAvg: mgrAvgAtComp,
        reviewCount: compReviews.length,
        // Company-wide average would require separate query — we note it for the caller
        comparisonNote: 'Use /api/discover/company/' + encodeURIComponent(comp) + ' for company average',
      };
    });

    // --- Interview questions based on weak areas ---
    var questionMap = {
      'Leadership & Vision': 'How do you define and communicate your team\'s vision and direction?',
      'Communication Skills': 'How frequently do you hold 1:1s, and how do you handle difficult conversations?',
      'Career Development Support': 'How are promotions evaluated? What growth opportunities exist?',
      'Work-Life Balance': 'What does work-life balance look like for your team? How do you handle crunch periods?',
      'Fairness & Transparency': 'How do you ensure fairness in workload distribution and performance reviews?',
      'Conflict Resolution': 'Can you describe how you handled a recent team disagreement?',
      'Empathy & Emotional Intelligence': 'How do you support team members going through personal challenges?',
      'Decision Making': 'How do you involve the team in decisions that affect their work?',
      'Team Building': 'How do you foster collaboration and team culture, especially with remote members?',
      'Accountability': 'What happens when someone misses expectations? How do you handle accountability?',
      'Technical Competence': 'How hands-on are you technically? How do you evaluate engineering proposals?',
    };

    var suggestedQuestions = topWeaknesses
      .filter(function (w) { return questionMap[w.category]; })
      .map(function (w) {
        return {
          area: w.category,
          score: w.score,
          question: questionMap[w.category],
        };
      });

    // Add generic questions for areas with disagreement
    disagreements.forEach(function (d) {
      if (questionMap[d.category]) {
        suggestedQuestions.push({
          area: d.category + ' (employees disagree)',
          score: catAvgs[d.category],
          question: questionMap[d.category],
        });
      }
    });

    // Deduplicate questions by area
    var seenAreas = {};
    suggestedQuestions = suggestedQuestions.filter(function (q) {
      var key = q.area.split(' (')[0]; // strip the "(employees disagree)" suffix
      if (seenAreas[key]) return false;
      seenAreas[key] = true;
      return true;
    });

    // --- Build response ---
    res.json({
      manager: {
        id: manager.id,
        name: manager.name,
        linkedinUrl: manager.linkedinUrl,
        companies: companies,
      },
      overview: {
        avgRating: avg,
        bayesianScore: bayesianScore(avg, reviews.length, globalAvg),
        reviewCount: reviews.length,
        recommendPct: recommendPercent(reviews),
        recentScore: recentScore(reviews),
        confidenceLevel: confidenceLevel(reviews.length),
        recency: recencyBreakdown(reviews),
      },
      categoryScores: catAvgs,
      strengths: topStrengths,
      weaknesses: topWeaknesses,
      redFlags: redFlags,
      positiveThemes: positiveThemes,
      negativeThemes: negativeThemes,
      disagreements: disagreements,
      trend: trend,
      companyBreakdown: companyComparisons,
      suggestedInterviewQuestions: suggestedQuestions,
      generatedAt: new Date().toISOString(),
      disclaimer: 'This analysis is based on anonymous employee reviews and should be considered alongside other evaluation methods.',
    });
  } catch (error) {
    console.error('GET /api/insights error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

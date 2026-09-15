// ==========================================
// Manager Routes V2 — Enhanced Entity System
// ==========================================
// Features: City/dept filters, Bayesian scoring, work-again %,
// strengths/weaknesses aggregation, timeline, confidence levels,
// manager responses, current vs former split.

const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const rateLimit = require('express-rate-limit');
const { validateSearch, validateUUID, validateManagerResponse } = require('../middleware/validator');
const { sanitizeText } = require('../utils/sanitize');
const { CATEGORIES } = require('../config/categories');
const { bayesianScore, confidenceLevel, recentScore, ratingTimeline, detectTrend } = require('../utils/scoring');

var slugLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Too many lookup requests.' } });

// Helper: aggregate review data for a manager
function aggregateManagerData(manager, globalAvg) {
  var reviews = manager.reviews || [];
  if (reviews.length === 0) {
    return {
      avgRating: 0,
      bayesianRating: 0,
      confidence: confidenceLevel(0),
      recommendPct: 0,
      workAgainPct: 0,
      reviewCount: 0,
      companies: [],
      topStrengths: [],
      topWeaknesses: [],
      categoryAvgs: {},
      tenureBreakdown: {},
      relationshipBreakdown: {},
      currentVsFormer: { current: { count: 0, avg: 0 }, former: { count: 0, avg: 0 } },
      recentScore: 0,
      reviewRecency: { last12: 0, mid: 0, old: 0 },
      timeline: [],
      trend: 'insufficient_data',
    };
  }

  var allRatings = reviews.flatMap(function (r) { return r.ratings; });
  var avgRating = allRatings.length > 0
    ? allRatings.reduce(function (s, r) { return s + r.score; }, 0) / allRatings.length
    : 0;

  // Bayesian score
  var bScore = bayesianScore(avgRating, reviews.length, globalAvg || 3.5, 5);

  // Recommend %
  var recommendPct = Math.round(reviews.filter(function (r) { return r.recommends; }).length / reviews.length * 100);

  // Work again %
  var workAgainPositive = reviews.filter(function (r) {
    return r.workAgain === 'definitely' || r.workAgain === 'probably';
  }).length;
  var workAgainTotal = reviews.filter(function (r) { return r.workAgain; }).length;
  var workAgainPct = workAgainTotal > 0 ? Math.round(workAgainPositive / workAgainTotal * 100) : 0;

  // Companies
  var companySet = {};
  reviews.forEach(function (r) { companySet[r.company] = 1; });

  // Strengths aggregation
  var strengthCounts = {};
  reviews.forEach(function (r) {
    (r.strengths || []).forEach(function (s) {
      strengthCounts[s] = (strengthCounts[s] || 0) + 1;
    });
  });
  var topStrengths = Object.keys(strengthCounts)
    .map(function (k) { return { tag: k, count: strengthCounts[k] }; })
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, 5);

  // Weaknesses aggregation
  var weaknessCounts = {};
  reviews.forEach(function (r) {
    (r.weaknesses || []).forEach(function (w) {
      weaknessCounts[w] = (weaknessCounts[w] || 0) + 1;
    });
  });
  var topWeaknesses = Object.keys(weaknessCounts)
    .map(function (k) { return { tag: k, count: weaknessCounts[k] }; })
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, 5);

  // Category averages
  var categoryAvgs = {};
  CATEGORIES.forEach(function (cat) {
    var scores = allRatings.filter(function (r) { return r.category === cat; }).map(function (r) { return r.score; });
    categoryAvgs[cat] = scores.length > 0
      ? parseFloat((scores.reduce(function (a, b) { return a + b; }, 0) / scores.length).toFixed(2))
      : 0;
  });

  // Tenure breakdown
  var tenureBreakdown = {};
  reviews.forEach(function (r) {
    if (r.tenure) tenureBreakdown[r.tenure] = (tenureBreakdown[r.tenure] || 0) + 1;
  });

  // Relationship breakdown
  var relationshipBreakdown = {};
  reviews.forEach(function (r) {
    if (r.relationship) relationshipBreakdown[r.relationship] = (relationshipBreakdown[r.relationship] || 0) + 1;
  });

  // Current vs Former
  var currentRevs = reviews.filter(function (r) { return r.currentEmployee; });
  var formerRevs = reviews.filter(function (r) { return !r.currentEmployee; });
  function avgOfReviews(revs) {
    if (revs.length === 0) return 0;
    var rats = revs.flatMap(function (r) { return r.ratings; });
    return rats.length > 0 ? parseFloat((rats.reduce(function (s, r) { return s + r.score; }, 0) / rats.length).toFixed(2)) : 0;
  }

  // Recent score + recency
  var reviewsWithAvg = reviews.map(function (r) {
    var rats = r.ratings;
    var avg = rats.length > 0 ? rats.reduce(function (s, rt) { return s + rt.score; }, 0) / rats.length : 0;
    return { avgScore: avg, createdAt: r.createdAt };
  });
  var rScore = recentScore(reviewsWithAvg);
  var timeline = ratingTimeline(reviewsWithAvg, 12);
  var trend = detectTrend(timeline);

  return {
    avgRating: parseFloat(avgRating.toFixed(2)),
    bayesianRating: parseFloat(bScore.toFixed(2)),
    confidence: confidenceLevel(reviews.length),
    recommendPct: recommendPct,
    workAgainPct: workAgainPct,
    reviewCount: reviews.length,
    companies: Object.keys(companySet),
    topStrengths: topStrengths,
    topWeaknesses: topWeaknesses,
    categoryAvgs: categoryAvgs,
    tenureBreakdown: tenureBreakdown,
    relationshipBreakdown: relationshipBreakdown,
    currentVsFormer: {
      current: { count: currentRevs.length, avg: avgOfReviews(currentRevs) },
      former: { count: formerRevs.length, avg: avgOfReviews(formerRevs) },
    },
    recentScore: rScore.score,
    reviewRecency: { last12: rScore.recentCount, mid: rScore.midCount, old: rScore.oldCount },
    timeline: timeline,
    trend: trend,
  };
}

/**
 * GET /api/managers
 * List all managers with V2 aggregated data.
 */
router.get('/', validateSearch, async function (req, res) {
  try {
    var q = req.query.q;
    var company = req.query.company;
    var city = req.query.city;
    var department = req.query.department;
    var minRating = req.query.minRating;
    var minReviews = req.query.minReviews;
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 20;
    var sort = req.query.sort || 'rating_desc';

    var skip = (page - 1) * limit;
    var take = limit;

    var where = {
      reviews: { some: { status: 'published' } },
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { department: { contains: q, mode: 'insensitive' } },
        { reviews: { some: { company: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    if (company) {
      where.reviews = { some: { status: 'published', company: { equals: company, mode: 'insensitive' } } };
    }
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (department) where.department = { equals: department, mode: 'insensitive' };

    var managers = await prisma.manager.findMany({
      where: where,
      include: {
        reviews: {
          where: { status: 'published' },
          include: { ratings: true, _count: { select: { helpfulVotes: true } } },
        },
      },
      skip: skip,
      take: take + 1,
    });

    var hasMore = managers.length > take;
    var results = managers.slice(0, take);

    // Calculate global average for Bayesian scoring
    var allReviewRatings = await prisma.rating.aggregate({
      where: { review: { status: 'published' } },
      _avg: { score: true },
    });
    var globalAvg = allReviewRatings._avg.score || 3.5;

    var managersWithStats = results.map(function (m) {
      var stats = aggregateManagerData(m, globalAvg);
      return Object.assign({
        id: m.id,
        name: m.name,
        linkedinUrl: m.linkedinUrl,
        linkedinSlug: m.linkedinSlug,
        city: m.city,
        department: m.department,
        title: m.title,
        createdAt: m.createdAt,
      }, stats);
    });

    // Post-aggregation filters
    if (minRating) {
      managersWithStats = managersWithStats.filter(function (m) { return m.avgRating >= parseFloat(minRating); });
    }
    if (minReviews) {
      managersWithStats = managersWithStats.filter(function (m) { return m.reviewCount >= parseInt(minReviews, 10); });
    }

    // Sort
    if (sort === 'rating_desc') managersWithStats.sort(function (a, b) { return b.bayesianRating - a.bayesianRating; });
    else if (sort === 'rating_asc') managersWithStats.sort(function (a, b) { return a.bayesianRating - b.bayesianRating; });
    else if (sort === 'reviews_desc') managersWithStats.sort(function (a, b) { return b.reviewCount - a.reviewCount; });
    else if (sort === 'work_again') managersWithStats.sort(function (a, b) { return b.workAgainPct - a.workAgainPct; });

    res.json({
      managers: managersWithStats,
      pagination: { page: page, limit: take, hasMore: hasMore },
    });
  } catch (error) {
    console.error('GET /api/managers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/managers/:id
 * Manager profile with ALL V2 data + reviews grouped by company + manager responses.
 */
router.get('/:id', validateUUID, async function (req, res) {
  try {
    var manager = await prisma.manager.findUnique({
      where: { id: req.params.id },
      include: {
        reviews: {
          where: { status: 'published' },
          include: {
            ratings: true,
            _count: { select: { helpfulVotes: true } },
            evolutions: { include: { updatedReview: { select: { id: true, createdAt: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
        responses: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!manager) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    // Global avg for Bayesian
    var allReviewRatings = await prisma.rating.aggregate({
      where: { review: { status: 'published' } },
      _avg: { score: true },
    });
    var globalAvg = allReviewRatings._avg.score || 3.5;

    var stats = aggregateManagerData(manager, globalAvg);

    // Group reviews by company
    var reviewsByCompany = {};
    manager.reviews.forEach(function (review) {
      if (!reviewsByCompany[review.company]) reviewsByCompany[review.company] = [];
      reviewsByCompany[review.company].push({
        id: review.id,
        company: review.company,
        recommends: review.recommends,
        pros: review.pros,
        cons: review.cons,
        advice: review.advice,
        ratings: Object.fromEntries(review.ratings.map(function (r) { return [r.category, r.score]; })),
        helpfulCount: review._count.helpfulVotes,
        tenure: review.tenure,
        relationship: review.relationship,
        currentEmployee: review.currentEmployee,
        workAgain: review.workAgain,
        strengths: review.strengths,
        weaknesses: review.weaknesses,
        verificationStatus: review.verificationStatus,
        createdAt: review.createdAt,
        hasEvolution: review.evolutions.length > 0,
      });
    });

    // Manager responses indexed by reviewId
    var responses = {};
    manager.responses.forEach(function (resp) {
      var key = resp.reviewId || 'general';
      if (!responses[key]) responses[key] = [];
      responses[key].push({
        id: resp.id,
        content: resp.content,
        verifiedManager: resp.verifiedManager,
        createdAt: resp.createdAt,
      });
    });

    res.json(Object.assign({
      id: manager.id,
      name: manager.name,
      linkedinUrl: manager.linkedinUrl,
      linkedinSlug: manager.linkedinSlug,
      city: manager.city,
      department: manager.department,
      title: manager.title,
      reviewsByCompany: reviewsByCompany,
      managerResponses: responses,
    }, stats));

  } catch (error) {
    console.error('GET /api/managers/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/managers/slug/:slug
 * Lookup by LinkedIn slug — returns JSON (no redirect, no UUID leak).
 */
router.get('/slug/:slug', slugLimiter, async function (req, res) {
  try {
    var slug = req.params.slug.toLowerCase().replace(/[^a-z0-9\-]/g, '');
    var manager = await prisma.manager.findUnique({
      where: { linkedinSlug: slug },
      select: { id: true, name: true, linkedinSlug: true, city: true, department: true, title: true },
    });

    if (!manager) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    res.json(manager);
  } catch (error) {
    console.error('GET /api/managers/slug/:slug error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/managers/:id/respond
 * Manager can respond to reviews (cannot delete them).
 */
router.post('/:id/respond', validateUUID, validateManagerResponse, async function (req, res) {
  try {
    var managerId = req.params.id;
    var content = sanitizeText(req.body.content);
    var reviewId = req.body.reviewId || null;

    // Verify manager exists
    var manager = await prisma.manager.findUnique({ where: { id: managerId } });
    if (!manager) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    // If responding to a specific review, verify it exists and belongs to this manager
    if (reviewId) {
      var review = await prisma.review.findFirst({
        where: { id: reviewId, managerId: managerId, status: 'published' },
      });
      if (!review) {
        return res.status(404).json({ error: 'Review not found for this manager' });
      }
    }

    var response = await prisma.managerResponse.create({
      data: {
        managerId: managerId,
        reviewId: reviewId,
        content: content,
        verifiedManager: false, // Future: LinkedIn OAuth verification
      },
    });

    res.status(201).json({
      success: true,
      message: 'Response posted successfully.',
      responseId: response.id,
    });

  } catch (error) {
    console.error('POST /api/managers/:id/respond error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

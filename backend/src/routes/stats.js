// ==========================================
// Stats Routes — GET /api/stats (Dashboard)
// ==========================================

const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { CATEGORIES } = require('../config/categories');

/**
 * GET /api/stats
 * Dashboard statistics — aggregated overview.
 */
router.get('/', async (req, res) => {
  try {
    // Total counts
    const [managerCount, reviewCount, companyResult] = await Promise.all([
      prisma.manager.count(),
      prisma.review.count({ where: { status: 'published' } }),
      prisma.review.findMany({
        where: { status: 'published' },
        select: { company: true },
        distinct: ['company'],
      }),
    ]);

    // Average rating and recommend %
    const allRatings = await prisma.rating.findMany({
      where: { review: { status: 'published' } },
    });

    const avgRating = allRatings.length > 0
      ? parseFloat((allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length).toFixed(2))
      : 0;

    // Recommend percentage
    const reviews = await prisma.review.findMany({
      where: { status: 'published' },
      select: { recommends: true },
    });
    const recommendPct = reviews.length > 0
      ? Math.round(reviews.filter(r => r.recommends).length / reviews.length * 100)
      : 0;

    // Per-category averages
    const categoryAvgs = {};
    CATEGORIES.forEach(cat => {
      const scores = allRatings.filter(r => r.category === cat).map(r => r.score);
      categoryAvgs[cat] = scores.length > 0
        ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
        : 0;
    });

    // Rating distribution (1-5 stars)
    const distribution = [0, 0, 0, 0, 0];
    // Group ratings by review to get per-review averages
    const reviewRatings = {};
    allRatings.forEach(r => {
      if (!reviewRatings[r.reviewId]) reviewRatings[r.reviewId] = [];
      reviewRatings[r.reviewId].push(r.score);
    });
    Object.values(reviewRatings).forEach(scores => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const bucket = Math.min(4, Math.max(0, Math.floor(avg) - 1));
      distribution[bucket]++;
    });

    // Top rated managers
    const topManagers = await prisma.manager.findMany({
      include: {
        reviews: {
          where: { status: 'published' },
          include: { ratings: true },
        },
      },
    });

    const topRated = topManagers
      .filter(m => m.reviews.length > 0)
      .map(m => {
        const ratings = m.reviews.flatMap(r => r.ratings);
        const avg = ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
        return { name: m.name, avgRating: parseFloat(avg.toFixed(2)), reviewCount: m.reviews.length };
      })
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 10);

    res.json({
      managerCount,
      reviewCount,
      companyCount: companyResult.length,
      avgRating,
      recommendPct,
      categoryAvgs,
      distribution,
      topManagers: topRated,
    });

  } catch (error) {
    console.error('GET /api/stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

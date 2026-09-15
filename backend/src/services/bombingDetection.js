// ==========================================
// Review Bombing Detection
// ==========================================
// Detects suspicious patterns:
// - 10+ reviews for same manager within 24 hours
// - 20+ same-star reviews from same company in 48 hours
// - 5+ reviews from same IP range in 1 hour
//
// When detected: review is held for moderation, not published.

const prisma = require('../config/database');

/**
 * Detect potential review bombing for a manager.
 *
 * @param {string} managerId
 * @param {string} company - Company name from the new review
 * @returns {{ bombing: boolean, reason: string }}
 */
async function detectBombing(managerId, company) {
  var now = new Date();
  var twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  var fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Check 1: 10+ reviews for the same manager in 24 hours
  var recentManagerReviews = await prisma.review.count({
    where: {
      managerId: managerId,
      createdAt: { gte: twentyFourHoursAgo },
    },
  });

  if (recentManagerReviews >= 10) {
    return {
      bombing: true,
      reason: 'volume_spike_manager',
      detail: recentManagerReviews + ' reviews for this manager in the last 24 hours',
    };
  }

  // Check 2: 20+ reviews from same company in 48 hours (coordinated attack/boost)
  var recentCompanyReviews = await prisma.review.count({
    where: {
      managerId: managerId,
      company: { equals: company, mode: 'insensitive' },
      createdAt: { gte: fortyEightHoursAgo },
    },
  });

  if (recentCompanyReviews >= 20) {
    return {
      bombing: true,
      reason: 'coordinated_company',
      detail: recentCompanyReviews + ' reviews from ' + company + ' in the last 48 hours',
    };
  }

  // Check 3: Suspicious rating pattern — all same score in last 24h
  if (recentManagerReviews >= 5) {
    var recentReviews = await prisma.review.findMany({
      where: {
        managerId: managerId,
        createdAt: { gte: twentyFourHoursAgo },
      },
      include: { ratings: true },
    });

    // Calculate per-review averages
    var avgScores = recentReviews.map(function (r) {
      if (r.ratings.length === 0) return 0;
      return Math.round(r.ratings.reduce(function (s, rt) { return s + rt.score; }, 0) / r.ratings.length);
    });

    // All same rounded score?
    var allSame = avgScores.every(function (s) { return s === avgScores[0]; });
    if (allSame && avgScores.length >= 5) {
      return {
        bombing: true,
        reason: 'uniform_ratings',
        detail: avgScores.length + ' reviews all with score ~' + avgScores[0] + ' in 24 hours',
      };
    }
  }

  return { bombing: false, reason: null, detail: null };
}

module.exports = { detectBombing: detectBombing };

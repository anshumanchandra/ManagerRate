// ==========================================
// Bayesian / Wilson Scoring + Confidence
// ==========================================
// Don't use simple averages — they're misleading.
// 5 reviews at 5.0 should NOT outrank 2000 reviews at 4.6.

/**
 * Bayesian weighted score.
 * Pulls low-review-count items toward the global average.
 *
 * Formula: (v/(v+m)) * R + (m/(v+m)) * C
 * Where:
 *   R = item's average rating
 *   v = number of votes for the item
 *   m = minimum votes to be listed (tunable, default 5)
 *   C = overall average rating across all items (prior)
 *
 * @param {number} itemAvg - This manager's average rating
 * @param {number} itemCount - Number of reviews for this manager
 * @param {number} globalAvg - Average rating across ALL managers
 * @param {number} minVotes - Minimum votes threshold (default 5)
 * @returns {number} Bayesian-adjusted score
 */
function bayesianScore(itemAvg, itemCount, globalAvg, minVotes) {
  minVotes = minVotes || 5;
  if (itemCount === 0) return 0;
  return (itemCount / (itemCount + minVotes)) * itemAvg +
         (minVotes / (itemCount + minVotes)) * globalAvg;
}

/**
 * Confidence level based on review count.
 * Determines how much to trust the displayed score.
 *
 * @param {number} reviewCount
 * @returns {string} 'insufficient' | 'provisional' | 'shown' | 'high_confidence'
 */
function confidenceLevel(reviewCount) {
  if (reviewCount <= 2) return 'insufficient';
  if (reviewCount <= 4) return 'provisional';
  if (reviewCount <= 9) return 'shown';
  return 'high_confidence';
}

/**
 * Recent-weighted score.
 * Reviews from the last 12 months get 2x weight.
 * Reviews from 1-2 years get 1x weight.
 * Reviews from 2+ years get 0.5x weight.
 *
 * @param {Array} reviews - Array of { avgScore, createdAt }
 * @returns {{ score: number, recentCount: number, midCount: number, oldCount: number }}
 */
function recentScore(reviews) {
  if (!reviews || reviews.length === 0) {
    return { score: 0, recentCount: 0, midCount: 0, oldCount: 0 };
  }

  var now = Date.now();
  var oneYear = 365 * 24 * 60 * 60 * 1000;
  var twoYears = 2 * oneYear;

  var weightedSum = 0;
  var totalWeight = 0;
  var recentCount = 0;
  var midCount = 0;
  var oldCount = 0;

  reviews.forEach(function (r) {
    var age = now - new Date(r.createdAt).getTime();
    var weight;

    if (age < oneYear) {
      weight = 2.0;
      recentCount++;
    } else if (age < twoYears) {
      weight = 1.0;
      midCount++;
    } else {
      weight = 0.5;
      oldCount++;
    }

    weightedSum += r.avgScore * weight;
    totalWeight += weight;
  });

  return {
    score: totalWeight > 0 ? parseFloat((weightedSum / totalWeight).toFixed(2)) : 0,
    recentCount: recentCount,
    midCount: midCount,
    oldCount: oldCount,
  };
}

/**
 * Calculate rating timeline — monthly averages for the last N months.
 *
 * @param {Array} reviews - Array of { avgScore, createdAt }
 * @param {number} months - How many months back (default 12)
 * @returns {Array} [{ month: 'Jan 2026', avg: 4.2, count: 3 }, ...]
 */
function ratingTimeline(reviews, months) {
  months = months || 12;
  if (!reviews || reviews.length === 0) return [];

  var buckets = {};
  var now = new Date();

  reviews.forEach(function (r) {
    var d = new Date(r.createdAt);
    var monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsAgo < months) {
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
      buckets[key].sum += r.avgScore;
      buckets[key].count++;
    }
  });

  var moNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return Object.keys(buckets).sort().map(function (key) {
    var parts = key.split('-');
    return {
      month: moNames[parseInt(parts[1], 10) - 1] + ' ' + parts[0],
      avg: parseFloat((buckets[key].sum / buckets[key].count).toFixed(2)),
      count: buckets[key].count,
    };
  });
}

/**
 * Detect rating trend direction from timeline data.
 *
 * @param {Array} timeline - Output of ratingTimeline()
 * @returns {string} 'improving' | 'declining' | 'stable' | 'insufficient_data'
 */
function detectTrend(timeline) {
  if (!timeline || timeline.length < 3) return 'insufficient_data';

  // Simple linear regression on the last entries
  var n = timeline.length;
  var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (var i = 0; i < n; i++) {
    sumX += i;
    sumY += timeline[i].avg;
    sumXY += i * timeline[i].avg;
    sumX2 += i * i;
  }

  var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  if (slope > 0.05) return 'improving';
  if (slope < -0.05) return 'declining';
  return 'stable';
}

module.exports = {
  bayesianScore: bayesianScore,
  confidenceLevel: confidenceLevel,
  recentScore: recentScore,
  ratingTimeline: ratingTimeline,
  detectTrend: detectTrend,
};

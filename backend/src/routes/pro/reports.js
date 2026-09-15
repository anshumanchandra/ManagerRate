// ==========================================
// Pro API — Leadership Report Generation
// ==========================================

const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const prisma = require('../../config/database');
const { CATEGORIES } = require('../../config/categories');
const { apiAuth, requirePlan } = require('../../middleware/apiAuth');
const { handleValidationErrors } = require('../../middleware/validate');

// All routes require reports:read permission
router.use(apiAuth('reports:read'));

// ——— Shared constants ———————————————————————————————————————
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Industry benchmark averages (mock data — replace with real aggregates in production)
const INDUSTRY_BENCHMARKS = {
  'Leadership & Vision': 3.62,
  'Communication Skills': 3.48,
  'Career Development Support': 3.31,
  'Work-Life Balance': 3.55,
  'Fairness & Transparency': 3.42,
  'Conflict Resolution': 3.28,
  'Empathy & Emotional Intelligence': 3.39,
  'Decision Making': 3.51,
  'Team Building': 3.45,
  'Accountability': 3.57,
  'Technical Competence': 3.68,
};

// Positive/negative word lists for basic sentiment analysis
const POSITIVE_WORDS = new Set([
  'excellent', 'great', 'amazing', 'fantastic', 'supportive', 'clear', 'transparent',
  'empathetic', 'helpful', 'inspiring', 'strong', 'fair', 'respectful', 'thoughtful',
  'collaborative', 'innovative', 'dedicated', 'patient', 'organized', 'honest',
  'trustworthy', 'visionary', 'encouraging', 'available', 'listens', 'mentor',
  'advocate', 'genuine', 'approachable', 'growth', 'balanced', 'effective',
]);

const NEGATIVE_WORDS = new Set([
  'poor', 'terrible', 'awful', 'toxic', 'micromanager', 'unfair', 'dishonest',
  'unavailable', 'ignore', 'dismissive', 'favoritism', 'burnout', 'bottleneck',
  'indecisive', 'unclear', 'inconsistent', 'aggressive', 'arrogant', 'lazy',
  'disrespectful', 'hostile', 'unprofessional', 'blame', 'backstab', 'politics',
  'manipulative', 'incompetent', 'absent', 'chaotic', 'overwork',
]);

/**
 * Basic sentiment analysis — count positive/negative/neutral words.
 */
function analyzeSentiment(text) {
  if (!text) return { positive: 0, negative: 0, neutral: 0, score: 0 };
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  let positive = 0, negative = 0;
  words.forEach(w => {
    if (POSITIVE_WORDS.has(w)) positive++;
    if (NEGATIVE_WORDS.has(w)) negative++;
  });
  const neutral = words.length - positive - negative;
  const total = positive + negative || 1;
  const score = parseFloat(((positive - negative) / total).toFixed(2)); // -1 to +1
  return { positive, negative, neutral, score };
}

/**
 * Extract word frequencies for word cloud.
 */
function extractWordCloud(texts, topN = 30) {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'about', 'between', 'under', 'above', 'and', 'but',
    'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each',
    'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because',
    'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you',
    'your', 'he', 'she', 'it', 'they', 'them', 'their', 'what', 'which',
    'who', 'whom', 'when', 'where', 'why', 'how', 'if', 'then', 'also',
  ]);

  const freq = {};
  texts.forEach(text => {
    if (!text) return;
    text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).forEach(w => {
      if (w.length > 2 && !stopWords.has(w)) {
        freq[w] = (freq[w] || 0) + 1;
      }
    });
  });

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}

/**
 * GET /api/pro/reports/:managerId
 * Generate comprehensive leadership report.
 */
router.get('/:managerId',
  [
    param('managerId')
      .trim()
      .matches(UUID_REGEX).withMessage('managerId must be a valid UUID'),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const manager = await prisma.manager.findUnique({
        where: { id: req.params.managerId },
        include: {
          reviews: {
            where: { status: 'published' },
            include: {
              ratings: true,
              _count: { select: { helpfulVotes: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!manager) {
        return res.status(404).json({ error: 'Manager not found' });
      }

      if (manager.reviews.length === 0) {
        return res.status(404).json({ error: 'No published reviews for this manager' });
      }

      const allRatings = manager.reviews.flatMap(r => r.ratings);

      // —— Overall Score ——
      const overallScore = parseFloat(
        (allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length).toFixed(2)
      );

      // —— Ranking Percentile (mock: based on overall score relative to 1-5 range) ——
      // In production, compute against all managers in DB
      const totalManagers = await prisma.manager.count();
      const managersBelow = await prisma.manager.count({
        where: {
          reviews: { some: { status: 'published' } },
          // This is approximate; real percentile needs aggregation
        },
      });
      const percentile = Math.min(99, Math.round((overallScore / 5) * 100));

      // —— Per-Category Scores vs Benchmarks ——
      const categoryAnalysis = CATEGORIES.map(cat => {
        const scores = allRatings.filter(r => r.category === cat).map(r => r.score);
        const avg = scores.length > 0
          ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
          : 0;
        const benchmark = INDUSTRY_BENCHMARKS[cat] || 3.5;
        const diff = parseFloat((avg - benchmark).toFixed(2));

        return {
          category: cat,
          score: avg,
          benchmark,
          difference: diff,
          status: diff >= 0.5 ? 'above_average' : diff >= -0.5 ? 'average' : 'below_average',
        };
      });

      // —— Strengths & Improvement Areas ——
      const sortedCats = [...categoryAnalysis].sort((a, b) => b.score - a.score);
      const strengths = sortedCats.slice(0, 3);
      const improvementAreas = sortedCats.slice(-3).reverse();

      // —— Sentiment Analysis ——
      const allPros = manager.reviews.map(r => r.pros);
      const allCons = manager.reviews.map(r => r.cons);
      const prosSentiment = analyzeSentiment(allPros.join(' '));
      const consSentiment = analyzeSentiment(allCons.join(' '));
      const overallSentiment = parseFloat(
        ((prosSentiment.score + consSentiment.score) / 2).toFixed(2)
      );

      // —— Monthly Trend ——
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
        monthlyTrend.push({
          month: monthStart.toISOString().slice(0, 7),
          avgRating: monthRatings.length > 0
            ? parseFloat((monthRatings.reduce((s, r) => s + r.score, 0) / monthRatings.length).toFixed(2))
            : null,
          reviewCount: monthReviews.length,
          recommendPct: monthReviews.length > 0
            ? Math.round(monthReviews.filter(r => r.recommends).length / monthReviews.length * 100)
            : null,
        });
      }

      // —— Trend Direction ——
      const withData = monthlyTrend.filter(m => m.avgRating !== null);
      let trendDirection = 'stable';
      if (withData.length >= 3) {
        const recent = withData.slice(-3);
        const first = recent[0].avgRating;
        const last = recent[recent.length - 1].avgRating;
        if (last - first > 0.3) trendDirection = 'improving';
        else if (first - last > 0.3) trendDirection = 'declining';
      }

      // —— Company Breakdown ——
      const companyBreakdown = {};
      manager.reviews.forEach(r => {
        if (!companyBreakdown[r.company]) {
          companyBreakdown[r.company] = { reviews: [], ratings: [] };
        }
        companyBreakdown[r.company].reviews.push(r);
        companyBreakdown[r.company].ratings.push(...r.ratings);
      });

      const companyAnalysis = Object.entries(companyBreakdown).map(([company, data]) => ({
        company,
        reviewCount: data.reviews.length,
        avgRating: parseFloat(
          (data.ratings.reduce((s, r) => s + r.score, 0) / data.ratings.length).toFixed(2)
        ),
        recommendPct: Math.round(
          data.reviews.filter(r => r.recommends).length / data.reviews.length * 100
        ),
        dateRange: {
          from: data.reviews[0]?.createdAt,
          to: data.reviews[data.reviews.length - 1]?.createdAt,
        },
      }));

      // —— Recommendation Rate Trend ——
      const recommendTrend = monthlyTrend.map(m => ({
        month: m.month,
        recommendPct: m.recommendPct,
      }));

      // —— Word Cloud ——
      const prosWords = extractWordCloud(allPros, 20);
      const consWords = extractWordCloud(allCons, 20);

      // —— Red Flags ——
      const redFlags = categoryAnalysis
        .filter(c => c.score > 0 && c.score < 2.5)
        .map(c => ({
          category: c.category,
          score: c.score,
          severity: c.score < 2.0 ? 'critical' : 'warning',
          message: `Consistently low rating in ${c.category} (${c.score}/5)`,
        }));

      // Also flag declining trend
      if (trendDirection === 'declining') {
        redFlags.push({
          category: 'Overall Trend',
          score: null,
          severity: 'warning',
          message: 'Overall ratings have been declining over the past 3 months',
        });
      }

      // Low recommendation rate
      const overallRecommendPct = Math.round(
        manager.reviews.filter(r => r.recommends).length / manager.reviews.length * 100
      );
      if (overallRecommendPct < 40) {
        redFlags.push({
          category: 'Recommendation Rate',
          score: overallRecommendPct,
          severity: overallRecommendPct < 25 ? 'critical' : 'warning',
          message: `Only ${overallRecommendPct}% of reviewers recommend this manager`,
        });
      }

      // —— Build Report ——
      const report = {
        generatedAt: new Date().toISOString(),
        manager: {
          id: manager.id,
          name: manager.name,
          linkedinUrl: manager.linkedinUrl,
          companies: companyAnalysis.map(c => c.company),
        },
        summary: {
          overallScore,
          percentile,
          totalReviews: manager.reviews.length,
          recommendPct: overallRecommendPct,
          trendDirection,
          redFlagCount: redFlags.length,
        },
        categoryAnalysis,
        strengths,
        improvementAreas,
        sentiment: {
          overall: overallSentiment,
          pros: prosSentiment,
          cons: consSentiment,
        },
        monthlyTrend,
        recommendTrend,
        companyAnalysis,
        wordCloud: { pros: prosWords, cons: consWords },
        redFlags,
      };

      res.json(report);
    } catch (error) {
      console.error('Pro GET /reports/:managerId error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/pro/reports/:managerId/pdf
 * Same report data, structured for PDF rendering by the client.
 * Includes formatted strings and section markers.
 */
router.get('/:managerId/pdf',
  requirePlan(['growth', 'enterprise']),
  [
    param('managerId')
      .trim()
      .matches(UUID_REGEX).withMessage('managerId must be a valid UUID'),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      // Reuse the main report endpoint logic
      // In production, this could be a cached/pre-rendered version
      const manager = await prisma.manager.findUnique({
        where: { id: req.params.managerId },
      });

      if (!manager) {
        return res.status(404).json({ error: 'Manager not found' });
      }

      // Return a PDF-friendly structure
      res.json({
        format: 'pdf_data',
        title: `Leadership Report: ${manager.name}`,
        subtitle: `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        reportEndpoint: `/api/pro/reports/${req.params.managerId}`,
        instructions: 'Fetch the main report endpoint for full data. Use this structure for PDF layout.',
        sections: [
          { id: 'summary', title: 'Executive Summary', type: 'kpi_cards' },
          { id: 'categories', title: 'Category Analysis', type: 'bar_chart' },
          { id: 'strengths', title: 'Strengths & Improvement Areas', type: 'two_column' },
          { id: 'trend', title: 'Rating Trend (12 Months)', type: 'line_chart' },
          { id: 'sentiment', title: 'Sentiment Analysis', type: 'gauge' },
          { id: 'companies', title: 'Company-by-Company Breakdown', type: 'table' },
          { id: 'wordcloud', title: 'Key Themes', type: 'word_cloud' },
          { id: 'redflags', title: 'Red Flags & Alerts', type: 'alert_list' },
        ],
      });
    } catch (error) {
      console.error('Pro GET /reports/:managerId/pdf error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;

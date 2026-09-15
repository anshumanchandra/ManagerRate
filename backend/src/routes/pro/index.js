// ==========================================
// Pro API — Route Index
// ==========================================
// Mounts all Pro tier routes under /api/pro
// Each sub-router applies its own apiAuth middleware
// with the appropriate permission requirement.

const express = require('express');
const { header, query } = require('express-validator');
const router = express.Router();
const { handleValidationErrors } = require('../../middleware/validate');

const proDashboardRoutes = require('./dashboard');
const proManagerRoutes = require('./managers');
const proReportRoutes = require('./reports');
const proStatsRoutes = require('./stats');

// ——— Global API key format validation for all /api/pro/* routes ———
// The apiAuth middleware does the actual auth; this catches obviously
// malformed keys early with a clear 400 instead of a generic 401.
router.use([
  header('x-api-key')
    .if(header('x-api-key').exists())
    .trim()
    .isLength({ min: 20, max: 128 }).withMessage('API key must be 20-128 characters')
    .matches(/^[a-zA-Z0-9_\-]+$/).withMessage('API key contains invalid characters'),
  query('api_key')
    .if(query('api_key').exists())
    .trim()
    .isLength({ min: 20, max: 128 }).withMessage('API key must be 20-128 characters')
    .matches(/^[a-zA-Z0-9_\-]+$/).withMessage('API key contains invalid characters'),
  handleValidationErrors,
]);

// Mount sub-routes
router.use('/dashboard', proDashboardRoutes);
router.use('/managers', proManagerRoutes);
router.use('/reports', proReportRoutes);
router.use('/stats', proStatsRoutes);

// Pro API docs / overview
router.get('/', (req, res) => {
  res.json({
    name: 'ManagerRate Pro API',
    version: '1.0.0',
    docs: 'https://managerrate.com/docs/api',
    endpoints: {
      dashboard: {
        'GET /api/pro/dashboard/overview': 'Company-wide KPIs and top/lowest managers',
        'GET /api/pro/dashboard/managers': 'All reviewed managers at your company with trends',
        'GET /api/pro/dashboard/trends': 'Monthly rating trends for the last 12 months',
        'GET /api/pro/dashboard/alerts': 'Concerning patterns flagged for your company',
        'GET /api/pro/dashboard/export': 'Export all company review data as JSON',
      },
      managers: {
        'GET /api/pro/managers': 'Enhanced manager search with advanced filters',
        'GET /api/pro/managers/:id/full': 'Full detailed profile with trends & stats',
        'GET /api/pro/managers/compare?ids=a,b,c': 'Compare 2-5 managers side by side',
        'POST /api/pro/managers/search/bulk': 'Bulk search by LinkedIn slugs (up to 50)',
      },
      reports: {
        'GET /api/pro/reports/:managerId': 'Comprehensive leadership report',
        'GET /api/pro/reports/:managerId/pdf': 'PDF-formatted report data',
      },
      stats: {
        'GET /api/pro/stats/industry': 'Industry-wide benchmarks by category',
        'GET /api/pro/stats/trends': 'Rating trends over 12 months',
        'GET /api/pro/stats/companies': 'Company leaderboard by manager ratings',
        'GET /api/pro/stats/categories': 'Deep dive into each rating category',
      },
    },
    authentication: {
      method: 'API Key',
      header: 'X-API-Key: your_api_key',
      alternative: '?api_key=your_api_key',
    },
    plans: {
      starter: { price: '$99/mo', rateLimit: '1,000/hr', features: ['Manager search', 'Reports (10/mo)'] },
      growth: { price: '$499/mo', rateLimit: '5,000/hr', features: ['Everything in Starter', 'Company Dashboard', 'Bulk search', 'Unlimited reports'] },
      enterprise: { price: 'Custom', rateLimit: '50,000/hr', features: ['Everything in Growth', 'Export', 'Priority support', 'Custom integrations'] },
    },
  });
});

module.exports = router;

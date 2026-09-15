// ==========================================
// Request Validation V2 — All Review Fields
// ==========================================

const { body, param, query, validationResult } = require('express-validator');
const {
  CATEGORIES, STRENGTHS, WEAKNESSES,
  TENURE_VALUES, RELATIONSHIP_VALUES, WORK_AGAIN_VALUES,
} = require('../config/categories');

/**
 * Handle validation errors — return 400 with details.
 */
function handleValidation(req, res, next) {
  var errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(function (e) {
        return { field: e.path, message: e.msg };
      }),
    });
  }
  next();
}

/**
 * Validate review submission (V2 — all fields).
 */
var validateReview = [
  // Manager identity
  body('managerName')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Manager name must be 2-200 characters')
    .matches(/^[\p{L}\p{M}\s'\-\.]{2,200}$/u)
    .withMessage('Manager name contains invalid characters'),

  body('company')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Company name must be 2-200 characters'),

  body('linkedinUrl')
    .trim()
    .matches(/^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-]{3,100}\/?$/)
    .withMessage('Invalid LinkedIn URL format'),

  // Optional manager location/dept
  body('city')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 })
    .withMessage('City must be under 100 characters'),

  body('department')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department must be under 100 characters'),

  body('managerTitle')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title must be under 200 characters'),

  // Ratings
  body('ratings')
    .isObject()
    .withMessage('Ratings must be an object')
    .custom(function (ratings) {
      for (var i = 0; i < CATEGORIES.length; i++) {
        var cat = CATEGORIES[i];
        if (!(cat in ratings)) {
          throw new Error('Missing rating for: ' + cat);
        }
        var score = ratings[cat];
        if (!Number.isInteger(score) || score < 1 || score > 5) {
          throw new Error('Rating for "' + cat + '" must be 1-5');
        }
      }
      var extraKeys = Object.keys(ratings).filter(function (k) {
        return CATEGORIES.indexOf(k) === -1;
      });
      if (extraKeys.length > 0) {
        throw new Error('Unknown rating categories: ' + extraKeys.join(', '));
      }
      return true;
    }),

  body('recommends')
    .isBoolean()
    .withMessage('Recommends must be true or false'),

  // V2: Experience context
  body('tenure')
    .isIn(TENURE_VALUES)
    .withMessage('Invalid tenure value. Must be one of: ' + TENURE_VALUES.join(', ')),

  body('relationship')
    .isIn(RELATIONSHIP_VALUES)
    .withMessage('Invalid relationship value. Must be one of: ' + RELATIONSHIP_VALUES.join(', ')),

  body('currentEmployee')
    .isBoolean()
    .withMessage('currentEmployee must be true or false'),

  body('workAgain')
    .isIn(WORK_AGAIN_VALUES)
    .withMessage('Invalid workAgain value. Must be one of: ' + WORK_AGAIN_VALUES.join(', ')),

  // V2: Strengths & Weaknesses
  body('strengths')
    .isArray({ min: 3, max: 5 })
    .withMessage('Select 3-5 strengths')
    .custom(function (strengths) {
      var invalid = strengths.filter(function (s) { return STRENGTHS.indexOf(s) === -1; });
      if (invalid.length > 0) {
        throw new Error('Invalid strengths: ' + invalid.join(', '));
      }
      return true;
    }),

  body('weaknesses')
    .isArray({ min: 3, max: 5 })
    .withMessage('Select 3-5 weaknesses')
    .custom(function (weaknesses) {
      var invalid = weaknesses.filter(function (w) { return WEAKNESSES.indexOf(w) === -1; });
      if (invalid.length > 0) {
        throw new Error('Invalid weaknesses: ' + invalid.join(', '));
      }
      return true;
    }),

  // Text fields
  body('pros')
    .trim()
    .isLength({ min: 30, max: 5000 })
    .withMessage('Pros must be 30-5000 characters'),

  body('cons')
    .trim()
    .isLength({ min: 30, max: 5000 })
    .withMessage('Cons must be 30-5000 characters'),

  body('advice')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 3000 })
    .withMessage('Advice must be under 3000 characters'),

  handleValidation,
];

/**
 * Validate report submission.
 */
var validateReport = [
  body('reason')
    .isIn(['spam', 'defamatory', 'fake', 'inappropriate', 'personal_attack', 'threat', 'other'])
    .withMessage('Invalid report reason'),

  body('details')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Details must be under 1000 characters'),

  handleValidation,
];

/**
 * Validate query params for manager search (V2 — with city/dept).
 */
var validateSearch = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query too long'),

  query('company')
    .optional()
    .trim()
    .isLength({ max: 200 }),

  query('city')
    .optional()
    .trim()
    .isLength({ max: 100 }),

  query('department')
    .optional()
    .trim()
    .isLength({ max: 100 }),

  query('minRating')
    .optional()
    .isFloat({ min: 1, max: 5 }),

  query('minReviews')
    .optional()
    .isInt({ min: 1, max: 10000 }),

  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 }),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }),

  handleValidation,
];

/**
 * Validate UUID params.
 */
var validateUUID = [
  param('id').isUUID().withMessage('Invalid ID format'),
  handleValidation,
];

/**
 * Validate manager response.
 */
var validateManagerResponse = [
  body('content')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Response must be 10-2000 characters'),

  body('reviewId')
    .optional({ values: 'falsy' })
    .isUUID()
    .withMessage('Invalid review ID format'),

  handleValidation,
];

module.exports = {
  validateReview: validateReview,
  validateReport: validateReport,
  validateSearch: validateSearch,
  validateUUID: validateUUID,
  validateManagerResponse: validateManagerResponse,
  handleValidation: handleValidation,
};

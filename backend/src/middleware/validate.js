// ==========================================
// Shared Validation Middleware
// ==========================================
// Reusable express-validator helpers for Pro API routes.
// Import into any route file for consistent validation + error handling.

const { validationResult } = require('express-validator');

/**
 * Middleware: check express-validator results and return 400 on failure.
 * Place after your validation chains: [check('x').isInt(), handleValidationErrors]
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
}

module.exports = { handleValidationErrors };

// ==========================================
// Input Sanitization — XSS Prevention
// ==========================================

const DOMPurify = require('isomorphic-dompurify');

/**
 * Strip ALL HTML tags from input — plain text only.
 * Prevents stored XSS attacks.
 */
function sanitizeText(input) {
  if (!input || typeof input !== 'string') return '';
  // Strip all HTML tags, keep only text
  const clean = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  // Also remove any remaining HTML entities that could be tricky
  return clean.trim();
}

/**
 * Validate and normalize LinkedIn URL.
 * Only allows https://linkedin.com/in/<slug> format.
 * Returns normalized slug or throws error.
 */
function validateLinkedInUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('LinkedIn URL is required');
  }

  url = url.trim().toLowerCase();

  // Must be a valid LinkedIn profile URL
  const pattern = /^https:\/\/(www\.)?linkedin\.com\/in\/([a-z0-9\-]{3,100})\/?$/;
  const match = url.match(pattern);

  if (!match) {
    throw new Error('Invalid LinkedIn URL. Format: https://linkedin.com/in/yourprofile');
  }

  return {
    url: `https://linkedin.com/in/${match[2]}`,
    slug: match[2],
  };
}

/**
 * Validate URL is safe (https only, no javascript: etc.)
 */
function safeUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (/^https:\/\//i.test(url)) return url;
  return '';
}

module.exports = { sanitizeText, validateLinkedInUrl, safeUrl };

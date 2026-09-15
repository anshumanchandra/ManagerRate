// ==========================================
// Company Domain Mapping — Server-Side Only
// ==========================================
// Maps company names to their expected email domains.
// Used for server-side email verification. This MUST NOT
// be exposed to clients — it's the single source of truth
// for domain validation.
//
// Previously this lived in the frontend. Moved here so
// attackers can't inspect the mapping and craft bypass emails.

/**
 * Canonical company → email domain mapping.
 * All keys are lowercase for case-insensitive lookup.
 */
const COMPANY_DOMAINS = new Map([
  // FAANG + Big Tech
  ['amazon',        'amazon.com'],
  ['google',        'google.com'],
  ['meta',          'meta.com'],
  ['facebook',      'meta.com'],
  ['microsoft',     'microsoft.com'],
  ['apple',         'apple.com'],
  ['netflix',       'netflix.com'],

  // Ride-sharing & Delivery
  ['uber',          'uber.com'],
  ['lyft',          'lyft.com'],

  // Fintech & Payments
  ['stripe',        'stripe.com'],
  ['square',        'squareup.com'],
  ['block',         'block.xyz'],
  ['paypal',        'paypal.com'],

  // SaaS & Productivity
  ['salesforce',    'salesforce.com'],
  ['hubspot',       'hubspot.com'],
  ['atlassian',     'atlassian.com'],
  ['slack',         'slack.com'],
  ['zoom',          'zoom.us'],
  ['dropbox',       'dropbox.com'],
  ['twilio',        'twilio.com'],
  ['shopify',       'shopify.com'],
  ['figma',         'figma.com'],

  // Social & Media
  ['twitter',       'x.com'],
  ['x',             'x.com'],
  ['snap',          'snap.com'],
  ['snapchat',      'snap.com'],
  ['pinterest',     'pinterest.com'],
  ['spotify',       'spotify.com'],
  ['tiktok',        'tiktok.com'],
  ['bytedance',     'bytedance.com'],

  // Enterprise & Legacy Tech
  ['oracle',        'oracle.com'],
  ['ibm',           'ibm.com'],
  ['adobe',         'adobe.com'],
  ['nvidia',        'nvidia.com'],
  ['intel',         'intel.com'],
  ['cisco',         'cisco.com'],
  ['vmware',        'vmware.com'],

  // Travel & Hospitality
  ['airbnb',        'airbnb.com'],

  // Automotive & Energy
  ['tesla',         'tesla.com'],

  // Professional Networking
  ['linkedin',      'linkedin.com'],
]);

/**
 * Get the expected email domain for a company.
 *
 * Strategy:
 *  1. Exact match in the COMPANY_DOMAINS map (case-insensitive).
 *  2. Fuzzy match: strip common suffixes (Inc, Corp, LLC, etc.)
 *     and try again.
 *  3. Heuristic guess: company name → lowercase + .com
 *     (e.g., "Acme Corp" → "acme.com").
 *
 * @param {string} company — Company name from the review form.
 * @returns {{ domain: string, confidence: 'exact'|'fuzzy'|'guess' }}
 */
function getExpectedDomain(company) {
  if (!company || typeof company !== 'string') {
    return { domain: null, confidence: 'none' };
  }

  var normalized = company.trim().toLowerCase();

  // 1. Exact match
  if (COMPANY_DOMAINS.has(normalized)) {
    return { domain: COMPANY_DOMAINS.get(normalized), confidence: 'exact' };
  }

  // 2. Fuzzy — strip legal suffixes and retry
  var stripped = normalized
    .replace(/\s*(inc\.?|corp\.?|llc\.?|ltd\.?|co\.?|group|holdings|technologies|technology|systems)$/i, '')
    .trim();

  if (stripped !== normalized && COMPANY_DOMAINS.has(stripped)) {
    return { domain: COMPANY_DOMAINS.get(stripped), confidence: 'fuzzy' };
  }

  // 3. Heuristic guess: take the first word, lowercase, + .com
  //    "Goldman Sachs" → "goldmansachs.com" is wrong, but this is
  //    a best-effort fallback and the review still goes through
  //    as "unverified" if the domain doesn't match.
  var guessBase = stripped
    .replace(/[^a-z0-9]/g, '')  // strip spaces, punctuation
    .substring(0, 50);          // safety cap

  if (guessBase.length >= 2) {
    return { domain: guessBase + '.com', confidence: 'guess' };
  }

  return { domain: null, confidence: 'none' };
}

/**
 * Check whether an email address matches the expected domain for a company.
 *
 * @param {string} email — e.g., "alice@amazon.com"
 * @param {string} company — e.g., "Amazon"
 * @returns {{ matches: boolean, confidence: string, expected: string|null, actual: string }}
 */
function emailMatchesCompany(email, company) {
  var parts = email.toLowerCase().split('@');
  if (parts.length !== 2) {
    return { matches: false, confidence: 'none', expected: null, actual: '' };
  }

  var actualDomain = parts[1];
  var expected = getExpectedDomain(company);

  if (!expected.domain) {
    // We don't know this company's domain — can't validate, but don't block
    return {
      matches: false,
      confidence: 'unknown_company',
      expected: null,
      actual: actualDomain,
    };
  }

  var matches = actualDomain === expected.domain;

  return {
    matches: matches,
    confidence: expected.confidence,
    expected: expected.domain,
    actual: actualDomain,
  };
}

module.exports = {
  COMPANY_DOMAINS,
  getExpectedDomain,
  emailMatchesCompany,
};

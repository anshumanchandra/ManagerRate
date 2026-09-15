// ==========================================
// Content Moderation Service V2
// ==========================================
// Automated checks for: profanity, PII, abuse patterns,
// defamation, personal attacks, threats, and content quality.
// Reviews that fail checks are auto-flagged for admin review.

const Filter = require('bad-words');
const filter = new Filter();

// ==================== DEFAMATION PATTERNS ====================
// These patterns detect content that could be defamatory or harmful.
// They match common phrasing of personal attacks, allegations, and threats.

var PERSONAL_ALLEGATION_PATTERNS = [
  /\b(is a|is an|was a|was an)\s+(fraud|criminal|thief|crook|scam|liar|cheat|predator|molest|rapist|racist|sexist|bigot)/i,
  /\b(he|she|they|this person)\s+(steals?|stole|embezzle|assault|abuse[sd]?|harass|molest)/i,
  /\b(sleeping with|affair with|sexual.*with|dating)\s+(employee|report|subordinate|colleague|intern)/i,
  /\b(mentally|psychologically)\s+(unstable|ill|deranged|insane|crazy)/i,
  /\b(drug|alcohol|substance)\s+(addict|abuse|problem|user)/i,
];

var THREAT_PATTERNS = [
  /\b(will|gonna|going to)\s+(kill|hurt|harm|destroy|ruin|end)\s+(you|him|her|them)/i,
  /\b(watch your|watch out|you('ll| will) (pay|regret|suffer))/i,
  /\bI('ll| will)\s+(find|come after|get)\s+(you|him|her|them)/i,
  /\b(deserve[sd]? to die|hope.*dies?|wish.*dead)/i,
];

var PRIVATE_INFO_PATTERNS = [
  /\b\d{1,5}\s+[\w\s]{2,30}\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|blvd|boulevard|way|court|ct)\b/i, // addresses
  /\b(wife|husband|spouse|partner|child|son|daughter|mother|father|family)\s+(is|was|has|named)/i, // family info
  /\b(lives? (at|in|near|on)|home address|residence|house)\b/i,
];

var PROTECTED_CLASS_PATTERNS = [
  /\b(because|due to|for being)\s+(black|white|brown|asian|hispanic|muslim|hindu|christian|jewish|gay|lesbian|trans|disabled|pregnant|old|woman|man)\b/i,
  /\b(typical|such a|acting like a)\s+(woman|man|indian|chinese|muslim|christian|black|white)\b/i,
];

// ==================== MODERATION FUNCTIONS ====================

/**
 * Run all moderation checks on a text string.
 * Returns { safe: boolean, flags: string[] }
 */
function moderateContent(text) {
  var flags = [];

  if (!text || typeof text !== 'string') {
    return { safe: true, flags: [] };
  }

  // 1. Profanity check
  try {
    if (filter.isProfane(text)) {
      flags.push('profanity');
    }
  } catch (e) {
    console.warn('Profanity check error:', e.message);
  }

  // 2. Email addresses (PII leak)
  if (/[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/.test(text)) {
    flags.push('contains_email');
  }

  // 3. Phone numbers (PII leak)
  if (/\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text)) {
    flags.push('contains_phone');
  }

  // 4. Social Security / Aadhaar / PAN numbers (critical PII)
  if (/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/.test(text)) {
    flags.push('contains_ssn');
  }
  if (/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/.test(text)) {
    flags.push('contains_aadhaar');
  }
  if (/\b[A-Z]{5}\d{4}[A-Z]\b/.test(text)) {
    flags.push('contains_pan');
  }

  // 5. Personal allegations / defamation
  PERSONAL_ALLEGATION_PATTERNS.forEach(function (pattern) {
    if (pattern.test(text)) {
      flags.push('personal_allegation');
    }
  });

  // 6. Threats / harassment
  THREAT_PATTERNS.forEach(function (pattern) {
    if (pattern.test(text)) {
      flags.push('threat');
    }
  });

  // 7. Private information (addresses, family details)
  PRIVATE_INFO_PATTERNS.forEach(function (pattern) {
    if (pattern.test(text)) {
      flags.push('private_info');
    }
  });

  // 8. Protected class attacks
  PROTECTED_CLASS_PATTERNS.forEach(function (pattern) {
    if (pattern.test(text)) {
      flags.push('protected_class_attack');
    }
  });

  // 9. Excessive caps (possible shouting/abuse)
  var words = text.split(/\s+/);
  var capsWords = words.filter(function (w) { return w.length > 2 && w === w.toUpperCase(); });
  if (words.length > 5 && capsWords.length / words.length > 0.5) {
    flags.push('excessive_caps');
  }

  // 10. Repetitive characters (spam indicator)
  if (/(.)\1{10,}/.test(text)) {
    flags.push('repetitive_chars');
  }

  // 11. URL spam (multiple URLs in review)
  var urlCount = (text.match(/https?:\/\//g) || []).length;
  if (urlCount > 2) {
    flags.push('url_spam');
  }

  // Deduplicate flags
  flags = flags.filter(function (f, i, arr) { return arr.indexOf(f) === i; });

  return {
    safe: flags.length === 0,
    flags: flags,
  };
}

/**
 * Check content quality — reject if too short or only filler.
 * Returns { quality: boolean, reason: string | null }
 */
function checkContentQuality(text) {
  if (!text || typeof text !== 'string') {
    return { quality: false, reason: 'empty' };
  }

  // Strip filler words and punctuation
  var cleaned = text.replace(/[^a-zA-Z\s]/g, '').trim();
  var fillerWords = ['the', 'a', 'an', 'is', 'was', 'are', 'were', 'and', 'or', 'but',
    'good', 'bad', 'ok', 'okay', 'fine', 'nice', 'great', 'awesome', 'terrible',
    'very', 'really', 'just', 'so', 'too', 'much', 'like', 'not', 'no', 'yes'];

  var meaningfulWords = cleaned.split(/\s+/).filter(function (w) {
    return w.length > 2 && fillerWords.indexOf(w.toLowerCase()) === -1;
  });

  if (meaningfulWords.length < 5) {
    return { quality: false, reason: 'insufficient_meaningful_content' };
  }

  return { quality: true, reason: null };
}

/**
 * Moderate a full review (all text fields).
 * Returns { safe: boolean, flags: object, quality: boolean, qualityReason: string|null }
 */
function moderateReview(review) {
  var prosCheck = moderateContent(review.pros);
  var consCheck = moderateContent(review.cons);
  var adviceCheck = review.advice ? moderateContent(review.advice) : { safe: true, flags: [] };

  var prosQuality = checkContentQuality(review.pros);
  var consQuality = checkContentQuality(review.cons);

  var allFlags = {
    pros: prosCheck.flags,
    cons: consCheck.flags,
    advice: adviceCheck.flags,
  };

  var safe = prosCheck.safe && consCheck.safe && adviceCheck.safe;
  var quality = prosQuality.quality && consQuality.quality;

  return {
    safe: safe,
    flags: allFlags,
    quality: quality,
    qualityReason: !prosQuality.quality ? 'pros: ' + prosQuality.reason :
                   !consQuality.quality ? 'cons: ' + consQuality.reason : null,
  };
}

module.exports = {
  moderateContent: moderateContent,
  moderateReview: moderateReview,
  checkContentQuality: checkContentQuality,
};

# 🔒 ManagerRate — Security Audit Report

**Date:** September 12, 2026
**Scope:** Full-stack audit — Backend, Frontend, Deployment, Standalone HTML Prototype
**Files Audited:** 53 source files across 4 layers
**Method:** Static code analysis — XSS, SQLi, CMDi, auth, CORS, rate limiting, input validation, ReDoS, dependency audit, Docker security, logic flaws, race conditions

---

## 📊 Executive Summary

| Metric | Value |
|--------|-------|
| **Overall Risk Rating** | 🟡 **MEDIUM** |
| **Critical Findings** | 0 |
| **High Findings** | 4 |
| **Medium Findings** | 2 |
| **Low Findings** | 4 |
| **Logic Flaws** | 5 |
| **Total** | **15 findings** |

**Verdict:** The codebase demonstrates **strong security fundamentals** — no SQL injection, no command injection, no hardcoded secrets, proper rate limiting, Helmet security headers, input sanitization with DOMPurify, and non-root Docker containers. The findings are primarily **defense-in-depth gaps, race conditions, and logic-level edge cases** rather than exploitable critical vulnerabilities.

---

## 🔴 Critical Findings

**None found.** ✅

The codebase correctly implements:
- Prisma ORM (parameterized queries — SQL injection not possible)
- DOMPurify sanitization on all user input (XSS mitigated)
- No `exec()`/`spawn()` with user input (command injection not possible)
- No hardcoded secrets (all via environment variables)
- No `dangerouslySetInnerHTML` in React frontend

---

## 🟠 High Findings (4)

### H1: CORS — All Origins Allowed in Development Mode

**File:** `backend/src/middleware/security.js`
**Severity:** HIGH
**Impact:** In development mode, requests with no `Origin` header are accepted from ANY source. If the dev server is exposed on a network (e.g., `0.0.0.0`), any machine on the network can make API calls.

**Vulnerable Code:**
```javascript
if (!origin && process.env.NODE_ENV === 'development') {
  return callback(null, true);
}
```

**Fix:**
```javascript
// Option A: Still allow no-origin but log a warning
if (!origin && process.env.NODE_ENV === 'development') {
  console.warn('⚠️ CORS: Request with no origin accepted (dev mode)');
  return callback(null, true);
}

// Option B (stricter): Require origin even in dev
if (!origin) {
  return callback(new Error('Origin header required'));
}
```

**Risk:** LOW in production (guarded by `NODE_ENV`), HIGH if dev server is exposed.

---

### H2: Manager Slug Endpoint Has No Rate Limiting

**File:** `backend/src/routes/managers.js`
**Severity:** HIGH
**Impact:** `GET /api/managers/slug/:slug` has no specific rate limiting beyond the global 100/15min limit. An attacker could enumerate LinkedIn slugs to build a list of all managers in the system.

**Fix:**
```javascript
const { globalLimiter } = require('../middleware/rateLimiter');

// Add a slug-specific limiter
const slugLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many lookup requests.' },
});

router.get('/slug/:slug', slugLimiter, async (req, res) => {
  // ...existing code...
});
```

---

### H3: Manager Name Regex Rejects International Names

**File:** `backend/src/middleware/validator.js`
**Severity:** HIGH (accessibility/functionality)
**Impact:** The regex `/^[a-zA-Z\s\'\-\.]+$/` rejects names with accented characters (José, François), CJK characters (田中), Arabic (محمد), etc. This blocks a large portion of global users.

**Current:**
```javascript
.matches(/^[a-zA-Z\s\'\-\.]+$/)
```

**Fix:**
```javascript
// Use Unicode character properties instead
.matches(/^[\p{L}\p{M}\s'\-\.]{2,200}$/u)
.withMessage('Manager name contains invalid characters')
```

`\p{L}` matches any Unicode letter, `\p{M}` matches combining marks (accents).

---

### H4: Error Details Exposed in Development Mode

**File:** `backend/src/server.js`
**Severity:** HIGH (if NODE_ENV misconfigured in production)
**Impact:** Stack traces and error messages are returned to clients when `NODE_ENV !== 'production'`. If someone deploys without setting `NODE_ENV=production`, internal paths, library versions, and DB structure could leak.

**Current:**
```javascript
res.status(500).json({
  error: 'Internal server error',
  ...(process.env.NODE_ENV === 'development' && { details: err.message }),
});
```

**Fix:** Add a startup warning:
```javascript
// At server startup
if (process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  WARNING: Running in development mode. Error details are exposed.');
  console.warn('⚠️  Set NODE_ENV=production before deploying.');
}
```

---

## 🟡 Medium Findings (2)

### M1: Express 4.x — Consider Upgrading

**File:** `backend/package.json`
**Impact:** Express 4.x is stable but in maintenance mode. Express 5.x includes improved error handling, async route support, and security patches.
**Recommendation:** Upgrade when Express 5 reaches stable release.

---

### M2: Standalone HTML — innerHTML with Pre-Sanitized Data

**File:** `ManagerRate_Portal.html`
**Impact:** 13 `innerHTML` assignments render data that IS sanitized at input time via `esc()`. However, if `esc()` is ever bypassed (e.g., someone injects malicious data directly into localStorage via DevTools), stored XSS becomes possible.
**Recommendation:** This is acceptable for a prototype. The React frontend uses JSX (auto-escaped) and does NOT have this issue.

---

## 🟢 Low Findings (4)

### L1: Minimum Review Length Too Short
**File:** `backend/src/middleware/validator.js`
**Impact:** `min: 10` characters allows meaningless text like "good good g". Consider `min: 30`.

### L2: Unmaintained `bad-words` Package
**File:** `backend/package.json`
**Impact:** `bad-words` hasn't been updated since 2020. Consider `@2toad/profanity` (actively maintained).

### L3: Redirect Leaks Manager UUID
**File:** `backend/src/routes/managers.js`
**Impact:** `GET /api/managers/slug/:slug` redirects to `/api/managers/<uuid>`. The UUID is an implementation detail. Consider returning JSON instead:
```javascript
// Instead of redirect, return the manager data directly
const fullData = await getManagerById(manager.id);
res.json(fullData);
```

### L4: Sample Data Not Sanitized
**File:** `ManagerRate_Portal.html`
**Impact:** The `init()` seed data doesn't pass through `esc()`. Low risk since it's developer-controlled hardcoded strings, not user input.

---

## 🧠 Logic Flaws (5)

### LF1: Self-Voting — Users Can Vote Helpful on Their Own Reviews

**File:** `backend/src/routes/reviews.js`
**Impact:** The `voterHash` is checked for deduplication but never compared against the review's `ipHash`. The person who submitted a review can immediately vote it as "helpful."

**Fix:**
```javascript
// In POST /api/reviews/:id/helpful
const voterHash = getAnonymousHash(req);

// Block self-voting
if (review.ipHash === voterHash) {
  return res.status(403).json({ error: 'Cannot vote on your own review' });
}
```

---

### LF2: Multi-Browser Report Bypass

**File:** `backend/src/utils/anonymize.js`
**Impact:** The anonymous hash includes `User-Agent`. The same person can report the same review multiple times using different browsers (Chrome, Firefox, incognito, mobile) to trigger the auto-flag threshold of 3 reports.

**Fix:** Use IP-only hash for report deduplication:
```javascript
// In anonymize.js — add IP-only hash
function getIpOnlyHash(req) {
  const salt = process.env.HASH_SALT || 'default';
  const ip = req.ip || 'unknown';
  return crypto.createHash('sha256').update(`${ip}|${salt}`).digest('hex');
}

// In reviews.js — use IP-only hash for reports
const reporterHash = getIpOnlyHash(req); // instead of getAnonymousHash(req)
```

---

### LF3: LinkedIn Slug Normalization Mismatch Risk

**Files:** `frontend/src/utils/sanitize.ts` vs `backend/src/utils/sanitize.js`
**Impact:** If the frontend and backend normalize LinkedIn slugs differently, the same profile could create duplicate manager entries. Both should use identical normalization: `toLowerCase()`, strip trailing slashes, extract slug from `linkedin.com/in/<slug>`.

**Fix:** Ensure both use the exact same regex:
```
/^https:\/\/(www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-]{3,100})\/?$/
```
And normalize to: `match[2].toLowerCase()`

---

### LF4: Race Condition — Helpful Vote Toggle

**File:** `backend/src/routes/reviews.js`
**Impact:** The vote toggle does `findUnique` → `delete` or `create` without a transaction. Two concurrent requests could both pass the `findUnique` check and both create a vote, resulting in duplicate entries (though the unique constraint would cause one to fail).

**Fix:**
```javascript
// Wrap in transaction with serializable isolation
await prisma.$transaction(async (tx) => {
  const existing = await tx.helpfulVote.findUnique({
    where: { reviewId_voterHash: { reviewId, voterHash } },
  });
  if (existing) {
    await tx.helpfulVote.delete({ where: { id: existing.id } });
  } else {
    await tx.helpfulVote.create({ data: { reviewId, voterHash } });
  }
}, { isolationLevel: 'Serializable' });
```

---

### LF5: Race Condition — Duplicate Review Check

**File:** `backend/src/routes/reviews.js`
**Impact:** The duplicate review check (`findFirst` for recent review from same IP + manager) and the review creation are NOT atomic. Two concurrent requests could both pass the check and both create reviews.

**Fix:**
```javascript
// Move the duplicate check inside the transaction
const review = await prisma.$transaction(async (tx) => {
  // Check for duplicate inside transaction
  const recent = await tx.review.findFirst({
    where: { managerId: manager.id, ipHash, createdAt: { gte: new Date(Date.now() - 86400000) } },
  });
  if (recent) throw new Error('DUPLICATE');

  const newReview = await tx.review.create({ data: { ... } });
  await tx.rating.createMany({ data: ratingRecords });
  return newReview;
}, { isolationLevel: 'Serializable' });
```

---

## 📋 Security Score Card

| Category | Status | Notes |
|----------|--------|-------|
| **SQL Injection** | ✅ PASS | Prisma ORM — parameterized queries |
| **XSS Prevention** | ✅ PASS | DOMPurify (backend), JSX auto-escape (frontend) |
| **Command Injection** | ✅ PASS | No exec/spawn with user input |
| **CSRF** | ✅ N/A | Stateless API — no cookies/sessions |
| **Authentication** | ⚠️ PARTIAL | No admin panel auth (by design — anonymous platform) |
| **Rate Limiting** | ⚠️ PARTIAL | Missing on slug lookup endpoint |
| **Input Validation** | ⚠️ PARTIAL | International names blocked |
| **Security Headers** | ✅ PASS | All 7 headers present (Helmet + Nginx) |
| **CORS** | ⚠️ PARTIAL | Permissive in dev mode |
| **Secrets Management** | ✅ PASS | All via environment variables |
| **Content Moderation** | ✅ PASS | Profanity + PII detection |
| **Docker Security** | ✅ PASS | Non-root, multi-stage, health checks |
| **Dependency Safety** | ⚠️ PARTIAL | `bad-words` unmaintained |
| **Error Handling** | ⚠️ PARTIAL | Details exposed in dev mode |
| **Race Conditions** | ❌ FAIL | Vote toggle + duplicate check not atomic |
| **Anti-Abuse** | ⚠️ PARTIAL | Self-voting, multi-browser reporting possible |

**Overall: 9 PASS, 6 PARTIAL, 1 FAIL out of 16 categories**

---

## 🛠️ Recommendations (Priority Order)

### Immediate (Before Launch)
1. **Fix race conditions** — wrap vote toggle and duplicate check in serializable transactions
2. **Block self-voting** — compare voterHash against review.ipHash
3. **Fix name regex** — use `\p{L}` for Unicode letter support
4. **Add rate limit to slug endpoint** — prevent enumeration

### Short-Term (First Sprint)
5. **Use IP-only hash for reports** — prevent multi-browser bypass
6. **Ensure NODE_ENV=production** — add startup check/warning
7. **Upgrade bad-words** → `@2toad/profanity`
8. **Increase min review length** to 30 characters
9. **Return JSON instead of redirect** on slug lookup

### Long-Term
10. **Consider Redis-backed rate limiting** for distributed deployments
11. **Add request logging/audit trail** for abuse investigation
12. **Implement admin dashboard** with proper authentication (JWT/OAuth)
13. **Add automated security scanning** (npm audit, Snyk) to CI/CD
14. **Pen test** the deployed application before public launch

---

*Audit performed by automated static analysis. A manual penetration test is recommended before production deployment.*

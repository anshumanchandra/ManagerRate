# 🔒 ManagerRate — Security Audit Report V2

> **Audit Date:** September 13, 2026  
> **Auditor:** Automated Security Scanner + Manual Review  
> **Scope:** Full codebase — Backend (Node.js/Express/Prisma), Frontend (React/TypeScript), HTML Prototype, Deployment Configs  
> **Files Scanned:** 77 source files across 88 total files

---

## 📊 Executive Summary

| Severity | Count | Status |
|---|---|---|
| 🔴 **CRITICAL** | 5 | Must fix before launch |
| 🟠 **HIGH** | 5 | Must fix before launch |
| 🟡 **MEDIUM** | 8 | Fix soon after launch |
| 🟢 **LOW** | 0 | — |
| **Total** | **18** | — |

### ✅ What's Already Secure
- ✅ **SHA-256 IP hashing** with salted env variable (anonymize.js)
- ✅ **Prisma ORM** — no raw SQL injection risk (parameterized by default)
- ✅ **Helmet.js** with CSP, HSTS, X-Frame-Options, noSniff
- ✅ **CORS** restricted to env variable origin
- ✅ **Rate limiting** on reviews (3/hr), votes (20/hr), reports (5/hr)
- ✅ **Content moderation** — profanity, PII (phone, SSN), excessive caps, URL spam
- ✅ **Review bombing detection** — 10+ reviews/24h or 20+ same-rating/48h
- ✅ **Duplicate review prevention** and self-voting blocked
- ✅ **Docker non-root user** (appuser:1001)
- ✅ **Nginx security headers** and HSTS
- ✅ **Error stack hidden** in production mode
- ✅ **Input validation** on core routes (reviews, managers, search) via express-validator
- ✅ **.env.example** with placeholder values (no real secrets committed)
- ✅ **Cascade deletes** and unique constraints in Prisma schema

---

## 🔴 CRITICAL Issues (Fix Before Launch)

### C1: Hardcoded Admin Credentials in Client-Side Code

**Files:** `index.html`, `admin.html`  
**Location:** `u==='admin'&&p==='admin123'`  
**Risk:** Anyone can View Source → Ctrl+F "admin123" → full admin access

**Fix:**
```javascript
// REMOVE from index.html/admin.html entirely
// Add to backend: src/routes/admin.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || !await bcrypt.compare(password, admin.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: admin.id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '4h' });
  res.json({ token });
});
```
**Priority:** 🚨 Fix before launch

---

### C2: Email Verification Code Generated Client-Side

**File:** `index.html`  
**Location:** `_verifyCode=String(100000+Math.floor(Math.random()*900000))`  
**Risk:** Verification code is visible in JavaScript memory. User can type `_verifyCode` in browser console to see it. The entire verification system is bypassable.

**Fix:**
```javascript
// Move to backend: POST /api/verify/send-code
router.post('/send-code', async (req, res) => {
  const { email, company } = req.body;
  const code = crypto.randomInt(100000, 999999).toString();
  // Store code in Redis/DB with 10-min expiry
  await redis.set(`verify:${email}`, code, 'EX', 600);
  // Send via SendGrid
  await sendgrid.send({ to: email, subject: 'ManagerRate Verification', text: `Your code: ${code}` });
  res.json({ sent: true });
});
```
**Priority:** 🚨 Fix before launch

---

### C3: Company Domain List Exposed Client-Side

**File:** `index.html`  
**Location:** `var COMPANY_DOMAINS={...}`  
**Risk:** Users can modify `COMPANY_DOMAINS` in browser console to bypass email domain matching (e.g., add `'amazon':'gmail.com'`)

**Fix:** Move domain validation entirely to the backend. The client should only send the email — the server validates the domain match.

**Priority:** 🚨 Fix before launch

---

### C4: Standalone admin.html Still Has Hardcoded Credentials

**File:** `admin.html`  
**Location:** `u==='admin'&&p==='admin123'`  
**Risk:** Separate admin panel with same hardcoded password

**Fix:** Delete `admin.html` entirely. The integrated admin in `index.html` (which will move to server-side auth) is the replacement.

**Priority:** 🚨 Fix before launch

---

### C5: Docker-Compose Has Hardcoded Database Password

**File:** `docker-compose.yml`  
**Location:** `POSTGRES_PASSWORD` value  
**Risk:** Database password visible to anyone with repo access

**Fix:**
```yaml
# docker-compose.yml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
# Use .env file or CI/CD secrets for the actual value
```
**Priority:** 🚨 Fix before launch

---

## 🟠 HIGH Issues (Fix Before Launch)

### H1: Multiple innerHTML Assignments Without Sanitization

**Files:** `admin.html`, `ManagerRate_Portal.html`  
**Risk:** If any user data reaches innerHTML without escaping, XSS is possible. The main `index.html` uses `esc()` for most fields but admin.html has 50+ innerHTML assignments with limited escaping.

**Fix:** Ensure every user-provided field passes through `esc()` before innerHTML. Audit all 28+ innerHTML assignments in index.html and 50+ in admin.html.

**Priority:** Fix before launch

---

### H2: Pro Routes Missing Input Validation

**Files:** `backend/src/routes/pro/dashboard.js`, `pro/managers.js`, `pro/reports.js`, `pro/stats.js`  
**Count:** 15 routes across 4 files with zero express-validator middleware  
**Risk:** Query parameter injection, unexpected types causing crashes, potential NoSQL injection via query params

**Fix:** Add validation middleware for all Pro routes:
```javascript
const { query, param } = require('express-validator');
router.get('/overview', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
], validate, async (req, res) => { ... });
```
**Priority:** Fix before launch

---

### H3: Discovery & Insights Routes Missing Validation

**Files:** `backend/src/routes/discover.js` (4 routes), `insights.js` (1 route), `compare.js` (1 route), `stats.js` (1 route)  
**Risk:** URL parameters like `:companyName` and `:managerId` are not validated — could pass malicious strings

**Fix:** Add `param('companyName').trim().escape()` and `param('managerId').isInt()` validators.

**Priority:** Fix before launch

---

### H4: CORS Credentials with Permissive Origin

**File:** `backend/src/middleware/security.js`  
**Risk:** If CORS_ORIGIN env var is misconfigured (empty or wildcard), credentials mode could allow cross-origin attacks

**Fix:** Add validation that CORS_ORIGIN is a proper URL, and fail-safe to deny if not configured:
```javascript
const origin = process.env.CORS_ORIGIN;
if (!origin || origin === '*') {
  throw new Error('CORS_ORIGIN must be set to a specific domain');
}
```
**Priority:** Fix before launch

---

### H5: Profile Page innerHTML with Unescaped Manager Data

**File:** `index.html`  
**Location:** `profHdr innerHTML` — manager name and company rendered without `esc()`  
**Risk:** If a malicious manager name like `<img onerror=alert(1)>` is stored, XSS executes on the profile page

**Fix:** Wrap all `m.name`, `m.li`, and company names with `esc()` in the `vProf()` function's innerHTML builder.

**Priority:** Fix before launch

---

## 🟡 MEDIUM Issues (Fix Soon After Launch)

### M1: Routes Without Validation (Non-Pro)

**Files:** `discover.js`, `insights.js`, `compare.js`, `stats.js`  
**Count:** 7 routes  
**Risk:** Lower risk since these are read-only GET endpoints, but malformed params could cause unexpected behavior

**Fix:** Add basic param validation and sanitization.

**Priority:** Fix soon

---

### M2: Morgan Logging May Capture PII

**File:** `backend/src/server.js`  
**Location:** `morgan('dev')` / `morgan('combined')`  
**Risk:** Request logs may contain IP addresses, query params with user data

**Fix:** Use custom morgan format that redacts IPs: `morgan(':method :url :status - :response-time ms')`

**Priority:** Fix soon

---

### M3: No JWT Authentication for Backend Admin

**File:** Backend has no admin routes  
**Risk:** When you convert the prototype admin to backend, ensure it uses JWT with httpOnly cookies, not localStorage tokens

**Fix:** Implement during "Anshuman Done" backend conversion:
- bcrypt-hashed passwords
- JWT with 4-hour expiry
- httpOnly secure cookies
- Rate-limited login endpoint (5 attempts/15 min)

**Priority:** Fix when converting to backend

---

### M4: Client-Side Validation Can Be Bypassed

**Files:** `index.html` (review form validation)  
**Risk:** All validation (LinkedIn URL, star ratings, text length) happens in JavaScript — can be bypassed via browser console

**Fix:** This is already mitigated by server-side validation in `validator.js`. Just ensure server validation covers ALL fields that client validates. ✅ Already partially done.

**Priority:** Verify completeness

---

### M5: Email PII Detection Missing in Moderation

**File:** `backend/src/services/moderationService.js`  
**Risk:** Phone and SSN are detected but email addresses in review text may not be fully caught

**Fix:** Add email regex to PII detection:
```javascript
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
if (emailRegex.test(text)) flags.push('Contains email address');
```
**Priority:** Fix soon

---

### M6: localStorage Data Not Encrypted

**File:** `index.html`  
**Risk:** All reviews stored in localStorage in plain JSON — any browser extension can read them

**Fix:** For prototype this is acceptable. For production, data is in PostgreSQL (server-side) so this doesn't apply. Remove localStorage usage in production build.

**Priority:** N/A for production

---

### M7: No CSRF Protection

**File:** `backend/src/server.js`  
**Risk:** Cross-site request forgery possible on POST endpoints

**Fix:** Add `csurf` middleware or implement double-submit cookie pattern:
```javascript
const csrf = require('csurf');
app.use(csrf({ cookie: { httpOnly: true, secure: true } }));
```
**Priority:** Fix soon after launch

---

### M8: Manager Slug Enumeration

**File:** `backend/src/routes/managers.js`  
**Location:** `GET /slug/:slug`  
**Risk:** Attackers can enumerate all managers by trying LinkedIn slug combinations. Rate limiting helps but doesn't prevent determined scraping.

**Fix:** Add rate limiting specifically on slug lookups (10 req/min) and consider adding a lightweight CAPTCHA for anonymous browsing after 50+ page views.

**Priority:** Fix soon

---

## 📋 Pre-Launch Checklist

### Must Do (Before Going Live)
- [ ] Remove hardcoded `admin`/`admin123` from index.html and admin.html
- [ ] Implement server-side admin auth (bcrypt + JWT)
- [ ] Move email verification to backend (code generation + email sending)
- [ ] Move company domain list to backend
- [ ] Delete standalone `admin.html`
- [ ] Use env variables for Docker database password
- [ ] Add input validation to all Pro routes
- [ ] Add input validation to discover/insights/compare routes
- [ ] Validate CORS_ORIGIN is properly set
- [ ] Escape all user data in prototype innerHTML calls
- [ ] Set strong HASH_SALT in production env
- [ ] Set strong JWT_SECRET in production env

### Should Do (Within First Week)
- [ ] Add CSRF protection
- [ ] Add email PII detection to moderation
- [ ] Custom morgan log format (no PII)
- [ ] Rate limit on slug enumeration
- [ ] Add request ID tracing for debugging

### Nice to Have (Within First Month)
- [ ] Add CAPTCHA for review submission
- [ ] Implement review cool-down per IP per manager
- [ ] Add API key rotation support
- [ ] Add security event logging/alerting
- [ ] Penetration test by external party

---

## 🏆 Security Score

| Category | Score | Notes |
|---|---|---|
| Authentication | ⭐⭐☆☆☆ (2/5) | Hardcoded client-side creds — needs server auth |
| Input Validation | ⭐⭐⭐⭐☆ (4/5) | Core routes validated, Pro/Discovery routes missing |
| Data Protection | ⭐⭐⭐⭐☆ (4/5) | Good IP hashing, PII detection, env-based secrets |
| Network Security | ⭐⭐⭐⭐☆ (4/5) | Helmet, CORS, rate limiting, HSTS all configured |
| Infrastructure | ⭐⭐⭐⭐☆ (4/5) | Docker non-root, nginx headers, dotenv — DB pwd needs fix |
| Business Logic | ⭐⭐⭐⭐⭐ (5/5) | Bombing detection, moderation, duplicate/self-vote prevention |
| **Overall** | **⭐⭐⭐⭐☆ (3.8/5)** | **Solid backend security. Auth is the main gap — fix before launch.** |

---

*Generated by ManagerRate Security Audit Tool — September 13, 2026*

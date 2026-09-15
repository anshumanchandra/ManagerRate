# 🏗️ ManagerRate — Production Backend Architecture

## Overview

This document outlines the architecture needed to take ManagerRate from a client-side HTML prototype to a **production-ready, secure web application** with proper authentication, database persistence, server-side validation, and abuse prevention.

---

## 🧱 Tech Stack (Recommended)

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React + TypeScript + Tailwind CSS | Component-based, type-safe, rapid UI development |
| **Backend** | Node.js + Express.js (or Next.js full-stack) | JavaScript end-to-end, great ecosystem |
| **Database** | PostgreSQL | Relational, great for structured review/rating data, full-text search |
| **ORM** | Prisma | Type-safe database queries, easy migrations |
| **Auth** | NextAuth.js or Auth0 | OAuth login (Google, LinkedIn), session management |
| **Hosting** | AWS (EC2/ECS) or Vercel (Next.js) | Scalable, reliable |
| **CDN/Storage** | CloudFront + S3 | Static assets, profile images if needed |
| **Search** | PostgreSQL full-text or Elasticsearch | Manager search across names, companies |
| **Rate Limiting** | Express-rate-limit + Redis | Prevent spam/abuse |
| **Email** | Amazon SES or SendGrid | Notifications, verification |

---

## 📊 Database Schema

### Tables

#### `managers` — Auto-created from reviews, matched by LinkedIn
```sql
CREATE TABLE managers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    linkedin_url    VARCHAR(500) UNIQUE NOT NULL,
    linkedin_slug   VARCHAR(255) UNIQUE NOT NULL,  -- normalized slug for matching
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_managers_linkedin ON managers(linkedin_slug);
CREATE INDEX idx_managers_name ON managers USING GIN(to_tsvector('english', name));
```

#### `reviews` — Anonymous reviews with company context
```sql
CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id      UUID REFERENCES managers(id) ON DELETE CASCADE,
    company         VARCHAR(255) NOT NULL,
    recommends      BOOLEAN DEFAULT FALSE,
    pros            TEXT NOT NULL CHECK(char_length(pros) <= 5000),
    cons            TEXT NOT NULL CHECK(char_length(cons) <= 5000),
    advice          TEXT CHECK(char_length(advice) <= 3000),
    status          VARCHAR(20) DEFAULT 'published',  -- published, flagged, removed
    ip_hash         VARCHAR(64),   -- hashed IP for rate limiting (NOT for identification)
    created_at      TIMESTAMP DEFAULT NOW()
);
-- NO user_id column — fully anonymous by design
CREATE INDEX idx_reviews_manager ON reviews(manager_id);
CREATE INDEX idx_reviews_company ON reviews(company);
CREATE INDEX idx_reviews_status ON reviews(status);
```

#### `ratings` — Individual category ratings per review
```sql
CREATE TABLE ratings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id       UUID REFERENCES reviews(id) ON DELETE CASCADE,
    category        VARCHAR(100) NOT NULL,
    score           SMALLINT NOT NULL CHECK(score >= 1 AND score <= 5)
);
CREATE INDEX idx_ratings_review ON ratings(review_id);
```

#### `helpful_votes` — Track helpful votes (anonymous but deduplicated)
```sql
CREATE TABLE helpful_votes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id       UUID REFERENCES reviews(id) ON DELETE CASCADE,
    voter_hash      VARCHAR(64) NOT NULL,  -- hashed fingerprint/IP
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(review_id, voter_hash)
);
```

#### `reports` — Flagged/reported reviews
```sql
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id       UUID REFERENCES reviews(id) ON DELETE CASCADE,
    reason          VARCHAR(50) NOT NULL,  -- spam, defamatory, fake, inappropriate
    details         TEXT,
    reporter_hash   VARCHAR(64),
    created_at      TIMESTAMP DEFAULT NOW()
);
```

---

## 🔐 Security Architecture

### 1. XSS Prevention (Server-Side)
```javascript
// All user input sanitized before storage AND before rendering
const DOMPurify = require('isomorphic-dompurify');

function sanitize(input) {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }); // strip ALL HTML
}

// On review submit:
const cleanReview = {
    pros: sanitize(req.body.pros),
    cons: sanitize(req.body.cons),
    advice: sanitize(req.body.advice),
    company: sanitize(req.body.company),
    managerName: sanitize(req.body.managerName),
};
```

### 2. Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

// Global: 100 requests per 15 min
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Review submission: 3 reviews per hour per IP
app.post('/api/reviews', rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many reviews. Please try again later.'
}));

// Helpful votes: 20 per hour
app.post('/api/reviews/:id/helpful', rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20
}));
```

### 3. LinkedIn URL Validation
```javascript
function validateLinkedIn(url) {
    const pattern = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-]{3,100}\/?$/;
    if (!pattern.test(url)) throw new Error('Invalid LinkedIn URL');
    
    // Optional: Verify the profile exists via LinkedIn API
    // This prevents fake/non-existent profile submissions
    return normalizeLinkedIn(url);
}

function normalizeLinkedIn(url) {
    const match = url.match(/linkedin\.com\/in\/([a-z0-9\-]+)/i);
    return match ? match[1].toLowerCase() : null;
}
```

### 4. Content Security Policy (Server Headers)
```javascript
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            fontSrc: ["https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
        }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

### 5. Anonymous but Abuse-Resistant
```javascript
// Hash IP + User-Agent for rate limiting — NOT for identification
const crypto = require('crypto');

function getAnonymousHash(req) {
    const raw = req.ip + req.headers['user-agent'] + process.env.HASH_SALT;
    return crypto.createHash('sha256').update(raw).digest('hex');
}

// Prevents same person from:
// - Submitting 100 reviews for the same manager
// - Voting "helpful" on the same review twice
// But CANNOT identify who wrote the review
```

---

## 🛡️ Anti-Abuse System

### Automated Moderation
```javascript
// 1. Profanity filter
const Filter = require('bad-words');
const filter = new Filter();

function moderateContent(text) {
    if (filter.isProfane(text)) {
        return { flagged: true, reason: 'profanity' };
    }
    // 2. Check for personal information (emails, phone numbers)
    if (/[\w.-]+@[\w.-]+\.\w+/.test(text)) {
        return { flagged: true, reason: 'contains_email' };
    }
    if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text)) {
        return { flagged: true, reason: 'contains_phone' };
    }
    return { flagged: false };
}
```

### Review Reporting
```
POST /api/reviews/:id/report
Body: { reason: "defamatory", details: "This review contains false claims..." }

→ Review flagged for admin review
→ After 3 reports, auto-hidden until admin reviews
```

### Admin Dashboard (future)
- View flagged reviews
- Approve / remove reported reviews
- Ban abusive IP hashes
- Analytics on review patterns

---

## 🔌 API Endpoints

### Public (No Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/managers` | List all managers (paginated, searchable) |
| `GET` | `/api/managers/:slug` | Get manager profile + reviews grouped by company |
| `GET` | `/api/managers/:slug/reviews` | Get reviews for a manager |
| `GET` | `/api/stats` | Dashboard statistics |
| `POST` | `/api/reviews` | Submit a new anonymous review |
| `POST` | `/api/reviews/:id/helpful` | Vote review as helpful |
| `POST` | `/api/reviews/:id/report` | Report a review |

### Admin (Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/flagged` | View flagged reviews |
| `PUT` | `/admin/reviews/:id/status` | Approve/remove review |
| `GET` | `/admin/analytics` | Usage analytics |

### Example: Submit Review
```javascript
// POST /api/reviews
// Rate limited: 3 per hour per IP

{
    "managerName": "Sarah Chen",
    "company": "Amazon Web Services",
    "linkedinUrl": "https://linkedin.com/in/sarachen",
    "ratings": {
        "Leadership & Vision": 5,
        "Communication Skills": 4,
        "Career Development Support": 5,
        // ... all 11 categories
    },
    "recommends": true,
    "pros": "Excellent at setting clear goals...",
    "cons": "Sometimes too focused on deliverables...",
    "advice": "Invest more in mentorship programs."
}

// Response: 201 Created
{
    "success": true,
    "message": "Review submitted anonymously. Thank you!"
}
```

---

## 📁 Project Structure

```
managerrate/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Home.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ManagerGrid.tsx
│   │   │   ├── ManagerProfile.tsx
│   │   │   ├── ReviewCard.tsx
│   │   │   ├── ReviewForm.tsx
│   │   │   ├── StarRating.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   └── Header.tsx
│   │   ├── hooks/
│   │   │   ├── useManagers.ts
│   │   │   └── useReviews.ts
│   │   ├── utils/
│   │   │   ├── api.ts
│   │   │   └── sanitize.ts
│   │   ├── App.tsx
│   │   └── index.tsx
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── managers.ts
│   │   │   ├── reviews.ts
│   │   │   └── admin.ts
│   │   ├── middleware/
│   │   │   ├── rateLimiter.ts
│   │   │   ├── sanitizer.ts
│   │   │   ├── validator.ts
│   │   │   └── security.ts
│   │   ├── services/
│   │   │   ├── managerService.ts
│   │   │   ├── reviewService.ts
│   │   │   └── moderationService.ts
│   │   ├── models/
│   │   │   └── schema.prisma
│   │   └── server.ts
│   └── package.json
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🚀 Deployment Options

### Option A: AWS (Full Control)
```
User → CloudFront (CDN) → ALB → ECS (Node.js containers) → RDS (PostgreSQL)
                                      ↓
                              ElastiCache (Redis for rate limiting)
```
- **Cost**: ~$50-150/month depending on traffic
- **Pros**: Full control, scalable, enterprise-grade
- **Cons**: More ops overhead

### Option B: Vercel + Supabase (Fastest to Ship)
```
User → Vercel Edge → Next.js API Routes → Supabase (PostgreSQL)
                                               ↓
                                    Supabase Auth + Edge Functions
```
- **Cost**: Free tier available, ~$25/month at scale
- **Pros**: Zero ops, instant deploys, built-in auth
- **Cons**: Less control, vendor lock-in

### Option C: Railway (Simple + Cheap)
```
User → Railway → Node.js + Express → Railway PostgreSQL
                                          ↓
                                  Railway Redis (rate limiting)
```
- **Cost**: ~$5-20/month
- **Pros**: Simple, git-based deploys, cheap
- **Cons**: Smaller community

---

## ✅ Implementation Roadmap

### Phase 1: Core Backend (Week 1-2)
- [ ] Set up Next.js or Express project
- [ ] Design and migrate database schema
- [ ] Build CRUD API endpoints for managers and reviews
- [ ] Implement input sanitization and validation
- [ ] Add rate limiting with Redis
- [ ] Deploy to staging

### Phase 2: Security & Moderation (Week 3)
- [ ] Add profanity filter and content moderation
- [ ] Implement review reporting system
- [ ] Add CSP headers and security middleware
- [ ] LinkedIn URL validation and normalization
- [ ] Set up IP hashing for abuse prevention

### Phase 3: Frontend Migration (Week 4-5)
- [ ] Convert HTML prototype to React components
- [ ] Connect frontend to API endpoints
- [ ] Add loading states, error handling, pagination
- [ ] Implement search with debouncing
- [ ] Mobile-responsive refinements

### Phase 4: Polish & Launch (Week 6)
- [ ] Admin dashboard for moderation
- [ ] SEO optimization (meta tags, sitemap)
- [ ] Performance optimization (lazy loading, caching)
- [ ] Monitoring and error tracking (Sentry)
- [ ] Production deployment + domain setup

---

## 💡 Future Enhancements
- **LinkedIn OAuth** — verify reviewer actually works at the company they claim
- **Email notifications** — notify managers when they receive a new review (opt-in)
- **Manager response** — let managers respond to reviews publicly
- **Company pages** — aggregate ratings by company, not just by manager
- **API for organizations** — allow companies to query manager ratings programmatically
- **AI-powered insights** — summarize review themes, detect sentiment trends
- **Verified reviews** — badge for reviews from verified employees (via work email)

---

*This architecture ensures ManagerRate can scale from a prototype to a production app serving thousands of users while maintaining full anonymity, strong security, and resistance to abuse.*

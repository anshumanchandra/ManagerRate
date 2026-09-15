# ManagerRate Backend

A secure, anonymous manager review platform backend built with Node.js, Express, Prisma, and PostgreSQL.

## 🔒 Security Features

| Feature | Implementation |
| --- | --- |
| **XSS Prevention** | DOMPurify sanitizes all user input before storage |
| **Rate Limiting** | Global (100/15min), Reviews (3/hr), Votes (20/hr), Reports (5/hr) |
| **Input Validation** | express-validator with strict schemas for all endpoints |
| **CORS** | Whitelist-based origin checking |
| **CSP** | Content-Security-Policy via Helmet |
| **HPP** | HTTP Parameter Pollution protection |
| **HSTS** | Force HTTPS with 1-year max-age |
| **Anonymization** | SHA-256 hashed IP for abuse prevention (irreversible) |
| **Content Moderation** | Profanity filter, PII detection (email, phone, SSN) |
| **Auto-flagging** | Reviews auto-hidden after 3 reports |
| **Duplicate Prevention** | Same IP can't review same manager within 24h |
| **Payload Limits** | 10KB max request body |
| **Error Handling** | Stack traces hidden in production |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Setup

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database URL and secrets

# 3. Run database migrations
npm run db:migrate

# 4. Seed sample data
npm run db:seed

# 5. Start the server
npm run dev

```

### Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment (development/production) | development |
| `HASH_SALT` | Salt for anonymous IP hashing | Required in production |
| `CORS_ORIGIN` | Allowed frontend origin(s) | [http://localhost:3000](http://localhost:3000) |

## 📡 API Endpoints

### Public

| Method | Endpoint | Description | Rate Limit |
| --- | --- | --- | --- |
| `GET` | `/api/managers` | List managers (paginated, searchable) | Global |
| `GET` | `/api/managers/:id` | Manager profile + reviews by company | Global |
| `GET` | `/api/managers/slug/:slug` | Lookup by LinkedIn slug | Global |
| `GET` | `/api/stats` | Dashboard statistics | Global |
| `GET` | `/api/health` | Health check | None |
| `POST` | `/api/reviews` | Submit anonymous review | 3/hr |
| `POST` | `/api/reviews/:id/helpful` | Toggle helpful vote | 20/hr |
| `POST` | `/api/reviews/:id/report` | Report a review | 5/hr |

### Example: Submit Review

```bash
curl -X POST http://localhost:3001/api/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "managerName": "Sarah Chen",
    "company": "Amazon Web Services",
    "linkedinUrl": "https://linkedin.com/in/sarachen",
    "ratings": {
      "Leadership & Vision": 5,
      "Communication Skills": 4,
      "Career Development Support": 5,
      "Work-Life Balance": 4,
      "Fairness & Transparency": 5,
      "Conflict Resolution": 4,
      "Empathy & Emotional Intelligence": 5,
      "Decision Making": 4,
      "Team Building": 5,
      "Accountability": 4,
      "Technical Competence": 5
    },
    "recommends": true,
    "pros": "Excellent at setting clear goals. Always available for 1:1s.",
    "cons": "Sometimes too focused on deliverables, misses morale issues.",
    "advice": "Invest more in mentorship programs."
  }'

```

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.js            # Sample data seeder
├── src/
│   ├── config/
│   │   ├── database.js    # Prisma client singleton
│   │   └── categories.js  # Rating categories
│   ├── middleware/
│   │   ├── security.js    # Helmet, CORS, HPP
│   │   ├── rateLimiter.js # Rate limiting rules
│   │   └── validator.js   # Input validation schemas
│   ├── routes/
│   │   ├── managers.js    # Manager CRUD + search
│   │   ├── reviews.js     # Review submission + voting
│   │   └── stats.js       # Dashboard statistics
│   ├── services/
│   │   └── moderationService.js  # Content moderation
│   ├── utils/
│   │   ├── sanitize.js    # XSS prevention + URL validation
│   │   └── anonymize.js   # IP hashing for abuse prevention
│   └── server.js          # Express app setup
├── .env.example
├── .gitignore
├── package.json
└── README.md

```

## 🛡️ Privacy by Design

- **NO user accounts** — reviews are fully anonymous
- **NO user_id** on reviews — impossible to link reviews to individuals
- **IP hashes are one-way** — used only for rate limiting, never for identification
- **IP hashes use a server-side salt** — even database access can't reverse them
- **Minimal data collection** — only what's needed for the review


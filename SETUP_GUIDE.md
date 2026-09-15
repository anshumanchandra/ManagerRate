# 🚀 ManagerRate — Complete Setup Guide

A fully anonymous, secure manager review platform. This guide covers local development, Docker deployment, and production hosting.

---

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Quick Start (Without Docker)](#-quick-start-without-docker)
3. [Docker Start](#-docker-start)
4. [Production Deployment](#-production-deployment)
5. [Environment Variables](#-environment-variables)
6. [Security Checklist](#-security-checklist)
7. [API Testing](#-api-testing)
8. [Troubleshooting](#-troubleshooting)

---

## 📦 Prerequisites

### Without Docker
| Tool | Version | Check Command |
|------|---------|---------------|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| PostgreSQL | 14+ | `psql --version` |

### With Docker
| Tool | Version | Check Command |
|------|---------|---------------|
| Docker | 24+ | `docker --version` |
| Docker Compose | 2.20+ | `docker compose version` |

---

## ⚡ Quick Start (Without Docker)

### Step 1: Clone & Enter Project

```bash
cd "C:\manager review portal"
```

### Step 2: Setup Backend

```bash
# Enter backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit `.env` with your PostgreSQL connection:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/managerrate?schema=public"
PORT=3001
NODE_ENV=development
HASH_SALT="replace-with-64-random-chars-use-openssl-rand-hex-32"
CORS_ORIGIN="http://localhost:5173"
```

Generate a secure `HASH_SALT`:

```bash
# Linux/Mac
openssl rand -hex 32

# PowerShell
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

### Step 3: Create Database

```bash
# Create the database in PostgreSQL
psql -U postgres -c "CREATE DATABASE managerrate;"

# Run Prisma migrations (creates all tables)
npx prisma migrate dev --name init

# Seed sample data
npm run db:seed
```

### Step 4: Start Backend

```bash
# Development mode (auto-restart on changes)
npm run dev

# Or production mode
npm start
```

Verify it's running:

```bash
curl http://localhost:3001/api/health
# Should return: {"status":"healthy","version":"1.0.0",...}
```

### Step 5: Setup Frontend

```bash
# In a new terminal, go to frontend
cd "C:\manager review portal\frontend"

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies API calls to `http://localhost:3001`.

### Step 6: Open in Browser

Navigate to **http://localhost:5173** — you should see the ManagerRate portal with sample data!

---

## 🐳 Docker Start

### Step 1: Create Environment File

```bash
cd "C:\manager review portal"
```

Create a `.env` file in the project root:

```env
# Database
POSTGRES_DB=managerrate
POSTGRES_USER=managerrate
POSTGRES_PASSWORD=your_secure_database_password_here
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=your_secure_redis_password_here
REDIS_PORT=6379

# Backend
NODE_ENV=production
HASH_SALT=generate-a-64-char-hex-string-here
CORS_ORIGIN=http://localhost
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
REVIEW_RATE_LIMIT_MAX=3
REVIEW_RATE_LIMIT_WINDOW_MS=3600000

# Ports
BACKEND_PORT=3001
FRONTEND_PORT=80
```

### Step 2: Build & Start

```bash
# Build and start all services
docker compose up -d --build

# Watch the logs
docker compose logs -f
```

### Step 3: Run Migrations & Seed

```bash
# Run database migrations
docker compose exec backend npx prisma migrate deploy

# Seed sample data
docker compose exec backend npm run db:seed
```

### Step 4: Verify

```bash
# Check all services are healthy
docker compose ps

# Test health endpoint
curl http://localhost:3001/api/health

# Test managers endpoint
curl http://localhost:3001/api/managers

# Open frontend
# Navigate to http://localhost in your browser
```

### Docker Commands Cheat Sheet

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Stop and remove volumes (DELETES DATA)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f postgres

# Enter a container shell
docker compose exec backend sh
docker compose exec postgres psql -U managerrate -d managerrate

# Restart a single service
docker compose restart backend
```

---

## 🌐 Production Deployment

### Option A: AWS (EC2 + RDS + S3/CloudFront)

**Best for:** Full control, enterprise scale, AWS ecosystem.  
**Cost:** ~$50-150/month

#### Architecture
```
User → CloudFront (CDN) → S3 (Frontend Static Files)
              ↓
         ALB (Load Balancer)
              ↓
       ECS/EC2 (Backend Containers)
              ↓
         RDS PostgreSQL
              ↓
       ElastiCache Redis
```

#### Steps

1. **RDS PostgreSQL**
   - Create RDS PostgreSQL 16 instance (db.t3.micro for start)
   - Enable encryption at rest
   - Private subnet only (no public access)
   - Security group: allow port 5432 from backend SG only

2. **ElastiCache Redis**
   - Create Redis 7 cluster (cache.t3.micro)
   - Private subnet, encrypted in transit
   - Security group: allow 6379 from backend SG

3. **ECS / EC2 Backend**
   - Push backend Docker image to ECR
   - Create ECS service with Fargate or EC2 launch type
   - Environment variables via Secrets Manager
   - ALB health check: `/api/health`
   - Auto-scaling: min 1, max 4 instances

4. **S3 + CloudFront (Frontend)**
   - Build frontend: `npm run build`
   - Upload `dist/` to S3 bucket (static website hosting)
   - CloudFront distribution in front of S3
   - Custom error page: redirect 404 → `/index.html` (SPA)
   - Enable HTTPS with ACM certificate

5. **Route 53**
   - Point your domain to CloudFront
   - API subdomain (api.yourdomain.com) → ALB

---

### Option B: Vercel (Frontend) + Railway (Backend + Postgres)

**Best for:** Fastest to deploy, minimal ops.  
**Cost:** Free tier → ~$25/month at scale

#### Steps

1. **Railway (Backend + DB)**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login and init
   railway login
   cd backend
   railway init
   
   # Add PostgreSQL
   railway add --plugin postgresql
   
   # Set environment variables
   railway variables set HASH_SALT=your-secret
   railway variables set CORS_ORIGIN=https://your-app.vercel.app
   railway variables set NODE_ENV=production
   
   # Deploy
   railway up
   ```

2. **Vercel (Frontend)**
   ```bash
   # Install Vercel CLI
   npm install -g vercel
   
   # Deploy frontend
   cd frontend
   vercel
   ```

   Add a `vercel.json` to proxy API calls:
   ```json
   {
     "rewrites": [
       { "source": "/api/:path*", "destination": "https://your-railway-url.up.railway.app/api/:path*" }
     ]
   }
   ```

---

### Option C: DigitalOcean App Platform

**Best for:** Simple, predictable pricing.  
**Cost:** ~$12-30/month

1. Connect your GitHub repo
2. App Platform auto-detects Dockerfile
3. Add managed PostgreSQL ($12/month)
4. Set environment variables in dashboard
5. Auto-deploys on git push

---

## 🔧 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `PORT` | ❌ | `3001` | Backend server port |
| `NODE_ENV` | ❌ | `development` | `development` or `production` |
| `HASH_SALT` | ✅ (prod) | fallback | 64-char hex string for anonymous IP hashing |
| `CORS_ORIGIN` | ❌ | `http://localhost:3000` | Comma-separated allowed origins |
| `RATE_LIMIT_WINDOW_MS` | ❌ | `900000` | Global rate limit window (15 min) |
| `RATE_LIMIT_MAX` | ❌ | `100` | Max requests per window |
| `REVIEW_RATE_LIMIT_MAX` | ❌ | `3` | Max reviews per hour per IP |
| `REVIEW_RATE_LIMIT_WINDOW_MS` | ❌ | `3600000` | Review rate limit window (1 hour) |
| `POSTGRES_DB` | Docker | `managerrate` | Database name |
| `POSTGRES_USER` | Docker | `managerrate` | Database user |
| `POSTGRES_PASSWORD` | Docker | — | Database password |
| `REDIS_PASSWORD` | Docker | — | Redis password |

---

## 🛡️ Security Checklist

Before going to production, verify ALL 16 protections are active:

| # | Protection | Status | File |
|---|-----------|--------|------|
| 1 | ✅ XSS Prevention — DOMPurify sanitizes all input | | `utils/sanitize.js` |
| 2 | ✅ Rate Limiting — Global 100/15min | | `middleware/rateLimiter.js` |
| 3 | ✅ Rate Limiting — Reviews 3/hr per IP | | `middleware/rateLimiter.js` |
| 4 | ✅ Rate Limiting — Votes 20/hr per IP | | `middleware/rateLimiter.js` |
| 5 | ✅ Rate Limiting — Reports 5/hr per IP | | `middleware/rateLimiter.js` |
| 6 | ✅ Input Validation — express-validator schemas | | `middleware/validator.js` |
| 7 | ✅ CSP Headers — Content-Security-Policy | | `middleware/security.js` |
| 8 | ✅ HSTS — Force HTTPS, 1-year max-age | | `middleware/security.js` |
| 9 | ✅ CORS — Whitelist-based origins | | `middleware/security.js` |
| 10 | ✅ HPP — HTTP Parameter Pollution block | | `middleware/security.js` |
| 11 | ✅ Profanity Filter — Auto-flag offensive text | | `services/moderationService.js` |
| 12 | ✅ PII Detection — Blocks email/phone/SSN | | `services/moderationService.js` |
| 13 | ✅ Anonymous IP Hashing — SHA-256, irreversible | | `utils/anonymize.js` |
| 14 | ✅ Duplicate Prevention — 24hr cooldown per manager | | `routes/reviews.js` |
| 15 | ✅ Auto-Flag — 3+ reports hides review | | `routes/reviews.js` |
| 16 | ✅ Payload Limit — 10KB max body | | `server.js` |

### Additional Production Steps

```bash
# 1. Generate a strong HASH_SALT
openssl rand -hex 32

# 2. Ensure CORS_ORIGIN matches your domain only
CORS_ORIGIN="https://yourdomain.com"

# 3. Set NODE_ENV to production
NODE_ENV=production

# 4. Use strong database password (20+ chars)
POSTGRES_PASSWORD="$(openssl rand -base64 24)"

# 5. Enable SSL on PostgreSQL connection
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# 6. Run Prisma migrations (NOT dev, use deploy)
npx prisma migrate deploy
```

---

## 🧪 API Testing

### Health Check
```bash
curl http://localhost:3001/api/health
```
**Expected:** `{"status":"healthy","version":"1.0.0",...}`

### List Managers
```bash
# All managers
curl http://localhost:3001/api/managers

# Search by name
curl "http://localhost:3001/api/managers?q=Sarah"

# Filter by company
curl "http://localhost:3001/api/managers?company=Amazon%20Web%20Services"

# Filter by rating
curl "http://localhost:3001/api/managers?minRating=4"

# Paginated
curl "http://localhost:3001/api/managers?page=1&limit=10"
```

### Get Manager Profile
```bash
curl http://localhost:3001/api/managers/MANAGER_UUID_HERE
```

### Dashboard Statistics
```bash
curl http://localhost:3001/api/stats
```

### Submit a Review
```bash
curl -X POST http://localhost:3001/api/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "managerName": "Test Manager",
    "company": "Test Company",
    "linkedinUrl": "https://linkedin.com/in/testmanager",
    "ratings": {
      "Leadership & Vision": 4,
      "Communication Skills": 5,
      "Career Development Support": 4,
      "Work-Life Balance": 3,
      "Fairness & Transparency": 4,
      "Conflict Resolution": 4,
      "Empathy & Emotional Intelligence": 5,
      "Decision Making": 4,
      "Team Building": 5,
      "Accountability": 4,
      "Technical Competence": 3
    },
    "recommends": true,
    "pros": "Excellent leader who truly cares about team growth and development.",
    "cons": "Could improve on setting clearer deadlines for projects.",
    "advice": "More team-building activities would help morale."
  }'
```
**Expected:** `{"success":true,"message":"Review submitted anonymously. Thank you!","reviewId":"..."}`

### Vote Review as Helpful
```bash
curl -X POST http://localhost:3001/api/reviews/REVIEW_UUID_HERE/helpful
```

### Report a Review
```bash
curl -X POST http://localhost:3001/api/reviews/REVIEW_UUID_HERE/report \
  -H "Content-Type: application/json" \
  -d '{"reason": "fake", "details": "This review appears to be fabricated."}'
```

### Test Rate Limiting
```bash
# Submit 4 reviews quickly — 4th should be rejected
for i in 1 2 3 4; do
  echo "--- Review $i ---"
  curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/reviews \
    -H "Content-Type: application/json" \
    -d '{
      "managerName": "Rate Limit Test",
      "company": "Test Corp",
      "linkedinUrl": "https://linkedin.com/in/ratelimittest'$i'",
      "ratings": {"Leadership & Vision":4,"Communication Skills":4,"Career Development Support":4,"Work-Life Balance":4,"Fairness & Transparency":4,"Conflict Resolution":4,"Empathy & Emotional Intelligence":4,"Decision Making":4,"Team Building":4,"Accountability":4,"Technical Competence":4},
      "recommends": true,
      "pros": "Testing rate limiting mechanism works correctly.",
      "cons": "This is a test review for rate limit verification."
    }'
  echo ""
done
# First 3 should return 201, 4th should return 429
```

### Test XSS Prevention
```bash
curl -X POST http://localhost:3001/api/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "managerName": "<script>alert(1)</script>Test",
    "company": "<img src=x onerror=alert(1)>Evil Corp",
    "linkedinUrl": "https://linkedin.com/in/xsstest",
    "ratings": {"Leadership & Vision":1,"Communication Skills":1,"Career Development Support":1,"Work-Life Balance":1,"Fairness & Transparency":1,"Conflict Resolution":1,"Empathy & Emotional Intelligence":1,"Decision Making":1,"Team Building":1,"Accountability":1,"Technical Competence":1},
    "recommends": false,
    "pros": "<script>document.cookie</script>Sanitized pros text.",
    "cons": "<img onerror=fetch(evil.com) src=x>Sanitized cons text."
  }'
# All HTML tags should be stripped from stored values
```

---

## 🔧 Troubleshooting

### Database Connection Failed
```
Error: Can't reach database server at `localhost:5432`
```
**Fix:**
```bash
# Check PostgreSQL is running
pg_isready

# Or with Docker
docker compose ps postgres

# Check connection string format
# postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

### Prisma Migration Error
```
Error: The database schema is not empty
```
**Fix:**
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Or force push schema
npx prisma db push --force-reset
```

### Rate Limit Hit During Testing
```
{"error":"You have submitted too many reviews. Please try again in an hour."}
```
**Fix:** Wait for the rate limit window to expire, or restart the backend server (resets in-memory rate counters).

### CORS Error in Browser
```
Access to fetch has been blocked by CORS policy
```
**Fix:** Ensure `CORS_ORIGIN` in `.env` matches your frontend URL exactly:
```env
# Development
CORS_ORIGIN="http://localhost:5173"

# Production
CORS_ORIGIN="https://yourdomain.com"

# Multiple origins
CORS_ORIGIN="https://yourdomain.com,https://www.yourdomain.com"
```

### Docker Build Fails
```
ERROR: failed to solve: npm ci
```
**Fix:**
```bash
# Clear Docker build cache
docker builder prune -a

# Rebuild from scratch
docker compose build --no-cache
```

### Prisma Client Not Generated
```
Error: @prisma/client did not initialize yet
```
**Fix:**
```bash
npx prisma generate
```

### Port Already in Use
```
Error: listen EADDRINUSE :::3001
```
**Fix:**
```bash
# Find and kill the process
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

---

## 📊 Project Structure (Complete)

```
manager review portal/
├── docker-compose.yml         ← Multi-service orchestration
├── .env                       ← Environment variables (DO NOT COMMIT)
├── SETUP_GUIDE.md             ← This file
├── backend_architecture.md    ← Architecture documentation
│
├── frontend/
│   ├── Dockerfile             ← Multi-stage build (Vite → Nginx)
│   ├── nginx.conf             ← Nginx config with security headers
│   ├── package.json
│   ├── src/                   ← React + TypeScript source
│   └── dist/                  ← Built static files (generated)
│
├── backend/
│   ├── Dockerfile             ← Multi-stage build (non-root Node)
│   ├── package.json
│   ├── .env.example           ← Environment template
│   ├── prisma/
│   │   ├── schema.prisma      ← Database schema (5 tables)
│   │   └── seed.js            ← Sample data
│   └── src/
│       ├── server.js          ← Express app + middleware stack
│       ├── config/
│       │   ├── database.js    ← Prisma client
│       │   └── categories.js  ← 11 rating categories
│       ├── middleware/
│       │   ├── security.js    ← Helmet, CORS, HPP, CSP
│       │   ├── rateLimiter.js ← 4 rate limiters
│       │   └── validator.js   ← Input validation schemas
│       ├── routes/
│       │   ├── managers.js    ← Manager CRUD + search
│       │   ├── reviews.js     ← Reviews + voting + reporting
│       │   └── stats.js       ← Dashboard statistics
│       ├── services/
│       │   └── moderationService.js ← Profanity + PII detection
│       └── utils/
│           ├── sanitize.js    ← XSS prevention
│           └── anonymize.js   ← One-way IP hashing
│
└── ManagerRate_Portal.html    ← Standalone HTML prototype
```

---

*Built with security-first principles. Every layer of this application — from the Nginx reverse proxy to the database constraints — is designed to protect user anonymity and prevent abuse.*

# 🚀 ManagerRate — Railway Deployment Guide

> **Goal:** Get ManagerRate fully live with shared database, real email verification, and admin panel.
> **Time:** ~30 minutes | **Cost:** Free to start

---

## 📋 Prerequisites

Before you start, make sure you have:

- [ ] **Git** installed → [Download](https://git-scm.com/downloads)
- [ ] **GitHub account** → [Sign up](https://github.com/join)
- [ ] **Railway account** → [Sign up with GitHub](https://railway.app/) (free, no credit card)
- [ ] **Node.js 18+** installed → [Download](https://nodejs.org/)

---

## Step 1: Push Code to GitHub

Open **Command Prompt** or **PowerShell** and run:

```bash
# Navigate to your project
cd "C:\manager review portal"

# Initialize git repo
git init

# Create .gitignore
echo node_modules/ > .gitignore
echo .env >> .gitignore
echo dist/ >> .gitignore

# Add all files
git add .
git commit -m "Initial commit - ManagerRate v1.0"

# Create repo on GitHub (go to github.com/new → name it "managerrate")
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/managerrate.git
git branch -M main
git push -u origin main
```

> ⚠️ Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Step 2: Create Railway Project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **"Deploy from GitHub Repo"**
3. Select your `managerrate` repo
4. Railway auto-detects it as a Node.js project ✅

---

## Step 3: Add PostgreSQL Database

1. In your Railway project dashboard, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway creates a PostgreSQL instance automatically
3. Click on the PostgreSQL service → **"Variables"** tab
4. Copy the `DATABASE_URL` (looks like: `postgresql://postgres:xxxx@containers-xxx.railway.app:5432/railway`)

---

## Step 4: Configure Backend Service

1. Click on your **backend service** in Railway
2. Go to **"Settings"** tab:
   - **Root Directory:** `backend`
   - **Build Command:** `npx prisma generate && npx prisma migrate deploy`
   - **Start Command:** `npm start`
3. Go to **"Variables"** tab and add these:

```
DATABASE_URL         = (paste the PostgreSQL URL from Step 3)
PORT                 = 3001
NODE_ENV             = production
HASH_SALT            = (generate a random string — e.g. use: https://randomkeygen.com/)
CORS_ORIGIN          = https://your-frontend-url.up.railway.app
RATE_LIMIT_WINDOW_MS = 900000
RATE_LIMIT_MAX       = 100
```

4. Click **"Deploy"** — wait for the build to complete (~2-3 minutes)

---

## Step 5: Seed the Database

Once the backend is deployed:

1. Click on the backend service → **"Settings"** → scroll to **"Run Command"**
2. Temporarily change start command to: `node prisma/seed.js && npm start`
3. Redeploy → this seeds the sample data
4. After it starts, change back to just: `npm start`

Or use the Railway CLI:
```bash
railway run node prisma/seed.js
```

---

## Step 6: Deploy Frontend

### Option A: Deploy React Frontend on Railway

1. Click **"+ New"** → **"GitHub Repo"** → select the same repo
2. **Settings:**
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npx serve dist -s -l 3000`
3. Add variable:
   ```
   VITE_API_URL = https://your-backend-url.up.railway.app
   ```
4. Deploy

### Option B: Deploy on Vercel (Recommended for Frontend)

1. Go to [vercel.com](https://vercel.com) → Import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Add environment variable:
   ```
   VITE_API_URL = https://your-backend-url.up.railway.app
   ```
4. Deploy → get a free `managerrate.vercel.app` URL

---

## Step 7: Add Real Email Verification (SendGrid)

1. Sign up at [sendgrid.com](https://sendgrid.com) (free: 100 emails/day)
2. Create an API key → Settings → API Keys → Create
3. Add to Railway backend variables:
   ```
   SENDGRID_API_KEY     = SG.xxxxxxxxxxxxx
   VERIFY_EMAIL_FROM    = noreply@managerrate.com
   ```
4. We'll add a `/api/verify/send-code` endpoint that sends real emails

---

## Step 8: Connect Custom Domain (Optional)

1. Buy `managerrate.com` from [Namecheap](https://namecheap.com) (~$10/year) or [Google Domains](https://domains.google)
2. In Railway/Vercel → **Settings** → **Custom Domain** → Add `managerrate.com`
3. Update your domain DNS:
   - Add a **CNAME** record pointing to the Railway/Vercel URL
4. SSL is automatic ✅

---

## 🎯 Final Checklist

After deployment, verify everything works:

- [ ] Home page loads at your URL
- [ ] Write a review → it saves and appears for other users
- [ ] Manager profiles show all reviews
- [ ] Dashboard stats update in real-time
- [ ] Admin login works (`/admin` route on backend)
- [ ] Contact form sends emails
- [ ] Rate limiting blocks spam
- [ ] HTTPS is active (padlock icon)

---

## 📊 Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│   Frontend   │────▶│   Backend    │
│  (Users)     │     │  (Vercel/    │     │  (Railway)   │
│              │◀────│   Railway)   │◀────│  Node.js     │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                           ┌──────▼───────┐
                                           │  PostgreSQL   │
                                           │  (Railway)    │
                                           │  Shared DB    │
                                           └──────────────┘
```

**All users → Same frontend → Same backend → Same database = Shared reviews! ✅**

---

## 💰 Cost Summary

| Service | Free Tier | Paid |
|---|---|---|
| Railway (Backend + DB) | 500 hours/month, 500MB DB | $5/mo unlimited |
| Vercel (Frontend) | 100GB bandwidth | $20/mo |
| SendGrid (Emails) | 100 emails/day | $15/mo for 50K |
| Domain | N/A | ~$10/year |
| **Total** | **$0** | **~$5-10/month** |

---

## 🆘 Troubleshooting

| Issue | Fix |
|---|---|
| Build fails | Check Railway logs → usually missing dependency |
| DB connection error | Verify DATABASE_URL is correct in variables |
| CORS error | Update CORS_ORIGIN to match frontend URL |
| Reviews not showing | Check backend logs for API errors |
| Prisma error | Run `npx prisma generate` in build command |

---

## 🎉 You're Live!

Once deployed, share your URL and start collecting reviews. The roadmap from here:

1. **Get 100 reviews** → share on LinkedIn, Reddit, Twitter
2. **Add email verification** → SendGrid integration
3. **Launch Pro tier** → Stripe payment integration
4. **Scale** → upgrade Railway to paid plan when traffic grows

**Say "Anshuman Done" when you're ready to convert the prototype admin panel to the secure Node.js backend!**

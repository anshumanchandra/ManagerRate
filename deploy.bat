@echo off
echo ==========================================
echo   ManagerRate - Deployment Setup
echo ==========================================
echo.
echo Step 1: Installing Railway CLI...
npm install -g @railway/cli
echo.
echo Step 2: Login to Railway (browser will open)...
railway login
echo.
echo Step 3: Initialize project...
cd /d "C:\manager review portal\backend"
railway init
echo.
echo Step 4: Link to service...
railway link
echo.
echo Step 5: Deploy...
railway up
echo.
echo Step 6: Run migrations...
railway run npx prisma migrate deploy
railway run node prisma/seed.js
echo.
echo DONE! Your backend is live.
railway open
pause

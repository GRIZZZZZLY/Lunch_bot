#!/bin/bash

# ===============================================
# 🚀 VPS PROD-DEV Deployment Script
# ===============================================
# Deploys optimized build with debug features
# Domain: rocket-lunch.duckdns.org
# Branch: feature/new_version

set -e  # Exit on any error

echo "🚀 Starting PROD-DEV deployment to VPS..."

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📍 Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "feature/new_version" ]; then
    echo "⚠️  Warning: Not on feature/new_version branch!"
    echo "Switching to feature/new_version..."
    git checkout feature/new_version
fi

# ===============================================
# 1. Environment Setup
# ===============================================
echo "📦 Setting up PROD-DEV environment..."

# Backup current .env files
if [ -f backend/.env ]; then
    cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backed up backend/.env"
fi
if [ -f frontend/.env ]; then
    cp frontend/.env frontend/.env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backed up frontend/.env"
fi

# Copy PROD-DEV environment files
if [ -f backend/.env.prod-dev ]; then
    cp backend/.env.prod-dev backend/.env
    echo "✅ Loaded backend/.env.prod-dev"
else
    echo "❌ ERROR: backend/.env.prod-dev not found!"
    exit 1
fi

if [ -f frontend/.env.prod-dev ]; then
    cp frontend/.env.prod-dev frontend/.env
    echo "✅ Loaded frontend/.env.prod-dev"
else
    echo "❌ ERROR: frontend/.env.prod-dev not found!"
    exit 1
fi

# ===============================================
# 2. Install Dependencies
# ===============================================
echo "📦 Installing dependencies..."

# Backend dependencies
cd backend
npm ci --only=production
cd ..

# Frontend dependencies (needed for build)
cd frontend
npm ci
cd ..

echo "✅ Dependencies installed"

# ===============================================
# 3. Build Frontend (PROD-DEV mode)
# ===============================================
echo "🏗️  Building frontend (PROD-DEV)..."

cd frontend

# Check if build:prod-dev script exists
if grep -q "build:prod-dev" package.json; then
    echo "Using build:prod-dev script..."
    npm run build:prod-dev
else
    echo "Fallback to regular build..."
    npm run build
fi

cd ..

echo "✅ Frontend built successfully"

# ===============================================
# 4. Build Backend
# ===============================================
echo "🏗️  Building backend..."

cd backend
npm run build
cd ..

echo "✅ Backend built successfully"

# ===============================================
# 5. Database Setup
# ===============================================
echo "🗄️  Setting up database..."

cd backend

# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:push

cd ..

echo "✅ Database configured"

# ===============================================
# 6. PM2 Process Management
# ===============================================
echo "🔄 Configuring PM2..."

cd backend

# Stop existing process if running
pm2 delete rocket-lunch-bot 2>/dev/null || true

# Start application with PM2
pm2 start dist/index.js --name rocket-lunch-bot \
  --max-memory-restart 500M \
  --env production \
  --log-date-format "YYYY-MM-DD HH:mm:ss Z"

# Save PM2 configuration
pm2 save

cd ..

echo "✅ PM2 configured"

# ===============================================
# 7. Final Checks
# ===============================================
echo "🔍 Running final checks..."

# Check if process is running
pm2 status

# Wait for app to start
sleep 3

# Show logs (last 20 lines)
echo ""
echo "📋 Recent logs:"
pm2 logs rocket-lunch-bot --lines 20 --nostream

echo ""
echo "✅ PROD-DEV deployment completed successfully!"
echo ""
echo "🔍 Debug features enabled:"
echo "  ✓ console.log preserved"
echo "  ✓ Source maps enabled"
echo "  ✓ SKIP_TELEGRAM_VALIDATION=true"
echo ""
echo "📝 Useful commands:"
echo "  pm2 logs rocket-lunch-bot --lines 100  - View logs"
echo "  pm2 restart rocket-lunch-bot  - Restart app"
echo "  pm2 monit  - Monitor app"
echo "  curl http://localhost:3001/api/health  - Check API health"
echo ""
echo "🌐 Application URL: https://rocket-lunch.duckdns.org"
echo ""

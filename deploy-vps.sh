#!/bin/bash

# ===============================================
# 🚀 VPS Deployment Script for Rocket Lunch Bot
# ===============================================
# Configurable via env vars:
#   BRANCH        — git branch to deploy (default: feature/store-run)
#   DOMAIN        — public domain for webhook hint (default: rocket-lunch.duckdns.org)
#   FRONTEND_DIR  — frontend / frontend-new (default: frontend)
# Example:
#   BRANCH=main DOMAIN=lunch.example.ru ./deploy-vps.sh

set -e

BRANCH="${BRANCH:-feature/store-run}"
DOMAIN="${DOMAIN:-rocket-lunch.duckdns.org}"

echo "🚀 Starting deployment to VPS..."
echo "   Branch: $BRANCH"
echo "   Domain: $DOMAIN"

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📍 Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "⚠️  Not on $BRANCH branch — switching..."
    git fetch origin "$BRANCH"
    git checkout "$BRANCH"
fi

# ===============================================
# 1. Environment Setup
# ===============================================
echo "📦 Setting up environment..."

# Frontend directory (switch between frontend / frontend-new without rename)
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"
echo "🎨 Frontend dir: $FRONTEND_DIR"

# Copy production environment files
cp backend/.env.production backend/.env
if [ -f "$FRONTEND_DIR/.env.production" ]; then
  cp "$FRONTEND_DIR/.env.production" "$FRONTEND_DIR/.env"
fi

echo "✅ Environment files configured"

# ===============================================
# 2. Install Dependencies
# ===============================================
echo "📦 Installing dependencies..."

# Backend dependencies
cd backend
npm ci --only=production
cd ..

# Frontend dependencies (needed for build)
cd "$FRONTEND_DIR"
npm ci
cd ..

echo "✅ Dependencies installed"

# ===============================================
# 3. Build Frontend
# ===============================================
echo "🏗️  Building frontend..."

cd "$FRONTEND_DIR"
npm run build
cd ..

echo "✅ Frontend built successfully ($FRONTEND_DIR)"

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

# Apply migrations (proper migration history — see prisma/migrations/)
npm run db:migrate:prod

# Backfill PollParticipant snapshots for any active polls (idempotent)
npx tsx scripts/backfill-poll-participants.ts || echo "⚠️ Backfill failed (non-critical)"

# Seed menu (optional - comment out if you want to preserve existing data)
# npm run db:seed

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
  --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script (run once)
pm2 startup

cd ..

echo "✅ PM2 configured"

# ===============================================
# 7. Final Checks
# ===============================================
echo "🔍 Running final checks..."

# Check if process is running
pm2 status

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📊 Next steps:"
echo "1. Configure nginx reverse proxy (see nginx.conf)"
echo "2. Setup SSL certificate with certbot"
echo "3. Configure Telegram webhook:"
echo "   curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \\"
echo "     -d url=https://$DOMAIN/webhook"
echo ""
echo "📝 Useful commands:"
echo "  pm2 logs rocket-lunch-bot  - View logs"
echo "  pm2 restart rocket-lunch-bot  - Restart app"
echo "  pm2 stop rocket-lunch-bot  - Stop app"
echo "  pm2 monit  - Monitor app"
echo ""

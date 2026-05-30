#!/bin/bash

# ===============================================
# 🔄 Quick Update Script for VPS
# ===============================================
# Configurable: BRANCH=feature/store-run (default), FRONTEND_DIR=frontend (default)

set -e

BRANCH="${BRANCH:-feature/store-run}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"

echo "🔄 Starting quick update..."
echo "   Branch: $BRANCH"
echo "🎨 Frontend dir: $FRONTEND_DIR"

# ===============================================
# 1. Pull Latest Changes
# ===============================================
echo "📥 Pulling latest changes from Git..."

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📍 Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "⚠️  Not on $BRANCH branch — switching..."
    git fetch origin "$BRANCH"
    git checkout "$BRANCH"
fi

git pull origin "$BRANCH"

echo "✅ Changes pulled"

# ===============================================
# 2. Update Backend
# ===============================================
echo "🔨 Updating backend..."

cd backend

# Install ALL dependencies (including devDependencies).
# ВАЖНО: `npm run build` (tsc) требует devDeps (@types/*, typescript).
# Раньше тут было `--only=production` → tsc падал с TS7016 (нет @types/express)
# и `set -e` прерывал деплой ДО pm2 reload. Не возвращать --only=production.
npm install

# Rebuild
npm run build

# Database migrations (if any new ones in prisma/migrations/)
npm run db:migrate:prod

# Backfill PollParticipant snapshots (idempotent, safe to run on every update)
npx tsx scripts/backfill-poll-participants.ts || echo "⚠️ Backfill failed (non-critical)"

cd ..

echo "✅ Backend updated"

# ===============================================
# 3. Update Frontend
# ===============================================
echo "🎨 Updating frontend..."

cd "$FRONTEND_DIR"

# Install new dependencies if any
npm install

# Rebuild
npm run build

cd ..

echo "✅ Frontend updated ($FRONTEND_DIR)"

# ===============================================
# 4. Reload Application (zero-downtime)
# ===============================================
echo "🔄 Reloading application..."

cd backend
pm2 reload rocket-lunch-bot

echo "✅ Application reloaded"

# ===============================================
# 5. Health Check
# ===============================================
echo "🏥 Running health check..."

sleep 3

# Check if app is running
if pm2 list | grep -q "rocket-lunch-bot.*online"; then
    echo "✅ Application is running"
else
    echo "❌ Application failed to start"
    pm2 logs rocket-lunch-bot --lines 50
    exit 1
fi

echo ""
echo "✅ Update completed successfully!"
echo ""
echo "📊 Status:"
pm2 status rocket-lunch-bot
echo ""
echo "📝 View logs: pm2 logs rocket-lunch-bot"
echo ""

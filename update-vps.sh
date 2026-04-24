#!/bin/bash

# ===============================================
# 🔄 Quick Update Script for VPS
# ===============================================
# Use this for fast updates without full redeployment

set -e

echo "🔄 Starting quick update..."

# Frontend directory (switch between frontend / frontend-new without rename)
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"
echo "🎨 Frontend dir: $FRONTEND_DIR"

# ===============================================
# 1. Pull Latest Changes
# ===============================================
echo "📥 Pulling latest changes from Git..."

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📍 Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "feature/new_version" ]; then
    echo "⚠️  Warning: Not on feature/new_version branch!"
    echo "Switching to feature/new_version..."
    git checkout feature/new_version
fi

git pull origin feature/new_version

echo "✅ Changes pulled"

# ===============================================
# 2. Update Backend
# ===============================================
echo "🔨 Updating backend..."

cd backend

# Install new dependencies if any
npm install --only=production

# Rebuild
npm run build

# Database migrations (if needed)
npm run db:push

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

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
# 1. Pull Latest Changes (+ self-update guard)
# ===============================================
# Скрипт обновляет сам себя через git pull. Если тянуть изменения «по ходу»,
# bash продолжит исполнять СТАРУЮ версию файла с диска (эта ловушка уже один раз
# тихо выкатывала старую логику). Решение: на первом проходе тянем изменения и
# через exec перезапускаем уже свежую копию скрипта.
if [ -z "${UPDATE_VPS_REEXEC:-}" ]; then
  echo "📥 Pulling latest changes from Git..."

  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  echo "📍 Current branch: $CURRENT_BRANCH"

  if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
      echo "⚠️  Not on $BRANCH branch — switching..."
      git fetch origin "$BRANCH"
      git checkout "$BRANCH"
  fi

  git pull origin "$BRANCH"

  echo "✅ Changes pulled — перезапуск обновлённого скрипта"
  export UPDATE_VPS_REEXEC=1
  exec bash "$0" "$@"
fi

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

# Regenerate Prisma Client BEFORE tsc. `npm install` is a no-op when deps are
# unchanged and does NOT re-run `prisma generate`, leaving a STALE client without
# new schema fields (e.g. groupId) → tsc fails with "X does not exist in type ...".
npx prisma generate

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

# Сохраняем ассеты предыдущей сборки. vite (emptyOutDir) стирает dist целиком,
# поэтому уже-открытые клиенты на СТАРОМ app shell ловят 404 на lazy-чанки
# (CalculatorModal/CreatePollForm и т.п.) до своей перезагрузки. Кладём старые
# хешированные файлы обратно ПОВЕРХ новой сборки (cp -n: новые не перезатираем),
# чтобы редеплой был бесшовным даже для клиентов без preloadError-хендлера.
PREV_ASSETS="$(mktemp -d)"
if [ -d dist/assets ]; then
  cp -a dist/assets/. "$PREV_ASSETS"/ 2>/dev/null || true
fi

# Rebuild
npm run build

# Возвращаем чанки прошлых сборок рядом с новыми (graceful для stale-клиентов).
if [ -d "$PREV_ASSETS" ]; then
  cp -rn "$PREV_ASSETS"/. dist/assets/ 2>/dev/null || true
  rm -rf "$PREV_ASSETS"
fi

# Прунинг: не копим старые ассеты вечно — удаляем файлы старше 14 дней
# (mtime сохраняется через cp -a, поэтому стареют от своей исходной сборки).
find dist/assets -type f -mtime +14 -delete 2>/dev/null || true

cd ..

echo "✅ Frontend updated ($FRONTEND_DIR)"

# ===============================================
# 4. Reload Application (zero-downtime)
# ===============================================
echo "🔄 Reloading application..."

cd backend

# Гигиена: убиваем orphan-процессы бота, не управляемые pm2 (инцидент 2026-07-20 —
# осиротевший процесс + pm2-процесс запустили два scheduler'а и создали дубль
# автоголосований). pm2-процесс НЕ трогаем.
PM2_PID="$(pm2 pid rocket-lunch-bot 2>/dev/null | head -1)"
for pid in $(pgrep -f 'dist/index.js' 2>/dev/null || true); do
  if [ -n "$pid" ] && [ "$pid" != "$PM2_PID" ]; then
    echo "⚠️  Killing stray bot process $pid (not managed by pm2)"
    kill "$pid" 2>/dev/null || true
  fi
done

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

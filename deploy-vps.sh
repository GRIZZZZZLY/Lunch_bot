#!/usr/bin/env bash

# Ручное развёртывание Rocket Lunch на VPS.
# Переменные: BRANCH, DOMAIN и FRONTEND_DIR.

set -euo pipefail

BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-rocketlunch.dpdns.org}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend-new}"
APP_ROOT="$(pwd)"

echo "Развёртывание ветки $BRANCH; клиент: $FRONTEND_DIR"

git fetch origin "$BRANCH"
if [ "$(git branch --show-current)" != "$BRANCH" ]; then
  git switch "$BRANCH"
fi
git pull --ff-only origin "$BRANCH"

test -f backend/.env.production
install -m 600 backend/.env.production backend/.env
if [ -f "$FRONTEND_DIR/.env.production" ]; then
  install -m 600 "$FRONTEND_DIR/.env.production" "$FRONTEND_DIR/.env"
fi

(
  cd backend
  npm ci
  npm run db:generate
  npm run build:prod
)

(
  cd "$FRONTEND_DIR"
  npm ci
  npm run build
)

(
  cd backend
  npm run db:migrate:prod
  if [ -f scripts/backfill-poll-participants.ts ]; then
    npx tsx scripts/backfill-poll-participants.ts
  fi
  npm prune --omit=dev
)

APP_ROOT="$APP_ROOT" BACKEND_ENV_FILE="$APP_ROOT/backend/.env" \
  pm2 startOrReload ecosystem.config.js --only rocket-lunch-bot --update-env
pm2 save

curl --fail --silent --show-error --retry 6 --retry-delay 5 \
  http://127.0.0.1:3001/health >/dev/null

echo "Развёртывание завершено: https://$DOMAIN"

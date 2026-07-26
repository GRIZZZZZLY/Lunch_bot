#!/usr/bin/env bash

# Развёртывание отладочной production-сборки на VPS.
# Не использует prisma db push и не переключается на устаревшую ветку.

set -euo pipefail

BRANCH="${BRANCH:-main}"
APP_ROOT="$(pwd)"

git fetch origin "$BRANCH"
if [ "$(git branch --show-current)" != "$BRANCH" ]; then
  git switch "$BRANCH"
fi
git pull --ff-only origin "$BRANCH"

test -f backend/.env.prod-dev
test -f frontend/.env.prod-dev
install -m 600 backend/.env.prod-dev backend/.env
install -m 600 frontend/.env.prod-dev frontend/.env

(
  cd backend
  npm ci
  npm run db:generate
  npm run build:prod
)

(
  cd frontend
  npm ci
  npx vite build --config vite.config.prod-dev.ts
)

(
  cd backend
  npm run db:migrate:prod
)

APP_ROOT="$APP_ROOT" BACKEND_ENV_FILE="$APP_ROOT/backend/.env" \
  pm2 startOrReload ecosystem.config.js --only rocket-lunch-bot --update-env
pm2 save

curl --fail --silent --show-error --retry 6 --retry-delay 5 \
  http://127.0.0.1:3001/health >/dev/null

echo 'Отладочная production-сборка успешно развёрнута.'

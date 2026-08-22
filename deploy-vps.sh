#!/usr/bin/env bash

# Ручное развёртывание Rocket Lunch на VPS.
# Переменные: BRANCH, DOMAIN, FRONTEND_DIR и ENV_SUFFIX.
#
# ENV_SUFFIX выбирает и набор .env, И режим сборки Vite: production (по
# умолчанию) или prod-dev — отладочная production-сборка. Отдельный
# deploy-prod-dev-vps.sh для этого больше не нужен: он собирал каталог
# frontend/, в котором нет package.json, то есть падал на `npm ci` при любом
# запуске.
#
# Почему режим передаётся явно, а не только через копирование .env: Vite решает
# по mode И какие .env грузить, И значение `sourcemap: mode !== 'production'`
# (frontend-new/vite.config.ts:34). Без `--mode prod-dev` сборка вышла бы
# production-бандлом без sourcemap, то есть отладочного в ней не было бы
# вообще, а `.env.production` перебил бы скопированный `.env` по приоритету.

set -euo pipefail

BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-rocketlunch.dpdns.org}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend-new}"
ENV_SUFFIX="${ENV_SUFFIX:-production}"
APP_ROOT="$(pwd)"

# Белый список: опечатка в ENV_SUFFIX не должна тихо собрать чужой env.
case "$ENV_SUFFIX" in
  production | prod-dev) ;;
  *)
    echo "ENV_SUFFIX must be 'production' or 'prod-dev', got: $ENV_SUFFIX" >&2
    exit 1
    ;;
esac

echo "Развёртывание ветки $BRANCH; клиент: $FRONTEND_DIR; env: $ENV_SUFFIX"

git fetch origin "$BRANCH"
if [ "$(git branch --show-current)" != "$BRANCH" ]; then
  git switch "$BRANCH"
fi
git pull --ff-only origin "$BRANCH"

# Оба файла обязательны, симметрично: раньше отсутствие фронтового .env
# молча пропускалось, и сборка уезжала на env предыдущего выката.
test -f "backend/.env.$ENV_SUFFIX"
test -f "$FRONTEND_DIR/.env.$ENV_SUFFIX"
install -m 600 "backend/.env.$ENV_SUFFIX" backend/.env
install -m 600 "$FRONTEND_DIR/.env.$ENV_SUFFIX" "$FRONTEND_DIR/.env"

(
  cd backend
  npm ci
  npm run db:generate
  npm run build:prod
)

(
  cd "$FRONTEND_DIR"
  npm ci
  npm run build -- --mode "$ENV_SUFFIX"
)

(
  cd backend
  npm run db:migrate:prod
  if [ -f scripts/backfill-poll-participants.ts ]; then
    npx tsx scripts/backfill-poll-participants.ts
  fi
  # На отладочном стенде dev-зависимости нужны: без них нет ни tsx для
  # ручных скриптов обслуживания, ни prisma studio.
  if [ "$ENV_SUFFIX" = 'production' ]; then
    npm prune --omit=dev
  fi
)

APP_ROOT="$APP_ROOT" BACKEND_ENV_FILE="$APP_ROOT/backend/.env" \
  pm2 startOrReload ecosystem.config.js --only rocket-lunch-bot --update-env
pm2 save

curl --fail --silent --show-error --retry 6 --retry-delay 5 \
  http://127.0.0.1:3001/health >/dev/null

echo "Развёртывание завершено: https://$DOMAIN"

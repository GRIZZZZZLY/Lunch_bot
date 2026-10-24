#!/usr/bin/env bash
# Все проверки проекта. CI на GitHub нет: этот скрипт запускается перед каждым
# пушем в main — git-хук `.githooks/pre-push` делает это сам после
# `git config core.hooksPath .githooks`.
#
# Нужны PostgreSQL и Redis. По умолчанию — локальные из WSL (порты 5433 и 6380);
# другой адрес задаётся переменными:
#   TEST_DATABASE_URL  база для тестов сервера (имя должно содержать "test")
#   E2E_DATABASE_URL   база для сквозных сценариев с настоящим сервером
#   REDIS_URL          Redis для тестов и сервера
#   API_PORT           порт сервера для сквозных сценариев (3001 бывает занят)
#
# Каждый шаг печатает заголовок; первый упавший шаг останавливает прогон.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgresql://foodbot:foodbot_password@127.0.0.1:5433/foodbot_test_db}"
E2E_DATABASE_URL="${E2E_DATABASE_URL:-${TEST_DATABASE_URL%/*}/foodbot_e2e_test}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6380/0}"
API_PORT="${API_PORT:-3201}"

step() { printf '\n== %s\n' "$*"; }

step "Кодировка русского текста"
(cd "$ROOT" && npm run --silent check:mojibake)

step "Сервер: Prisma Client, линтер, сборка"
(
  cd "$ROOT/backend"
  npm run --silent db:generate
  npm run --silent lint
  npm run --silent build:prod
)

step "Сервер: тесты на настоящих PostgreSQL и Redis"
(
  cd "$ROOT/backend"
  NODE_ENV=test JWT_SECRET=check-all-jwt-secret-that-is-at-least-32-characters \
    BOT_TOKEN=777000:test REDIS_ENABLED=true ENABLE_RATE_LIMIT=false \
    npx jest --runInBand --silent
)

step "Мини-приложение: типы, линтер, тесты, сборка"
(
  cd "$ROOT/frontend-new"
  npm run --silent type-check
  npm run --silent type-check:e2e
  npm run --silent lint
  npx vitest run
  npm run --silent build
)

step "Сквозные сценарии: интерфейс на подставном API"
(cd "$ROOT/frontend-new" && npx playwright test --project=mobile-chromium)

step "Сквозные сценарии: интерфейс + настоящий сервер + PostgreSQL"
(
  cd "$ROOT/backend"
  export NODE_ENV=test DATABASE_URL="$E2E_DATABASE_URL" TEST_DATABASE_URL="$E2E_DATABASE_URL"
  export REDIS_ENABLED=true BOT_TOKEN=777000:test_e2e_bot_token E2E_BOT_TOKEN=777000:test_e2e_bot_token
  export TELEGRAM_SECRET_KEY=e2e-only-telegram-secret JWT_SECRET=e2e-only-jwt-secret-that-is-at-least-32-characters
  export WEBAPP_URL="http://127.0.0.1:$API_PORT" CORS_ORIGIN="http://127.0.0.1:$API_PORT"
  export PROCESS_ROLE=api FRONTEND_DIR=frontend-new API_HOST=127.0.0.1 API_PORT ENABLE_RATE_LIMIT=false

  # База создаётся, если её нет, и доводится до последней миграции — как на
  # продакшене, без сброса: сид сам вычищает свои прошлые данные.
  node -e "
    const { Client } = require('pg');
    const url = new URL(process.env.DATABASE_URL);
    const name = url.pathname.slice(1);
    url.pathname = '/postgres';
    const c = new Client({ connectionString: url.toString() });
    c.connect()
      .then(() => c.query('SELECT 1 FROM pg_database WHERE datname = \$1', [name]))
      .then(r => r.rowCount ? null : c.query('CREATE DATABASE \"' + name + '\"'))
      .then(() => c.end())
      .catch(e => { console.error(e.message); process.exit(1); });
  "
  npx prisma migrate deploy >/dev/null
  npm run --silent e2e:seed

  node dist/index.js > "$ROOT/e2e-backend.log" 2>&1 &
  server=$!
  trap 'kill $server 2>/dev/null || true; npm run --silent e2e:cleanup >/dev/null 2>&1 || true' EXIT
  for _ in $(seq 1 30); do
    curl --fail --silent "http://127.0.0.1:$API_PORT/health/ready" >/dev/null && break
    sleep 1
  done
  curl --fail --silent "http://127.0.0.1:$API_PORT/health/ready" >/dev/null || {
    echo "Сервер не поднялся, лог: $ROOT/e2e-backend.log" >&2
    exit 1
  }

  cd "$ROOT/frontend-new"
  E2E_INTEGRATION=1 E2E_INTEGRATION_BASE_URL="http://127.0.0.1:$API_PORT" \
    npx playwright test --project=integration
)

step "Все проверки пройдены"

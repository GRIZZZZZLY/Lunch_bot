#!/bin/bash

# ===============================================
# 🔄 Quick Update Script for VPS
# ===============================================
# Configurable: BRANCH=main (default), FRONTEND_DIR=frontend-new (default)

set -e

BRANCH="${BRANCH:-main}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend-new}"

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

  # Коммит ДО подтягивания: по нему второй проход поймёт, что именно приехало,
  # и не станет пересобирать то, что не менялось.
  BEFORE_SHA=$(git rev-parse HEAD)

  git pull origin "$BRANCH"

  echo "✅ Changes pulled — перезапуск обновлённого скрипта"
  export UPDATE_VPS_REEXEC=1
  export UPDATE_VPS_BEFORE="$BEFORE_SHA"
  exec bash "$0" "$@"
fi

# ===============================================
# 1a. Что именно приехало
# ===============================================
# Полная сборка занимала минуты, и почти всегда впустую: правка в одном CSS
# запускала npm install бэкенда (548 МБ дерева), tsc, миграции, бэкфилл и
# перезапуск pm2. Здесь каждый шаг спрашивает, менялось ли то, что он собирает.
#
# FULL=1 (собрать всё) — когда предыдущий коммит неизвестен: так будет на первом
# запуске этой версии скрипта (её тянет ещё старая) и при ручном вызове с
# выставленным UPDATE_VPS_REEXEC. Незнание всегда трактуем в пользу полной сборки.
FULL=0
CHANGED=""
if [ -z "${UPDATE_VPS_BEFORE:-}" ]; then
  FULL=1
  echo "🧱 Предыдущий коммит неизвестен — собираем всё"
elif [ "$UPDATE_VPS_BEFORE" = "$(git rev-parse HEAD)" ]; then
  echo "✅ Обновлений нет — сборка не нужна"
  exit 0
else
  CHANGED=$(git diff --name-only "$UPDATE_VPS_BEFORE" HEAD)
  echo "📋 Изменено файлов: $(printf '%s\n' "$CHANGED" | grep -c . || true)"
fi

touched() {
  [ "$FULL" = 1 ] && return 0
  printf '%s\n' "$CHANGED" | grep -qE "$1"
}

BACKEND_TOUCHED=0
touched '^backend/' && BACKEND_TOUCHED=1
FRONT_TOUCHED=0
touched "^${FRONTEND_DIR}/" && FRONT_TOUCHED=1

echo "   Бэкенд: $([ "$BACKEND_TOUCHED" = 1 ] && echo 'пересобрать' || echo 'без изменений')"
echo "   Фронтенд: $([ "$FRONT_TOUCHED" = 1 ] && echo 'пересобрать' || echo 'без изменений')"

# ===============================================
# 2. Update Backend
# ===============================================
if [ "$BACKEND_TOUCHED" = 1 ]; then
echo "🔨 Updating backend..."

cd backend

# Install ALL dependencies (including devDependencies).
# ВАЖНО: `npm run build` (tsc) требует devDeps (@types/*, typescript).
# Раньше тут было `--only=production` → tsc падал с TS7016 (нет @types/express)
# и `set -e` прерывал деплой ДО pm2 reload. Не возвращать --only=production.
#
# Установка только при смене манифеста: на неизменном дереве npm install всё
# равно проверяет 548 МБ и стоит десятки секунд, ничего не меняя.
if touched '^backend/package(-lock)?\.json$' || [ ! -d node_modules ]; then
  npm install
else
  echo "⏭️  Зависимости бэкенда не менялись"
fi

# Regenerate Prisma Client BEFORE tsc. `npm install` is a no-op when deps are
# unchanged and does NOT re-run `prisma generate`, leaving a STALE client without
# new schema fields (e.g. groupId) → tsc fails with "X does not exist in type ...".
# Отсутствие клиента проверяем отдельно: без него tsc падёт, даже если схема
# в этом коммите не менялась.
if touched '^backend/prisma/schema\.prisma$' || [ ! -d node_modules/.prisma/client ]; then
  npx prisma generate
else
  echo "⏭️  Схема Prisma не менялась"
fi

# Rebuild
npm run build

# Database migrations (if any new ones in prisma/migrations/)
if touched '^backend/prisma/migrations/'; then
  npm run db:migrate:prod
else
  echo "⏭️  Новых миграций нет"
fi

# Backfill PollParticipant snapshots (idempotent, safe to run on every update)
npx tsx scripts/backfill-poll-participants.ts || echo "⚠️ Backfill failed (non-critical)"

cd ..

echo "✅ Backend updated"
else
  echo "⏭️  Бэкенд не менялся — сборка, миграции и бэкфилл пропущены"
fi

# ===============================================
# 3. Update Frontend
# ===============================================
if [ "$FRONT_TOUCHED" = 1 ]; then
echo "🎨 Updating frontend..."

cd "$FRONTEND_DIR"

# Install new dependencies if any — тоже только при смене манифеста.
if touched "^${FRONTEND_DIR}/package(-lock)?\.json$" || [ ! -d node_modules ]; then
  npm install
else
  echo "⏭️  Зависимости фронтенда не менялись"
fi

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
# cp -an, а не -rn: -a сохраняет mtime. С -rn каждый возврат проставлял файлам
# время текущего деплоя, поэтому прунинг ниже не удалял НИЧЕГО — за две недели
# накопилось 263 файла и 11 МБ при 28 реально нужных. Комментарий про «стареют
# от своей исходной сборки» описывал замысел, которого код не выполнял.
if [ -d "$PREV_ASSETS" ]; then
  cp -an "$PREV_ASSETS"/. dist/assets/ 2>/dev/null || true
  rm -rf "$PREV_ASSETS"
fi

# Прунинг: не копим старые ассеты вечно — удаляем файлы старше 14 дней
# (mtime сохраняется через cp -a, поэтому стареют от своей исходной сборки).
find dist/assets -type f -mtime +14 -delete 2>/dev/null || true

cd ..

echo "✅ Frontend updated ($FRONTEND_DIR)"
else
  echo "⏭️  Фронтенд не менялся — сборка пропущена"
fi

# ===============================================
# 4. Reload Application (zero-downtime)
# ===============================================
# Только если менялся бэкенд. Статику Express отдаёт с диска на каждый запрос
# (express.static + sendFile в api/server.ts), поэтому новая сборка фронтенда
# начинает раздаваться сама — перезапуск ей не нужен и стоит лишнего простоя
# соединений SSE.
if [ "$BACKEND_TOUCHED" = 1 ]; then
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

cd ..

echo "✅ Application reloaded"
else
  echo "⏭️  Бэкенд не менялся — перезапуск не нужен, статика уже свежая"
fi

# ===============================================
# 5. Health Check
# ===============================================
# Проверяем всегда, даже когда ничего не перезапускали: деплой обязан
# заканчиваться утверждением о живом приложении, а не о выполненных шагах.
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

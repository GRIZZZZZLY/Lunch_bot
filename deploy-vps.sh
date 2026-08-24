#!/usr/bin/env bash

# Ручной выпуск Rocket Lunch на VPS — запасной путь, когда GitHub Actions
# недоступен. Канонический путь: `.github/workflows/deploy.yml`.
#
# Скрипт намеренно повторяет шаги workflow, а не изобретает свои: иначе ручной
# выкат оставляет сервер в состоянии, которого автоматический не ожидает.
#
# Схема на сервере — релиз-каталоги по коммиту:
#
#   projects/telegram-food-bot                   исходный чекаут, ветка main,
#                                                источник `backend/.env`
#   projects/telegram-food-bot-releases/<sha>/   git worktree на этот коммит
#   projects/telegram-food-bot-releases/current  симлинк на действующий релиз
#   .../.previous-release                        путь предыдущего, для отката
#
# Прежняя версия скрипта делала `git pull` и `git switch main` в одном каталоге
# и на этом сервере не отрабатывала НИ РАЗУ: релизы — worktree одного
# репозитория, ветка `main` занята исходным чекаутом, и git отвечает
# «'main' is already checked out at …». Плюс требовала `backend/.env.production`
# и `frontend-new/.env.production`, которых на сервере нет. Все выкаты шли мимо
# неё, руками.
#
# Три грабли, ради которых скрипт и существует:
#
# 1. `pm2 startOrReload` НЕ меняет script path у уже запущенного процесса: он
#    перезапустит бинарник ПРОШЛОГО релиза и отрапортует успех. Смена релиза —
#    это `pm2 delete` + `pm2 start` (см. switch_release).
# 2. `.env` в репозитории нет. Источник истины — `backend/.env` исходного
#    чекаута, оттуда же его берёт workflow.
# 3. В свежем worktree нет `backend/logs` и `backend/uploads`: они в .gitignore.
#    Без симлинков на общие каталоги логи и загрузки теряются при каждом выкате.
#
# Переменные: BRANCH, REF, DOMAIN, ENV_SUFFIX, PM2_APP, HEALTH_URL,
# SOURCE_CHECKOUT, RELEASES_DIR, BACKEND_ENV.
#
# ENV_SUFFIX выбирает режим сборки Vite: production (по умолчанию) или prod-dev
# — отладочная production-сборка. Vite решает по mode И какие `.env` грузить, И
# значение `sourcemap: mode !== 'production'` (frontend-new/vite.config.ts).

set -euo pipefail

BRANCH="${BRANCH:-main}"
REF="${REF:-origin/$BRANCH}"
DOMAIN="${DOMAIN:-rocketlunch.dpdns.org}"
ENV_SUFFIX="${ENV_SUFFIX:-production}"
PM2_APP="${PM2_APP:-rocket-lunch-bot}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/health}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend-new}"

# Белый список: опечатка в ENV_SUFFIX не должна тихо собрать чужой env.
case "$ENV_SUFFIX" in
  production | prod-dev) ;;
  *)
    echo "ENV_SUFFIX must be 'production' or 'prod-dev', got: $ENV_SUFFIX" >&2
    exit 1
    ;;
esac

# Старый интерфейс удалён, поддерживается единственный каталог (как в workflow).
if [ "$FRONTEND_DIR" != 'frontend-new' ]; then
  echo "Unsupported FRONTEND_DIR: $FRONTEND_DIR" >&2
  exit 1
fi

# Корень вычисляется, а не берётся из pwd: скрипт запускают и из worktree
# предыдущего релиза, а `--git-common-dir` из любого worktree указывает на .git
# исходного чекаута.
SOURCE_CHECKOUT="${SOURCE_CHECKOUT:-$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")}"
RELEASES_DIR="${RELEASES_DIR:-${SOURCE_CHECKOUT%/}-releases}"
CURRENT_LINK="$RELEASES_DIR/current"
PREVIOUS_FILE="$RELEASES_DIR/.previous-release"
BACKEND_ENV="${BACKEND_ENV:-$SOURCE_CHECKOUT/backend/.env}"

log() { printf '\n== %s\n' "$*"; }

test -d "$SOURCE_CHECKOUT/backend"
test -f "$BACKEND_ENV"

log "Источник: $SOURCE_CHECKOUT (ветка $BRANCH); релизы: $RELEASES_DIR"

git -C "$SOURCE_CHECKOUT" fetch --prune origin "$BRANCH"
SHA="$(git -C "$SOURCE_CHECKOUT" rev-parse "$REF^{commit}")"
RELEASE="$RELEASES_DIR/$SHA"
log "Релиз: ${SHA:0:8} → $RELEASE"

PREVIOUS=""
if [ -L "$CURRENT_LINK" ]; then
  PREVIOUS="$(readlink -f "$CURRENT_LINK")"
fi

# --- Подготовка релиза ---------------------------------------------------

mkdir -p "$RELEASES_DIR"
if [ -d "$RELEASE" ]; then
  log "Worktree уже есть, переиспользуем"
  git -C "$RELEASE" checkout --detach "$SHA"
else
  git -C "$SOURCE_CHECKOUT" worktree add --detach "$RELEASE" "$SHA"
fi

# При повторном выкате того же коммита источник и цель могут оказаться одним
# файлом, и `install` на этом падает. Сравниваем разыменованные пути.
if [ "$(readlink -f "$BACKEND_ENV")" != "$(readlink -f "$RELEASE/backend/.env" 2>/dev/null || true)" ]; then
  install -m 600 "$BACKEND_ENV" "$RELEASE/backend/.env"
fi

# Фронтовый .env опционален: на проде его нет, режим сборки задаёт `--mode`.
for name in ".env" ".env.$ENV_SUFFIX"; do
  if [ -f "$SOURCE_CHECKOUT/$FRONTEND_DIR/$name" ]; then
    install -m 600 "$SOURCE_CHECKOUT/$FRONTEND_DIR/$name" "$RELEASE/$FRONTEND_DIR/$name"
  fi
done

# Логи и загрузки — общие на все релизы, иначе история рвётся при каждом выкате.
for runtime_dir in uploads logs; do
  mkdir -p "$SOURCE_CHECKOUT/backend/$runtime_dir"
  if [ ! -e "$RELEASE/backend/$runtime_dir" ]; then
    ln -s "$SOURCE_CHECKOUT/backend/$runtime_dir" "$RELEASE/backend/$runtime_dir"
  fi
done

# --- Сборка (действующий релиз ещё работает) -----------------------------

log "Сборка бекенда"
(
  cd "$RELEASE/backend"
  npm ci
  npm run db:generate
  npm run build:prod
)

log "Сборка клиента ($FRONTEND_DIR, mode=$ENV_SUFFIX)"
(
  cd "$RELEASE/$FRONTEND_DIR"
  npm ci
  npm run build -- --mode "$ENV_SUFFIX"
)

log "Миграции"
(
  cd "$RELEASE/backend"
  npm run db:migrate:prod
  if [ -f scripts/backfill-poll-participants.ts ]; then
    npx tsx scripts/backfill-poll-participants.ts
  fi
  # На отладочном стенде dev-зависимости нужны: без них нет ни tsx для ручных
  # скриптов обслуживания, ни prisma studio.
  if [ "$ENV_SUFFIX" = 'production' ]; then
    npm prune --omit=dev
  fi
)

# --- Переключение --------------------------------------------------------

# `pm2 delete` + `pm2 start`, а не `startOrReload`: см. грабли №1 в шапке.
switch_release() {
  local root="$1"
  ln -sfn "$root" "$RELEASES_DIR/current.next"
  mv -Tf "$RELEASES_DIR/current.next" "$CURRENT_LINK"
  pm2 delete "$PM2_APP" >/dev/null 2>&1 || true
  APP_ROOT="$root" BACKEND_ENV_FILE="$root/backend/.env" \
    pm2 start "$root/ecosystem.config.js" --only "$PM2_APP" --update-env
  pm2 save >/dev/null
}

health_ok() {
  curl --fail --silent --show-error --retry 8 --retry-delay 5 "$HEALTH_URL" >/dev/null
}

if [ -n "$PREVIOUS" ]; then
  printf '%s\n' "$PREVIOUS" > "$PREVIOUS_FILE"
else
  : > "$PREVIOUS_FILE"
fi

log "Переключение на ${SHA:0:8}"
switch_release "$RELEASE"

# Уборка старых релизов. Правила те же, что у шага 'Prune old releases' в
# workflow: держим current, previous и KEEP_RELEASES свежих, трогаем только
# каталоги с именем ровно из 40 hex-символов. Каждый релиз несёт свои
# node_modules (~800 МБ), поэтому без уборки ручные выкаты съедают диск.
prune_releases() {
  local keep="${KEEP_RELEASES:-3}" kept=0 removed=0 name
  local current previous
  current="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
  previous="$(readlink -f "$(cat "$PREVIOUS_FILE" 2>/dev/null || true)" 2>/dev/null || true)"

  while IFS= read -r dir; do
    [ -n "$dir" ] || continue
    name="$(basename "$dir")"
    if [ ${#name} -ne 40 ] || [ -n "$(printf '%s' "$name" | tr -d '0-9a-f')" ]; then
      continue
    fi
    if [ "$dir" = "$current" ] || [ "$dir" = "$previous" ] || [ "$kept" -lt "$keep" ]; then
      kept=$((kept + 1))
      continue
    fi
    removed=$((removed + 1))
    echo "удаляю релиз $(basename "$dir" | cut -c1-8)"
    git -C "$SOURCE_CHECKOUT" worktree remove --force "$dir" 2>/dev/null ||
      rm -rf -- "$dir" ||
      echo "не удалось удалить $dir" >&2
  done <<< "$(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@\t%p\n' |
    sort -rn | cut -f2-)"

  git -C "$SOURCE_CHECKOUT" worktree prune 2>/dev/null || true
  echo "релизов оставлено: $kept, удалено: $removed"
}

if health_ok && pm2 jlist | grep -qF "$RELEASE/backend/dist/index.js"; then
  log "Готово: https://$DOMAIN (релиз ${SHA:0:8})"
  # Только после подтверждённого health-check: пока новый релиз не проверен,
  # старые — единственный путь отката, и падение уборки не должно валить выкат.
  log "Уборка старых релизов"
  prune_releases || echo "уборка не удалась, выкат при этом успешен" >&2
  exit 0
fi

echo "Новый релиз не поднялся (health-check или script path)" >&2
if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ] && [ "$PREVIOUS" != "$RELEASE" ]; then
  echo "Откат на $(basename "$PREVIOUS")" >&2
  switch_release "$PREVIOUS"
  if health_ok; then
    echo "Откат выполнен, прод на прежнем релизе" >&2
  else
    echo "ОТКАТ НЕ ПОМОГ — прод лежит, нужен ручной разбор" >&2
  fi
fi
exit 1

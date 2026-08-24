#!/usr/bin/env bash

# Запуск прод-смоука. Точка входа systemd-юнита.
#
# Существует ради одного: токен бота берётся из ЖИВОГО `backend/.env` при каждом
# запуске, а не замораживается при установке. `install-vps.sh` копировал токен
# один раз; после ротации стенд подписывал initData отозванным ключом, прод
# отвечал 401, и три из четырёх тестов краснели на каждом прогоне месяц подряд —
# никто не смотрел, потому что «оно всегда красное». Расхождение теперь чинится
# само и попадает в лог.
#
# Путь к боевому `.env`: переменная BACKEND_ENV, иначе BACKEND_ENV_PATH из
# `.env` стенда, иначе `../../backend/.env` (раскладка, где стенд лежит внутри
# рабочей копии).

set -euo pipefail

smoke_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
smoke_env="$smoke_dir/.env"

if [ ! -f "$smoke_env" ]; then
  echo "Не найден $smoke_env — стенд не установлен (см. install-vps.sh)" >&2
  exit 1
fi

read_env_value() { sed -n "s/^$2=//p" "$1" | tail -1 | tr -d '\r"'; }

backend_env="${BACKEND_ENV:-$(read_env_value "$smoke_env" BACKEND_ENV_PATH)}"
backend_env="${backend_env:-$smoke_dir/../../backend/.env}"

if [ ! -f "$backend_env" ]; then
  echo "Не найден боевой backend/.env по пути: $backend_env" >&2
  echo "Укажите его в BACKEND_ENV или в BACKEND_ENV_PATH внутри $smoke_env" >&2
  exit 1
fi

live_token=$(read_env_value "$backend_env" BOT_TOKEN)
if [ -z "$live_token" ]; then
  echo "В $backend_env нет BOT_TOKEN" >&2
  exit 1
fi

if [ "$(read_env_value "$smoke_env" E2E_PRODUCTION_BOT_TOKEN)" != "$live_token" ]; then
  echo "Токен стенда разошёлся с боевым — обновляю из $backend_env"
  tmp=$(mktemp)
  trap 'rm -f "$tmp"' EXIT
  awk -v token="$live_token" \
    '/^E2E_PRODUCTION_BOT_TOKEN=/ { print "E2E_PRODUCTION_BOT_TOKEN=" token; next } { print }' \
    "$smoke_env" > "$tmp"
  install -m 600 "$tmp" "$smoke_env"
fi

# Предупреждение, а не отказ: недоступный Telegram — не повод красить прод-смоук
# в красный, но знать про отозванный токен нужно до разбора четырёх падений.
if command -v curl >/dev/null 2>&1; then
  if ! curl -fsS -m 15 "https://api.telegram.org/bot$live_token/getMe" >/dev/null 2>&1; then
    echo "ВНИМАНИЕ: getMe с этим токеном не проходит — подпись initData не сойдётся" >&2
  fi
fi

cd "$smoke_dir"
exec docker compose run --rm production-smoke

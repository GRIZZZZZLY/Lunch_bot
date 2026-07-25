#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ] || [ "$#" -gt 6 ]; then
  echo "Использование: bash install-vps.sh <https-url> <telegram-user-id> <group-name> [first-name] [last-name] [username]" >&2
  exit 2
fi

base_url=$1
user_id=$2
group_name=$3
first_name=${4:-Проверка}
last_name=${5:-Продакшена}
username=${6:-production_smoke}

case "$base_url" in
  https://*) ;;
  *) echo "Адрес должен использовать HTTPS." >&2; exit 2 ;;
esac

case "$user_id" in
  ''|*[!0-9]*) echo "Telegram user ID должен быть положительным числом." >&2; exit 2 ;;
esac

for value in "$group_name" "$first_name" "$last_name" "$username"; do
  case "$value" in
    *$'\n'*|*$'\r'*) echo "Значения не должны содержать переносы строк." >&2; exit 2 ;;
  esac
done

smoke_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_root=$(CDPATH= cd -- "$smoke_dir/../.." && pwd)
backend_env="$project_root/backend/.env"
service_name=telegram-food-bot-production-smoke

if [ ! -f "$backend_env" ]; then
  echo "Не найден $backend_env" >&2
  exit 1
fi

bot_token=$(sed -n 's/^BOT_TOKEN=//p' "$backend_env" | tail -1 | tr -d '\r"')
if [ -z "$bot_token" ]; then
  echo "В backend/.env отсутствует BOT_TOKEN." >&2
  exit 1
fi

umask 077
{
  printf 'E2E_ALLOW_PRODUCTION=1\n'
  printf 'E2E_PRODUCTION_BASE_URL=%s\n' "$base_url"
  printf 'E2E_PRODUCTION_BOT_TOKEN=%s\n' "$bot_token"
  printf 'E2E_PRODUCTION_USER_ID=%s\n' "$user_id"
  printf 'E2E_PRODUCTION_FIRST_NAME=%s\n' "$first_name"
  printf 'E2E_PRODUCTION_LAST_NAME=%s\n' "$last_name"
  printf 'E2E_PRODUCTION_USERNAME=%s\n' "$username"
  printf 'E2E_PRODUCTION_GROUP_NAME=%s\n' "$group_name"
} > "$smoke_dir/.env"

mkdir -p "$smoke_dir/artifacts"
cd "$smoke_dir"
docker compose config --quiet
docker compose build --pull production-smoke

runner_uid=$(docker compose run --rm --no-deps --entrypoint id production-smoke -u)
runner_gid=$(docker compose run --rm --no-deps --entrypoint id production-smoke -g)
sudo chown "$runner_uid:$runner_gid" "$smoke_dir/artifacts"
sudo chmod 755 "$smoke_dir/artifacts"

echo "Первый безопасный прогон перед включением расписания..."
docker compose run --rm production-smoke

unit_tmp=$(mktemp)
trap 'rm -f "$unit_tmp"' EXIT
sed "s|^WorkingDirectory=.*$|WorkingDirectory=$smoke_dir|" \
  "$smoke_dir/$service_name.service" > "$unit_tmp"
sudo install -m 644 "$unit_tmp" "/etc/systemd/system/$service_name.service"
sudo install -m 644 \
  "$smoke_dir/$service_name.timer" "/etc/systemd/system/$service_name.timer"
sudo systemctl daemon-reload
sudo systemctl enable --now "$service_name.timer"
sudo systemctl list-timers "$service_name.timer" --no-pager

echo "Проверка установлена. Секреты сохранены только в $smoke_dir/.env с правами 600."

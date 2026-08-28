#!/usr/bin/env bash

# Отправка произвольного текста в Telegram. Текст — первым аргументом или со
# стандартного ввода.
#
# Общий низ для всех оповещений: и падений systemd-юнитов, и сторожа
# приложения. Получатель и токен — из боевого `backend/.env`, отдельного
# секрета для оповещений не заводим.
#
# Переменные: BACKEND_ENV, ALERT_TELEGRAM_CHAT_ID.

set -uo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BACKEND_ENV="${BACKEND_ENV:-$SCRIPT_DIR/../../backend/.env}"

if [ ! -f "$BACKEND_ENV" ]; then
  echo "Не найден $BACKEND_ENV" >&2
  exit 1
fi

read_env() { sed -n "s/^$1=//p" "$BACKEND_ENV" | tail -1 | tr -d '\r"'; }

TOKEN=$(read_env BOT_TOKEN)
CHATS="${ALERT_TELEGRAM_CHAT_ID:-$(read_env ADMIN_USER_IDS)}"

if [ -z "$TOKEN" ] || [ -z "$CHATS" ]; then
  echo "Нет BOT_TOKEN или получателя (ALERT_TELEGRAM_CHAT_ID / ADMIN_USER_IDS)" >&2
  exit 1
fi

if [ "$#" -gt 0 ]; then
  TEXT="$1"
else
  TEXT="$(cat)"
fi

if [ -z "$TEXT" ]; then
  echo "Пустое сообщение — отправлять нечего" >&2
  exit 2
fi

# Ограничение Telegram — 4096 символов; режем с запасом.
if [ "${#TEXT}" -gt 3800 ]; then
  TEXT="${TEXT:0:3800}
…обрезано"
fi

# Без parse_mode: в теле сырой лог, где угловые скобки и подчёркивания обычное
# дело. Сообщение об аварии должно дойти, а не упасть на разборе разметки.
rc=0
for chat in $(printf '%s' "$CHATS" | tr ',' ' '); do
  [ -n "$chat" ] || continue
  if curl -fsS -m 20 -X POST \
    "https://api.telegram.org/bot${TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${chat}" \
    --data-urlencode "text=${TEXT}" >/dev/null; then
    echo "отправлено в чат $chat"
  else
    echo "не удалось отправить в чат $chat" >&2
    rc=1
  fi
done

exit $rc

#!/usr/bin/env bash

# Сторож приложения: процесс, здоровье, всплески ошибок в логе.
#
# `OnFailure` у таймеров ловит только падение самих регулярных заданий. Сам бот
# при этом может падать и подниматься молча: pm2 перезапускает процесс и никому
# не сообщает, а счётчик перезапусков видит лишь тот, кто зашёл на сервер.
#
# Проверяется:
#   1. процесс есть в pm2 и в статусе online;
#   2. счётчик перезапусков не вырос с прошлой проверки;
#   3. `/health` отвечает;
#   4. в error.log не появилось разом много новых строк.
#
# Оповещение шлётся на ПЕРЕХОДЕ состояния, а не каждую проверку: иначе сломанный
# прод будет слать сообщение каждые пять минут, и на них перестанут смотреть.
# Восстановление тоже сообщается — молчание неотличимо от «сторож умер».
#
# Переменные: PM2_APP, HEALTH_URL, STATE_FILE, ERROR_LOG, ERROR_BURST,
# ERROR_COOLDOWN_MIN, BACKEND_ENV.

set -uo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PM2_APP="${PM2_APP:-rocket-lunch-bot}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/health}"
STATE_FILE="${STATE_FILE:-${XDG_STATE_HOME:-$HOME/.local/state}/rocket-lunch/watch-app.state}"
ERROR_LOG="${ERROR_LOG:-$SCRIPT_DIR/../../backend/logs/error.log}"
ERROR_BURST="${ERROR_BURST:-30}"
ERROR_COOLDOWN_MIN="${ERROR_COOLDOWN_MIN:-60}"
HOST="$(hostname)"
NOW=$(date +%s)

send() { bash "$SCRIPT_DIR/send-telegram-message.sh" "$1" >/dev/null; }

mkdir -p "$(dirname "$STATE_FILE")"
# shellcheck disable=SC1090
prev_restarts=-1; prev_bad=0; prev_error_size=0; prev_error_alert=0
[ -f "$STATE_FILE" ] && . "$STATE_FILE"

problems=""
add() { problems="${problems}$1"$'\n'; }

# --- 1-2. Процесс в pm2 --------------------------------------------------

app_json=$(pm2 jlist 2>/dev/null | jq -c --arg n "$PM2_APP" '.[] | select(.name == $n)' 2>/dev/null)
if [ -z "$app_json" ]; then
  add "процесса $PM2_APP нет в pm2"
  restarts="$prev_restarts"
  status="отсутствует"
else
  status=$(printf '%s' "$app_json" | jq -r '.pm2_env.status')
  restarts=$(printf '%s' "$app_json" | jq -r '.pm2_env.restart_time // 0')
  [ "$status" = 'online' ] || add "статус процесса: $status"
  if [ "$prev_restarts" -ge 0 ] && [ "$restarts" -gt "$prev_restarts" ]; then
    # Перезапуск — событие, а не состояние: сообщаем всегда, даже если сейчас
    # процесс online. Именно так молча теряются падения по памяти и по краху.
    since=$(printf '%s' "$app_json" | jq -r '.pm2_env.pm_uptime // 0')
    uptime_s=$(( (NOW * 1000 - since) / 1000 ))
    send "🟠 ${HOST}: $PM2_APP перезапускался $((restarts - prev_restarts)) раз с прошлой проверки
статус сейчас: $status, аптайм ${uptime_s}s
Последние ошибки:
$(tail -n 5 "$ERROR_LOG" 2>/dev/null | cut -c1-300)

Разбор: pm2 logs $PM2_APP --lines 100"
  fi
fi

# --- 3. Здоровье ---------------------------------------------------------

if ! curl -fsS -m 10 "$HEALTH_URL" >/dev/null 2>&1; then
  add "$HEALTH_URL не отвечает"
fi

# --- Переход состояния ---------------------------------------------------

bad=0
[ -n "$problems" ] && bad=1

if [ "$bad" = 1 ] && [ "$prev_bad" = 0 ]; then
  send "🔴 ${HOST}: приложение нездорово
${problems}
Последние ошибки:
$(tail -n 5 "$ERROR_LOG" 2>/dev/null | cut -c1-300)

Разбор: pm2 describe $PM2_APP; journalctl -n 50"
elif [ "$bad" = 0 ] && [ "$prev_bad" = 1 ]; then
  send "🟢 ${HOST}: приложение снова в порядке ($PM2_APP online, health отвечает)"
fi

# --- 4. Всплеск ошибок в логе -------------------------------------------

error_size=0
if [ -f "$ERROR_LOG" ]; then
  error_size=$(wc -c < "$ERROR_LOG" | tr -d ' ')
  # Ротация или обрезка лога: считать «прирост» от старого размера нельзя.
  [ "$error_size" -lt "$prev_error_size" ] && prev_error_size=0
  if [ "$prev_error_size" -gt 0 ]; then
    new_lines=$(tail -c "+$((prev_error_size + 1))" "$ERROR_LOG" 2>/dev/null | wc -l | tr -d ' ')
    cooldown_over=$(( NOW - prev_error_alert > ERROR_COOLDOWN_MIN * 60 ))
    if [ "$new_lines" -ge "$ERROR_BURST" ] && [ "$cooldown_over" = 1 ]; then
      send "🟡 ${HOST}: всплеск ошибок — $new_lines новых строк в error.log с прошлой проверки
Пример:
$(tail -c "+$((prev_error_size + 1))" "$ERROR_LOG" | tail -n 3 | cut -c1-300)

Дальше молчу час, чтобы не залить чат.
Разбор: tail -n 100 $ERROR_LOG"
      prev_error_alert="$NOW"
    fi
  fi
fi

cat > "$STATE_FILE" <<STATE
prev_restarts=$restarts
prev_bad=$bad
prev_error_size=$error_size
prev_error_alert=$prev_error_alert
STATE
chmod 600 "$STATE_FILE"

if [ "$bad" = 1 ]; then
  printf 'нездоров:\n%s' "$problems"
else
  echo "ок: $PM2_APP $status, перезапусков $restarts, health отвечает"
fi

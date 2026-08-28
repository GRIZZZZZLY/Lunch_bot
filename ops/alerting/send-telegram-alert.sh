#!/usr/bin/env bash

# Оповещение в Telegram о падении systemd-юнита.
#
# Вызывается через `OnFailure=telegram-food-bot-alert@%n.service`, имя упавшего
# юнита приходит первым аргументом.
#
# Зачем: прод-смоук и бэкап пишут результат только в journald. Пока туда никто
# не смотрел, стенд простоял красным 1019 прогонов подряд — месяц. Проверка,
# о результате которой не узнают, поломку не ловит.
#
# Адресат: ALERT_TELEGRAM_CHAT_ID, иначе все id из ADMIN_USER_IDS боевого
# `backend/.env`. Токен — оттуда же (BOT_TOKEN), поэтому отдельного секрета для
# оповещений заводить не нужно и ротация токена не ломает доставку.
#
# Переменные: BACKEND_ENV, ALERT_TELEGRAM_CHAT_ID, JOURNAL_LINES.

set -uo pipefail

UNIT="${1:-неизвестный юнит}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BACKEND_ENV="${BACKEND_ENV:-$SCRIPT_DIR/../../backend/.env}"
JOURNAL_LINES="${JOURNAL_LINES:-15}"

if [ ! -f "$BACKEND_ENV" ]; then
  echo "Не найден $BACKEND_ENV — оповестить не о чем и некому" >&2
  exit 1
fi

read_env() { sed -n "s/^$1=//p" "$BACKEND_ENV" | tail -1 | tr -d '\r"'; }

TOKEN=$(read_env BOT_TOKEN)
CHATS="${ALERT_TELEGRAM_CHAT_ID:-$(read_env ADMIN_USER_IDS)}"

if [ -z "$TOKEN" ] || [ -z "$CHATS" ]; then
  echo "Нет BOT_TOKEN или получателя (ALERT_TELEGRAM_CHAT_ID / ADMIN_USER_IDS)" >&2
  exit 1
fi

result=$(systemctl show "$UNIT" -p Result --value 2>/dev/null)
status=$(systemctl show "$UNIT" -p ExecMainStatus --value 2>/dev/null)
host=$(hostname)

# Хвост журнала — самое ценное в сообщении: без него оповещение говорит «упало»
# и заставляет идти на сервер. Берём только строки процесса, без служебных
# записей systemd о запуске и остановке.
tail_lines=$(journalctl -u "$UNIT" -n 200 --no-pager -o cat 2>/dev/null |
  grep -vE '^(Starting|Started|Stopping|Stopped|Finished|Failed|Deactivated)' |
  tail -n "$JOURNAL_LINES")
[ -n "$tail_lines" ] || tail_lines="(журнал пуст — смотрите journalctl -u $UNIT)"

TEXT="🔴 ${host}: юнит $UNIT завершился с ошибкой
result=${result:-?}, exit=${status:-?}
$(date '+%F %T %Z')

Последние строки:
${tail_lines}

Разбор: journalctl -u $UNIT -n 50 --no-pager"

# Ограничение Telegram — 4096 символов на сообщение; режем с запасом.
if [ "${#TEXT}" -gt 3800 ]; then
  TEXT="${TEXT:0:3800}
…обрезано, полный текст в journalctl"
fi

# Без parse_mode: разметка требует экранирования, а в сообщении — сырой лог,
# где угловые скобки и подчёркивания встречаются постоянно. Сообщение об аварии
# должно доходить, а не падать на разборе Markdown.
rc=0
for chat in $(printf '%s' "$CHATS" | tr ',' ' '); do
  [ -n "$chat" ] || continue
  if ! curl -fsS -m 20 -X POST \
    "https://api.telegram.org/bot${TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${chat}" \
    --data-urlencode "text=${TEXT}" \
    --data-urlencode "disable_notification=false" >/dev/null; then
    echo "не удалось отправить оповещение в чат $chat" >&2
    rc=1
  else
    echo "оповещение отправлено в чат $chat про $UNIT"
  fi
done

exit $rc

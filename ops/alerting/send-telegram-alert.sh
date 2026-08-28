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
JOURNAL_LINES="${JOURNAL_LINES:-15}"

# Токен, получателя и саму отправку держит send-telegram-message.sh — здесь
# только сборка текста, чтобы обе точки оповещения не расходились в мелочах.

result=$(systemctl show "$UNIT" -p Result --value 2>/dev/null)
status=$(systemctl show "$UNIT" -p ExecMainStatus --value 2>/dev/null)
host=$(hostname)

# Хвост журнала — самое ценное в сообщении: без него оповещение говорит «упало»
# и заставляет идти на сервер.
#
# Ограничиваем ОДНИМ запуском, а не последними N строками юнита: `-n 15` тянет
# хвост предыдущих, в том числе успешных, прогонов, и сообщение о падении
# наполовину состоит из чужих «Готово». `MONITOR_INVOCATION_ID` systemd передаёт
# юниту из OnFailure (начиная с 249); запасной путь — InvocationID самого
# упавшего юнита, к моменту оповещения это ровно его последний запуск.
strip_systemd_lines() {
  grep -vE '^(Starting|Started|Stopping|Stopped|Finished|Failed|Deactivated|Main process exited|Consumed)'
}

invocation="${MONITOR_INVOCATION_ID:-$(systemctl show "$UNIT" -p InvocationID --value 2>/dev/null)}"
tail_lines=""
if [ -n "$invocation" ]; then
  tail_lines=$(journalctl "_SYSTEMD_INVOCATION_ID=$invocation" --no-pager -o cat 2>/dev/null |
    strip_systemd_lines | tail -n "$JOURNAL_LINES")
fi
if [ -z "$tail_lines" ]; then
  # Запуск не опознан — лучше строки не того прогона, чем ничего, но об этом
  # надо сказать прямо, иначе они читаются как относящиеся к падению.
  tail_lines=$(journalctl -u "$UNIT" -n 200 --no-pager -o cat 2>/dev/null |
    strip_systemd_lines | tail -n "$JOURNAL_LINES")
  [ -n "$tail_lines" ] && tail_lines="(запуск не опознан, ниже хвост юнита целиком)
$tail_lines"
fi
[ -n "$tail_lines" ] || tail_lines="(журнал пуст — смотрите journalctl -u $UNIT)"

TEXT="🔴 ${host}: юнит $UNIT завершился с ошибкой
result=${result:-?}, exit=${status:-?}
$(date '+%F %T %Z')

Последние строки:
${tail_lines}

Разбор: journalctl -u $UNIT -n 50 --no-pager"

exec bash "$SCRIPT_DIR/send-telegram-message.sh" "$TEXT"

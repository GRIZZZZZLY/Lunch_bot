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
# ЧТО В СООБЩЕНИИ: только «что упало и где смотреть». Хвост журнала сюда НЕ
# кладём — раньше клали, и в личку админа уехали чужие персональные данные:
# логи бота содержат имена, chat_id и суммы долгов, потому что в них пишутся
# payload'ы sendMessage. Плюс десяток строк JSON в мессенджере всё равно не
# читается. Подробности — в логах на сервере, команда для этого в тексте.
#
# Получатель и токен — из боевого `backend/.env` (см. send-telegram-message.sh).

set -uo pipefail

UNIT="${1:-неизвестный юнит}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

result=$(systemctl show "$UNIT" -p Result --value 2>/dev/null)
status=$(systemctl show "$UNIT" -p ExecMainStatus --value 2>/dev/null)
host=$(hostname)

# Человеческое имя вместо системного: в мессенджере читают глазами, а не грепом.
case "$UNIT" in
  *production-smoke*) what="проверка продакшена" ;;
  *backup-db*) what="резервное копирование базы" ;;
  *watch-app*) what="сторож приложения" ;;
  *) what="$UNIT" ;;
esac

# Причина отказа словами там, где systemd её знает.
case "$result" in
  timeout) why="не уложилось в отведённое время" ;;
  signal) why="процесс убит сигналом" ;;
  core-dump) why="процесс аварийно завершился" ;;
  oom-kill) why="не хватило памяти" ;;
  start-limit-hit) why="слишком частые перезапуски" ;;
  exit-code) why="завершилось с кодом ${status:-?}" ;;
  *) why="результат: ${result:-неизвестен}" ;;
esac

exec bash "$SCRIPT_DIR/send-telegram-message.sh" "🔴 ${host}: ${what} — сбой
${why}
$(date '+%F %T %Z')

Подробности: journalctl -u ${UNIT} -n 50 --no-pager"

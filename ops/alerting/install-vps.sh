#!/usr/bin/env bash

# Установка оповещателя о падениях systemd-юнитов.
#
# Использование (из каталога репозитория на сервере):
#   bash ops/alerting/install-vps.sh [путь-к-исходному-чекауту]
#
# Ставит шаблонный юнит telegram-food-bot-alert@.service. Чтобы юнит начал
# оповещать, ему нужна строка `OnFailure=telegram-food-bot-alert@%n.service` —
# у смоука и бэкапа она уже есть, их достаточно переустановить их же
# установщиками.
#
# Проверка после установки — намеренно на заведомо падающем юните: доставку
# оповещений нельзя считать работающей, пока сообщение не дошло хотя бы раз.

set -euo pipefail

project_root=${1:-$(pwd)}
project_root=$(CDPATH= cd -- "$project_root" && pwd)
unit_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
name='telegram-food-bot-alert@'
run_user=${RUN_USER:-$(id -un)}

test -f "$project_root/ops/alerting/send-telegram-alert.sh"
test -f "$project_root/backend/.env"

if ! grep -qE '^(ALERT_TELEGRAM_CHAT_ID|ADMIN_USER_IDS)=.+' "$project_root/backend/.env"; then
  echo "В backend/.env нет ни ALERT_TELEGRAM_CHAT_ID, ни непустого ADMIN_USER_IDS" >&2
  echo "Без получателя оповещения отправлять некуда." >&2
  exit 1
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
sed -e "s|^WorkingDirectory=.*$|WorkingDirectory=$project_root|" \
  -e "s|^User=.*$|User=$run_user|" \
  "$unit_dir/$name.service" > "$tmp"

sudo install -m 644 "$tmp" "/etc/systemd/system/$name.service"
sudo systemctl daemon-reload

echo "пользователь службы: $run_user"
echo "Проверка доставки на заведомо падающем юните..."
probe=telegram-food-bot-alert-probe
sudo systemd-run --unit="$probe" --property=Type=oneshot \
  --property="OnFailure=${name}%n.service" \
  /usr/bin/false >/dev/null 2>&1 || true
sleep 5
if sudo systemctl show "${name}${probe}.service" -p Result --value | grep -qx success; then
  echo "Оповещение доставлено — проверьте сообщение в Telegram."
else
  echo "Оповещение НЕ доставлено, разбор:" >&2
  sudo journalctl -u "${name}${probe}.service" -n 20 --no-pager >&2
  exit 1
fi
sudo systemctl reset-failed "$probe.service" "${name}${probe}.service" 2>/dev/null || true

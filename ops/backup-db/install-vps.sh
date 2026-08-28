#!/usr/bin/env bash

# Установка ежедневных резервных копий базы.
#
# Использование (из каталога репозитория на сервере):
#   bash ops/backup-db/install-vps.sh [путь-к-исходному-чекауту]
#
# По умолчанию берётся текущий каталог. На сервере с релиз-каталогами укажите
# именно исходный чекаут: у него постоянный путь и настоящий `backend/.env`,
# тогда как каталоги релизов меняются и удаляются ротацией выкатов.

set -euo pipefail

project_root=${1:-$(pwd)}
project_root=$(CDPATH= cd -- "$project_root" && pwd)
unit_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
name=telegram-food-bot-backup-db

test -f "$project_root/backup-db.sh"
test -f "$project_root/backend/.env"

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
sed "s|^WorkingDirectory=.*$|WorkingDirectory=$project_root|" \
  "$unit_dir/$name.service" > "$tmp"

sudo install -m 644 "$tmp" "/etc/systemd/system/$name.service"
sudo install -m 644 "$unit_dir/$name.timer" "/etc/systemd/system/$name.timer"
sudo systemctl daemon-reload

# Первый прогон до включения расписания: пусть ошибки конфигурации всплывут
# сейчас, а не ночью в журнале, куда никто не смотрит.
echo "Пробный запуск..."
sudo systemctl start "$name.service"
systemctl is-active "$name.service" >/dev/null || true
if ! sudo systemctl show "$name.service" -p Result --value | grep -qx success; then
  echo "Пробный запуск не удался — расписание НЕ включено:" >&2
  sudo journalctl -u "$name.service" -n 30 --no-pager >&2
  exit 1
fi

sudo systemctl enable --now "$name.timer"
systemctl list-timers "$name.timer" --no-pager

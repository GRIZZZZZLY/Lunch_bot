#!/usr/bin/env bash

# Резервная копия боевой базы Rocket Lunch.
#
# Запускается по таймеру systemd (ops/backup-db/) и руками. Прежняя версия
# копировала файл SQLite из `/root/telegram-food-bot/backend/prisma/prod.db` —
# ни этого пути, ни SQLite на сервере нет с тех пор, как прод переехал на
# PostgreSQL, поэтому скрипт падал при каждом запуске. Автоматических копий не
# было вовсе: единственный дамп на 2026-08-25 был месячной давности и сделан
# руками.
#
# Переменные: BACKUP_DIR, BACKEND_ENV, DATABASE_URL, KEEP.
#
# Ротация трогает ТОЛЬКО файлы с префиксом `foodbot_auto_` — то, что создал сам
# скрипт. Ручные дампы (`foodbot_pre_<sha>_…` перед миграцией) остаются: их
# кладут осознанно и удаляют тоже осознанно.

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

# `$HOME` под systemd не задан — при `set -u` подстановка по умолчанию уронила
# бы запуск, а «удобный» запасной путь развёл бы копии по двум каталогам, из
# которых ротация чистит только один. Поэтому либо BACKUP_DIR задан явно (так
# делает юнит), либо берём домашний каталог, либо честно останавливаемся.
if [ -z "${BACKUP_DIR:-}" ]; then
  if [ -z "${HOME:-}" ]; then
    echo "Не задан BACKUP_DIR, а HOME пуст (обычное дело под systemd)" >&2
    exit 2
  fi
  BACKUP_DIR="$HOME/backups/rocket-lunch"
fi
BACKEND_ENV="${BACKEND_ENV:-$SCRIPT_DIR/backend/.env}"
KEEP="${KEEP:-14}"
PREFIX=foodbot_auto_

case "$KEEP" in
  ''|*[!0-9]*) echo "KEEP должен быть числом, получено: $KEEP" >&2; exit 2 ;;
esac
if [ "$KEEP" -lt 1 ]; then
  echo "KEEP должен быть не меньше 1 — иначе ротация снесёт свежую копию" >&2
  exit 2
fi

DATABASE_URL="${DATABASE_URL:-}"
if [ -z "$DATABASE_URL" ]; then
  if [ ! -f "$BACKEND_ENV" ]; then
    echo "Не найден $BACKEND_ENV; укажите BACKEND_ENV или DATABASE_URL" >&2
    exit 1
  fi
  DATABASE_URL=$(sed -n 's/^DATABASE_URL=//p' "$BACKEND_ENV" | tail -1 | tr -d '\r"')
fi
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL пуст" >&2
  exit 1
fi

umask 077
mkdir -p "$BACKUP_DIR"

TS=$(date -u +%Y%m%dT%H%M%SZ)
TARGET="$BACKUP_DIR/${PREFIX}${TS}.dump"
TMP="$BACKUP_DIR/.${PREFIX}${TS}.dump.partial"
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

echo "Дамп → $TARGET"
# Сначала во временный файл: оборванный дамп не должен остаться в каталоге под
# именем нормальной копии и попасть в ротацию как «свежая».
pg_dump --format=custom --no-owner --no-privileges --file="$TMP" "$DATABASE_URL"

# Проверка целостности архива, а не только его наличия: усечённый файл
# существует, весит правдоподобно и восстановлению не поддаётся.
tables=$(pg_restore --list "$TMP" | grep -c 'TABLE DATA' || true)
if [ "$tables" -lt 1 ]; then
  echo "В дампе нет ни одной таблицы с данными — копия не сохранена" >&2
  exit 1
fi

mv -f "$TMP" "$TARGET"
chmod 600 "$TARGET"
sha256sum "$TARGET" > "$TARGET.sha256"
chmod 600 "$TARGET.sha256"

echo "Готово: $(du -h "$TARGET" | cut -f1), таблиц с данными: $tables"

# --- Ротация -------------------------------------------------------------

removed=0
while IFS= read -r old; do
  [ -n "$old" ] || continue
  rm -f -- "$old" "$old.sha256"
  removed=$((removed + 1))
  echo "удалена старая копия: $(basename "$old")"
done <<< "$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${PREFIX}*.dump" -printf '%T@\t%p\n' |
  sort -rn | cut -f2- | tail -n +$((KEEP + 1)))"

kept=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${PREFIX}*.dump" | wc -l)
echo "автоматических копий: $kept (лимит $KEEP), удалено: $removed"
echo "каталог: $(du -sh "$BACKUP_DIR" | cut -f1); свободно: $(df -h "$BACKUP_DIR" | awk 'NR==2 {print $4}')"

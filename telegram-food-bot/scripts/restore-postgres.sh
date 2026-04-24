#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
BACKUP_FILE=""
NO_BACKUP=false
FORCE=false

CONTAINER_NAME="foodbot-postgres"
DB_USER="foodbot"
DB_NAME="foodbot_db"

usage() {
  printf "Usage: %s [--file PATH] [--backup-dir DIR] [--no-backup] [--force]\n" "$0"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) BACKUP_FILE="$2"; shift 2 ;;
    --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
    --no-backup) NO_BACKUP=true; shift ;;
    --force) FORCE=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf "Unknown option: %s\n" "$1"; usage; exit 1 ;;
  esac
done

select_backup() {
  mapfile -t backups < <(ls -1t "$BACKUP_DIR"/foodbot_backup_*.sql* 2>/dev/null || true)
  if (( ${#backups[@]} == 0 )); then
    printf "❌ Backup файлы не найдены\n"
    exit 1
  fi

  printf "\n📋 Доступные backup файлы:\n"
  for i in "${!backups[@]}"; do
    size=$(du -h "${backups[$i]}" | cut -f1)
    printf "  [%d] %s (%s)\n" "$i" "$(basename "${backups[$i]}")" "$size"
  done

  read -r -p "Выберите номер backup (или 'q' для отмены): " choice
  if [[ "$choice" == "q" ]]; then
    printf "Отменено\n"
    exit 0
  fi

  if ! [[ "$choice" =~ ^[0-9]+$ ]] || (( choice >= ${#backups[@]} )); then
    printf "❌ Неверный выбор\n"
    exit 1
  fi

  BACKUP_FILE="${backups[$choice]}"
}

if [[ -z "$BACKUP_FILE" ]]; then
  select_backup
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  printf "❌ Файл не найден: %s\n" "$BACKUP_FILE"
  exit 1
fi

printf "\n⚠️  ВНИМАНИЕ: восстановление удалит текущие данные\n"
printf "Файл: %s\n" "$BACKUP_FILE"

if [[ "$FORCE" == false ]]; then
  read -r -p "Продолжить? (yes/no): " confirm
  if [[ "$confirm" != "yes" ]]; then
    printf "Отменено\n"
    exit 0
  fi
fi

if [[ "$NO_BACKUP" == false ]]; then
  printf "\n💾 Создаю backup текущей БД...\n"
  "$(dirname "$0")/backup-postgres.sh" --silent
fi

printf "\n🔄 Восстановление...\n"

docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" >/dev/null
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;" >/dev/null
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" >/dev/null

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"
else
  cat "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"
fi

count=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;" | xargs)
printf "✅ Восстановление завершено\n"
printf "👥 Пользователей в БД: %s\n" "$count"

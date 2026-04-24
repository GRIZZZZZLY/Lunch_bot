#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
KEEP_LAST="${KEEP_LAST:-30}"
COMPRESS=false
SILENT=false

CONTAINER_NAME="foodbot-postgres"
DB_USER="foodbot"
DB_NAME="foodbot_db"

usage() {
  printf "Usage: %s [--compress] [--keep N] [--backup-dir DIR] [--silent]\n" "$0"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --compress) COMPRESS=true; shift ;;
    --keep) KEEP_LAST="$2"; shift 2 ;;
    --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
    --silent) SILENT=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf "Unknown option: %s\n" "$1"; usage; exit 1 ;;
  esac
done

mkdir -p "$BACKUP_DIR"

timestamp=$(date +"%Y-%m-%d_%H%M%S")
file="$BACKUP_DIR/foodbot_backup_${timestamp}.sql"

if [[ "$SILENT" == false ]]; then
  printf "\n💾 Создаю backup: %s\n" "$(basename "$file")"
fi

docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$file"

if [[ "$COMPRESS" == true ]]; then
  gzip -f "$file"
  file="$file.gz"
fi

if [[ "$SILENT" == false ]]; then
  size=$(du -h "$file" | cut -f1)
  printf "✅ Backup создан: %s\n" "$(basename "$file")"
  printf "📦 Размер: %s\n" "$size"
fi

mapfile -t backups < <(ls -1t "$BACKUP_DIR"/foodbot_backup_*.sql* 2>/dev/null || true)

if (( ${#backups[@]} > KEEP_LAST )); then
  for ((i=KEEP_LAST; i<${#backups[@]}; i++)); do
    rm -f "${backups[$i]}"
    if [[ "$SILENT" == false ]]; then
      printf "🗑️  Удалён старый backup: %s\n" "$(basename "${backups[$i]}")"
    fi
  done
fi

if [[ "$SILENT" == false ]]; then
  printf "✅ Готово\n"
fi

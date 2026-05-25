#!/bin/bash
# ===============================================================================
# Phase 0 (G0-6) — Off-site PostgreSQL backup via restic
# ===============================================================================
# Запускается из cron каждые 6 часов. Делает pg_dump → восстанавливаемый
# архив → восстанавливаемый restic snapshot в удалённое хранилище.
#
# Зачем restic, а не rsync:
#   - дедуплицирует, шифрует, проверяет целостность через `restic check`
#   - умеет в S3, B2, Azure, любой SFTP/rest-server
#   - поддерживает retention policy (forget --keep-* ) без скриптов
#
# Требования:
#   - restic >= 0.16   (apt install restic / scoop install restic)
#   - pg_dump >= 18   (тот же мажор, что и сервер)
#   - export RESTIC_REPOSITORY=... и RESTIC_PASSWORD=... до запуска (или
#     ~/.config/restic.env). НИКОГДА не коммитить.
#
# Восстановление (drill):
#   restic snapshots
#   restic restore <id> --target /tmp/restore
#   gunzip -c /tmp/restore/*.sql.gz | psql -h localhost -U foodbot foodbot
#
# Setup cron (root):
#   0 */6 * * * /home/igor/Lunch_bot/telegram-food-bot/scripts/backup-postgres-offsite.sh \
#               >> /var/log/foodbot-backup.log 2>&1
# ===============================================================================

set -euo pipefail

# --- Конфигурация (можно переопределить через env) ---------------------------
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-foodbot}"
DB_NAME="${DB_NAME:-foodbot}"
STAGING_DIR="${STAGING_DIR:-/tmp/foodbot-backup}"
KEEP_HOURLY="${KEEP_HOURLY:-24}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"

# --- Загрузка credentials restic ---------------------------------------------
if [[ -f "${HOME}/.config/restic.env" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.config/restic.env"
fi

if [[ -z "${RESTIC_REPOSITORY:-}" || -z "${RESTIC_PASSWORD:-}" ]]; then
  echo "[FATAL] RESTIC_REPOSITORY / RESTIC_PASSWORD не заданы." >&2
  echo "        Создай ~/.config/restic.env с export-ами или передай через env." >&2
  exit 2
fi

# --- 1. pg_dump в staging ----------------------------------------------------
mkdir -p "${STAGING_DIR}"
TS=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${STAGING_DIR}/foodbot-${TS}.sql.gz"

echo "[$(date -Iseconds)] pg_dump → ${DUMP_FILE}"
PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
  -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
  --format=plain --no-owner --no-acl --clean --if-exists \
  "${DB_NAME}" \
  | gzip -9 > "${DUMP_FILE}"

DUMP_SIZE=$(du -h "${DUMP_FILE}" | cut -f1)
echo "[$(date -Iseconds)] dump size: ${DUMP_SIZE}"

# --- 2. Инициализация репо (идемпотентно) ------------------------------------
if ! restic snapshots --quiet >/dev/null 2>&1; then
  echo "[$(date -Iseconds)] restic repo не инициализирован, init..."
  restic init
fi

# --- 3. Загрузка snapshot ----------------------------------------------------
echo "[$(date -Iseconds)] restic backup..."
restic backup "${DUMP_FILE}" \
  --tag foodbot --tag postgres --tag "host:$(hostname)" \
  --host "$(hostname)"

# --- 4. Retention ------------------------------------------------------------
echo "[$(date -Iseconds)] restic forget + prune..."
restic forget \
  --tag foodbot \
  --keep-hourly "${KEEP_HOURLY}" \
  --keep-daily "${KEEP_DAILY}" \
  --keep-weekly "${KEEP_WEEKLY}" \
  --keep-monthly "${KEEP_MONTHLY}" \
  --prune

# --- 5. Integrity check (раз в день, дёшево) ---------------------------------
if [[ "$(date +%H)" == "03" ]]; then
  echo "[$(date -Iseconds)] restic check (daily integrity)..."
  restic check --read-data-subset=5%
fi

# --- 6. Очистка staging ------------------------------------------------------
rm -f "${DUMP_FILE}"
echo "[$(date -Iseconds)] ✅ off-site backup complete"

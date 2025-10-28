#!/bin/bash

# ===============================================
# 💾 Database Backup Script
# ===============================================
# Automatically backs up the SQLite database
# Can be run manually or via cron

set -e

# Configuration
BACKUP_DIR="/root/telegram-food-bot/backups"
DB_PATH="/root/telegram-food-bot/backend/prisma/prod.db"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="prod.db.backup.$DATE"
MAX_BACKUPS=30  # Keep last 30 backups

echo "💾 Starting database backup..."

# ===============================================
# 1. Create backup directory if not exists
# ===============================================
mkdir -p "$BACKUP_DIR"

# ===============================================
# 2. Check if database exists
# ===============================================
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at: $DB_PATH"
    exit 1
fi

# ===============================================
# 3. Create backup
# ===============================================
echo "📦 Creating backup: $BACKUP_FILE"
cp "$DB_PATH" "$BACKUP_DIR/$BACKUP_FILE"

# Verify backup
if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo "✅ Backup created successfully: $BACKUP_SIZE"
else
    echo "❌ Backup failed"
    exit 1
fi

# ===============================================
# 4. Clean old backups
# ===============================================
echo "🧹 Cleaning old backups (keeping last $MAX_BACKUPS)..."

# Count backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/prod.db.backup.* 2>/dev/null | wc -l)

if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    # Delete oldest backups
    ls -t "$BACKUP_DIR"/prod.db.backup.* | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f
    echo "✅ Old backups cleaned"
else
    echo "📊 Current backups: $BACKUP_COUNT (max: $MAX_BACKUPS)"
fi

# ===============================================
# 5. List backups
# ===============================================
echo ""
echo "📋 Recent backups:"
ls -lh "$BACKUP_DIR"/prod.db.backup.* | tail -5

# ===============================================
# 6. Backup statistics
# ===============================================
echo ""
echo "📊 Backup statistics:"
echo "  Location: $BACKUP_DIR"
echo "  Total backups: $(ls -1 "$BACKUP_DIR"/prod.db.backup.* 2>/dev/null | wc -l)"
echo "  Total size: $(du -sh "$BACKUP_DIR" | cut -f1)"

echo ""
echo "✅ Backup completed successfully!"
echo ""
echo "📝 To restore from backup:"
echo "  cp $BACKUP_DIR/$BACKUP_FILE $DB_PATH"
echo "  pm2 restart rocket-lunch-bot"
echo ""

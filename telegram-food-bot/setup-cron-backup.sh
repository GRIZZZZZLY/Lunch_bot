#!/bin/bash

# ===============================================
# ⏰ Setup Automatic Database Backups with Cron
# ===============================================
# This script sets up daily automatic backups at 3 AM

set -e

echo "⏰ Setting up automatic database backups..."

# Path to backup script
BACKUP_SCRIPT="/root/telegram-food-bot/backup-db.sh"

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo "⚠️  Cron job already exists"
    echo ""
    echo "Current cron jobs:"
    crontab -l | grep "$BACKUP_SCRIPT"
else
    # Add cron job (daily at 3 AM)
    (crontab -l 2>/dev/null; echo "0 3 * * * $BACKUP_SCRIPT >> /var/log/rocket-lunch-backup.log 2>&1") | crontab -
    
    echo "✅ Cron job added successfully!"
    echo ""
    echo "Backup schedule: Daily at 3:00 AM"
    echo "Log file: /var/log/rocket-lunch-backup.log"
fi

echo ""
echo "📋 All cron jobs:"
crontab -l

echo ""
echo "📝 Useful commands:"
echo "  # View cron jobs"
echo "  crontab -l"
echo ""
echo "  # Edit cron jobs"
echo "  crontab -e"
echo ""
echo "  # View backup logs"
echo "  tail -f /var/log/rocket-lunch-backup.log"
echo ""
echo "  # Run backup manually"
echo "  $BACKUP_SCRIPT"
echo ""
echo "✅ Setup completed!"
echo ""

# 🔄 Backup Information

## ✅ Backup Created

**Date:** 2025-10-08 16:06:55  
**Archive:** `C:\BOT_V2\backups\telegram-food-bot_backup_2025-10-08_16-06-55.zip`  
**Size:** 2.09 MB  
**Git Tag:** `backup-2025-10-08_16-06-55`  
**Git Commit:** `117b746c` (master)

---

## 📦 Contents

- ✅ **Frontend:** 212 files (without node_modules)
- ✅ **Backend:** 116 files (without node_modules)
- ✅ **Documentation:** All docs files
- ✅ **Root files:** README, package.json, .gitignore

---

## 🚀 Quick Restore Options

### Option 1: Full Restore from Archive

```powershell
# Stop application
pm2 stop all

# Backup current state (optional)
Move-Item "C:\BOT_V2\telegram-food-bot" "C:\BOT_V2\telegram-food-bot.old"

# Extract backup
Expand-Archive -Path "C:\BOT_V2\backups\telegram-food-bot_backup_2025-10-08_16-06-55.zip" -DestinationPath "C:\BOT_V2\telegram-food-bot"

# Install dependencies
cd C:\BOT_V2\telegram-food-bot\frontend
npm install

cd ..\backend
npm install

# Start application
pm2 start all
```

---

### Option 2: Git Tag Restore

```bash
# Reset to backup git tag
git checkout backup-2025-10-08_16-06-55

# Or hard reset
git reset --hard 117b746c

# Install dependencies
npm install
```

---

### Option 3: Partial Restore (Frontend Only)

```powershell
# Extract to temp location
Expand-Archive -Path "C:\BOT_V2\backups\telegram-food-bot_backup_2025-10-08_16-06-55.zip" -DestinationPath "C:\temp\restore"

# Backup current frontend
Move-Item "C:\BOT_V2\telegram-food-bot\frontend" "C:\BOT_V2\telegram-food-bot\frontend.old"

# Restore frontend
Copy-Item -Path "C:\temp\restore\frontend" -Destination "C:\BOT_V2\telegram-food-bot\frontend" -Recurse

# Install dependencies
cd C:\BOT_V2\telegram-food-bot\frontend
npm install
```

---

### Option 4: Partial Restore (Backend Only)

```powershell
# Extract to temp location
Expand-Archive -Path "C:\BOT_V2\backups\telegram-food-bot_backup_2025-10-08_16-06-55.zip" -DestinationPath "C:\temp\restore"

# Backup current backend
Move-Item "C:\BOT_V2\telegram-food-bot\backend" "C:\BOT_V2\telegram-food-bot\backend.old"

# Restore backend
Copy-Item -Path "C:\temp\restore\backend" -Destination "C:\BOT_V2\telegram-food-bot\backend" -Recurse

# Install dependencies
cd C:\BOT_V2\telegram-food-bot\backend
npm install
```

---

## 📝 Important Notes

1. **node_modules NOT included** - you must run `npm install` after restore
2. **Database NOT included** - backup `backend/prisma/dev.db` separately if needed
3. **Environment files** - check `.env` files after restore
4. **Test after restore** - run `npm test` to verify everything works

---

## 🔧 Create New Backup

To create a new backup before making changes:

```powershell
# Run backup script
.\scripts\quick-backup.ps1

# List all backups
Get-ChildItem -Path "C:\BOT_V2\backups" -Filter "*.zip" | Sort-Object LastWriteTime -Descending
```

---

## 📂 Backup Location

All backups are stored in: `C:\BOT_V2\backups\`

Each backup includes:
- Full project structure (frontend, backend, docs)
- BACKUP_MANIFEST.json with metadata
- Git information (branch, commit)
- File counts and sizes

---

## ⚠️ Before Restoring

1. **Stop all processes:** `pm2 stop all`
2. **Backup current state** if you want to keep changes
3. **Check disk space** - ensure you have enough space
4. **Close IDEs/editors** - avoid file locks
5. **Test after restore** - verify application works

---

## 🆘 Troubleshooting

### Archive extraction fails
```powershell
# Try with -Force flag
Expand-Archive -Path "path\to\backup.zip" -DestinationPath "C:\temp\restore" -Force
```

### npm install fails
```powershell
# Clear cache and retry
npm cache clean --force
npm install
```

### Application doesn't start
```powershell
# Check logs
npm run logs

# Rebuild
npm run build

# Check environment
node --version
npm --version
```

---

**Created:** 2025-10-08 16:06:55  
**Script:** `scripts/quick-backup.ps1`

# 🔄 Backup & Restore Guide

Complete guide for backing up and restoring the Telegram Food Bot project.

---

## 📦 Current Backup

**Latest Backup:**
- **File:** `telegram-food-bot_backup_2025-10-08_16-06-55.zip`
- **Location:** `C:\BOT_V2\backups\`
- **Size:** 2.09 MB
- **Date:** 2025-10-08 16:06:55
- **Git Tag:** `backup-2025-10-08_16-06-55`
- **Git Commit:** `117b746c` (master branch)

**Contents:**
- Frontend: 212 files (without node_modules)
- Backend: 116 files (without node_modules)
- Documentation: All docs
- Root files: README, package.json, .gitignore

---

## 🚀 Quick Commands

### Create Backup

```powershell
# Simple backup
.\scripts\quick-backup.ps1

# Backup with node_modules (larger)
.\scripts\backup.ps1 -IncludeNodeModules
```

### Restore Backup

```powershell
# Interactive restore (shows list)
.\scripts\quick-restore.ps1

# Restore specific backup
.\scripts\quick-restore.ps1 -BackupFile "C:\BOT_V2\backups\telegram-food-bot_backup_2025-10-08_16-06-55.zip"

# Restore frontend only
.\scripts\quick-restore.ps1 -FrontendOnly

# Restore backend only
.\scripts\quick-restore.ps1 -BackendOnly

# Force restore without confirmation
.\scripts\quick-restore.ps1 -Force
```

---

## 📝 Manual Restore Steps

### Full Project Restore

```powershell
# 1. Stop application
pm2 stop all

# 2. Extract backup
Expand-Archive -Path "C:\BOT_V2\backups\telegram-food-bot_backup_2025-10-08_16-06-55.zip" -DestinationPath "C:\temp\restore"

# 3. Backup current project (optional)
Move-Item "C:\BOT_V2\telegram-food-bot" "C:\BOT_V2\telegram-food-bot.old"

# 4. Copy restored files
Copy-Item -Path "C:\temp\restore\*" -Destination "C:\BOT_V2\telegram-food-bot" -Recurse

# 5. Install dependencies
cd C:\BOT_V2\telegram-food-bot\frontend
npm install

cd ..\backend
npm install

# 6. Start application
pm2 start all
```

---

### Frontend Only Restore

```powershell
# Extract backup
Expand-Archive -Path "C:\BOT_V2\backups\telegram-food-bot_backup_2025-10-08_16-06-55.zip" -DestinationPath "C:\temp\restore"

# Backup current frontend
Move-Item "C:\BOT_V2\telegram-food-bot\frontend" "C:\BOT_V2\telegram-food-bot\frontend.old"

# Restore
Copy-Item -Path "C:\temp\restore\frontend" -Destination "C:\BOT_V2\telegram-food-bot\frontend" -Recurse

# Install dependencies
cd C:\BOT_V2\telegram-food-bot\frontend
npm install
```

---

### Backend Only Restore

```powershell
# Extract backup
Expand-Archive -Path "C:\BOT_V2\backups\telegram-food-bot_backup_2025-10-08_16-06-55.zip" -DestinationPath "C:\temp\restore"

# Backup current backend
Move-Item "C:\BOT_V2\telegram-food-bot\backend" "C:\BOT_V2\telegram-food-bot\backend.old"

# Restore
Copy-Item -Path "C:\temp\restore\backend" -Destination "C:\BOT_V2\telegram-food-bot\backend" -Recurse

# Install dependencies
cd C:\BOT_V2\telegram-food-bot\backend
npm install
```

---

### Git Tag Restore

```bash
# List available backup tags
git tag | grep backup

# Checkout specific backup tag
git checkout backup-2025-10-08_16-06-55

# Or hard reset to commit
git reset --hard 117b746c

# Install dependencies
cd frontend && npm install
cd ../backend && npm install
```

---

## 🔧 Backup Scripts

### quick-backup.ps1

Simple, fast backup script without emoji/encoding issues.

**Features:**
- Excludes node_modules (smaller size)
- Creates ZIP archive
- Generates manifest with metadata
- Creates git tag
- Lists available backups

**Usage:**
```powershell
.\scripts\quick-backup.ps1
```

---

### backup.ps1

Full-featured backup script with more options.

**Features:**
- Optional node_modules inclusion
- Detailed restore instructions
- Color-coded output
- Comprehensive manifest

**Usage:**
```powershell
# Standard backup
.\scripts\backup.ps1

# Include node_modules
.\scripts\backup.ps1 -IncludeNodeModules

# Custom backup location
.\scripts\backup.ps1 -BackupDir "D:\Backups"
```

---

### quick-restore.ps1

Interactive restore script with safety checks.

**Features:**
- Interactive backup selection
- Partial restore options (frontend/backend only)
- Automatic dependency installation
- Safety confirmations
- Backs up current files before overwriting

**Usage:**
```powershell
# Interactive mode
.\scripts\quick-restore.ps1

# Specific backup
.\scripts\quick-restore.ps1 -BackupFile "path\to\backup.zip"

# Frontend only
.\scripts\quick-restore.ps1 -FrontendOnly

# Backend only
.\scripts\quick-restore.ps1 -BackendOnly

# Skip confirmation
.\scripts\quick-restore.ps1 -Force
```

---

## 📂 Backup Structure

```
backups/
└── telegram-food-bot_backup_2025-10-08_16-06-55.zip
    ├── frontend/
    │   ├── src/
    │   ├── public/
    │   ├── package.json
    │   └── ... (212 files)
    ├── backend/
    │   ├── src/
    │   ├── prisma/
    │   ├── package.json
    │   └── ... (116 files)
    ├── docs/
    │   └── ... (documentation files)
    ├── BACKUP_MANIFEST.json
    ├── README.md
    ├── package.json
    └── .gitignore
```

---

## 📋 BACKUP_MANIFEST.json

Each backup contains metadata:

```json
{
  "BackupDate": "2025-10-08 16:06:55",
  "ProjectName": "Telegram Food Bot",
  "Version": "2.0",
  "GitCommit": "117b746c",
  "GitBranch": "master",
  "BackupSize": "2.09 MB",
  "Files": {
    "Frontend": 212,
    "Backend": 116
  }
}
```

---

## ⚠️ Important Notes

### What's Included
✅ All source code  
✅ Configuration files  
✅ Documentation  
✅ Git information  
✅ Package manifests

### What's NOT Included
❌ `node_modules/` (must run `npm install`)  
❌ `.env` files (for security)  
❌ Database files (`prisma/dev.db`)  
❌ Build artifacts (`dist/`, `build/`)  
❌ IDE files (`.vscode/`, `.idea/`)

### Before Restoring
1. Stop all running processes: `pm2 stop all`
2. Backup current state if needed
3. Close all editors/IDEs
4. Check disk space

### After Restoring
1. Check `.env` files exist and are correct
2. Run `npm install` in frontend and backend
3. Run tests: `npm test`
4. Start application: `npm run dev`
5. Verify everything works

---

## 🆘 Troubleshooting

### Backup fails

```powershell
# Check disk space
Get-PSDrive C

# Check permissions
Test-Path "C:\BOT_V2\backups" -IsValid

# Run as administrator
```

### Restore fails

```powershell
# Clear extraction with force
Expand-Archive -Path "path\to\backup.zip" -DestinationPath "C:\temp\restore" -Force

# Manual extraction using Windows Explorer
# Right-click ZIP > Extract All
```

### npm install fails

```powershell
# Clear cache
npm cache clean --force

# Delete node_modules and retry
Remove-Item -Path "node_modules" -Recurse -Force
npm install

# Check Node/npm versions
node --version
npm --version
```

### Application doesn't start

```powershell
# Check environment
Get-Content .env

# Rebuild
npm run build

# Check logs
npm run logs

# Verify database
ls backend/prisma/dev.db
```

---

## 📊 Backup Best Practices

### When to Create Backups

1. **Before major changes**
   - Large refactorings
   - Dependency updates
   - Database migrations

2. **Before deployments**
   - Production releases
   - Major feature rollouts

3. **Regular schedule**
   - Daily development backups
   - Weekly production backups

4. **Before testing**
   - Performance tests
   - Load tests
   - Breaking changes

### Backup Retention

```powershell
# Keep last 5 backups (automatic in script)
# Manual cleanup:
Get-ChildItem -Path "C:\BOT_V2\backups" -Filter "*.zip" | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -Skip 5 | 
    Remove-Item -Force
```

### Backup Verification

```powershell
# Test backup integrity
Test-Path "C:\BOT_V2\backups\telegram-food-bot_backup_2025-10-08_16-06-55.zip"

# Check manifest
Expand-Archive -Path "path\to\backup.zip" -DestinationPath "C:\temp\test"
Get-Content "C:\temp\test\BACKUP_MANIFEST.json" | ConvertFrom-Json
```

---

## 🔗 Related Documentation

- [UX/UI Refactoring Plan](./UX_UI_REFACTORING_PLAN.md)
- [Development Plan 2025](./DEVELOPMENT_PLAN_2025.md)
- [Session Testing Guide](./SESSION_TESTING_2025-01-08.md)

---

**Last Updated:** 2025-10-08  
**Created By:** Backup automation scripts

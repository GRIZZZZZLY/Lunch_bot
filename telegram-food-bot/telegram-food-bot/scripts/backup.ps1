# Скрипт автоматического бэкапа проекта
# Использование: .\scripts\backup.ps1

param(
    [string]$BackupDir = "C:\BOT_V2\backups",
    [switch]$IncludeNodeModules = $false
)

# Цвета для вывода
$ColorSuccess = "Green"
$ColorInfo = "Cyan"
$ColorWarning = "Yellow"
$ColorError = "Red"

# Функция логирования
function Write-Log {
    param([string]$Message, [string]$Color = "White")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor $Color
}

# Создание timestamp
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackupName = "telegram-food-bot_backup_$Timestamp"
$BackupPath = Join-Path $BackupDir $BackupName

Write-Log "=== 🔄 Начало создания бэкапа ===" $ColorInfo
Write-Log "Проект: $ProjectRoot" $ColorInfo
Write-Log "Бэкап: $BackupPath" $ColorInfo

# Создать директорию для бэкапов
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
    Write-Log "✅ Создана директория для бэкапов: $BackupDir" $ColorSuccess
}

# Создать временную директорию для подготовки бэкапа
$TempBackupPath = Join-Path $env:TEMP $BackupName
if (Test-Path $TempBackupPath) {
    Remove-Item -Path $TempBackupPath -Recurse -Force
}
New-Item -ItemType Directory -Path $TempBackupPath | Out-Null

Write-Log "📦 Копирование файлов..." $ColorInfo

# Копировать frontend
Write-Log "  → Frontend..." $ColorInfo
$FrontendSrc = Join-Path $ProjectRoot "frontend"
$FrontendDst = Join-Path $TempBackupPath "frontend"

if ($IncludeNodeModules) {
    Copy-Item -Path $FrontendSrc -Destination $FrontendDst -Recurse -Force
} else {
    # Копировать без node_modules
    robocopy $FrontendSrc $FrontendDst /E /XD node_modules .next dist build coverage .vite /NFL /NDL /NJH /NJS
}

# Копировать backend
Write-Log "  → Backend..." $ColorInfo
$BackendSrc = Join-Path $ProjectRoot "backend"
$BackendDst = Join-Path $TempBackupPath "backend"

if ($IncludeNodeModules) {
    Copy-Item -Path $BackendSrc -Destination $BackendDst -Recurse -Force
} else {
    # Копировать без node_modules
    robocopy $BackendSrc $BackendDst /E /XD node_modules dist coverage /NFL /NDL /NJH /NJS
}

# Копировать docs
Write-Log "  → Documentation..." $ColorInfo
$DocsSrc = Join-Path $ProjectRoot "docs"
if (Test-Path $DocsSrc) {
    $DocsDst = Join-Path $TempBackupPath "docs"
    Copy-Item -Path $DocsSrc -Destination $DocsDst -Recurse -Force
}

# Копировать корневые файлы
Write-Log "  → Root files..." $ColorInfo
$RootFiles = @("README.md", "package.json", "package-lock.json", ".gitignore")
foreach ($file in $RootFiles) {
    $srcFile = Join-Path $ProjectRoot $file
    if (Test-Path $srcFile) {
        Copy-Item -Path $srcFile -Destination $TempBackupPath -Force
    }
}

# Создать манифест бэкапа
Write-Log "📝 Создание манифеста..." $ColorInfo
$Manifest = @{
    BackupDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    ProjectName = "Telegram Food Bot"
    Version = "2.0"
    GitCommit = ""
    GitBranch = ""
    IncludeNodeModules = $IncludeNodeModules
    BackupSize = ""
    Files = @{
        Frontend = (Get-ChildItem -Path $FrontendDst -Recurse -File).Count
        Backend = (Get-ChildItem -Path $BackendDst -Recurse -File).Count
    }
}

# Получить git информацию
Push-Location $ProjectRoot
try {
    $GitCommit = git rev-parse --short HEAD 2>$null
    $GitBranch = git branch --show-current 2>$null
    if ($GitCommit) { $Manifest.GitCommit = $GitCommit }
    if ($GitBranch) { $Manifest.GitBranch = $GitBranch }
} catch {
    Write-Log "⚠️  Git информация недоступна" $ColorWarning
}
Pop-Location

# Сохранить манифест
$ManifestPath = Join-Path $TempBackupPath "BACKUP_MANIFEST.json"
$Manifest | ConvertTo-Json -Depth 10 | Out-File -FilePath $ManifestPath -Encoding UTF8

# Создать README для бэкапа
$ReadmePath = Join-Path $TempBackupPath "RESTORE_INSTRUCTIONS.md"
$RestoreInstructions = @"
# 🔄 Инструкция по Восстановлению

**Дата бэкапа:** $($Manifest.BackupDate)  
**Git Commit:** $($Manifest.GitCommit)  
**Git Branch:** $($Manifest.GitBranch)

---

## Содержимое

- Frontend ($($Manifest.Files.Frontend) files)
- Backend ($($Manifest.Files.Backend) files)
- Documentation
- $(if ($IncludeNodeModules) { "node_modules included" } else { "node_modules NOT included (npm install required)" })

---

## 🚀 Быстрое Восстановление

### Вариант 1: Полное восстановление

``````powershell
# 1. Остановить приложение
pm2 stop all

# 2. Удалить текущий проект (осторожно!)
Remove-Item -Path "C:\BOT_V2\telegram-food-bot" -Recurse -Force

# 3. Восстановить из бэкапа
Copy-Item -Path "$BackupPath" -Destination "C:\BOT_V2\telegram-food-bot" -Recurse

# 4. Установить зависимости (если не включены)
cd C:\BOT_V2\telegram-food-bot\frontend
npm install

cd ..\backend
npm install

# 5. Запустить приложение
pm2 start all
``````

---

### Вариант 2: Частичное восстановление (только frontend)

``````powershell
# Бэкап текущего frontend
Move-Item "C:\BOT_V2\telegram-food-bot\frontend" "C:\BOT_V2\telegram-food-bot\frontend.old"

# Восстановить frontend
Copy-Item -Path "$BackupPath\frontend" -Destination "C:\BOT_V2\telegram-food-bot\frontend" -Recurse

# Установить зависимости
cd C:\BOT_V2\telegram-food-bot\frontend
npm install
``````

---

### Вариант 3: Git откат (если есть тег)

``````bash
# Откатить к тегу бэкапа
git checkout backup-$Timestamp

# Или сбросить изменения
git reset --hard $($Manifest.GitCommit)
``````

---

## ⚠️  Важно

1. **Перед восстановлением:**
   - Остановите все процессы приложения
   - Сделайте бэкап текущего состояния (если нужно)
   - Проверьте свободное место на диске

2. **После восстановления:**
   - Установите зависимости: ``npm install``
   - Проверьте .env файлы
   - Запустите тесты: ``npm test``
   - Проверьте работу приложения

3. **Данные базы:**
   - Этот бэкап НЕ включает базу данных
   - Для восстановления БД используйте отдельные бэкапы
   - Файл: ``backend/prisma/dev.db``

---

## 📞 Поддержка

При проблемах с восстановлением:
1. Проверьте логи: ``npm run logs``
2. Проверьте версии: ``node --version``, ``npm --version``
3. Очистите кэш: ``npm cache clean --force``

---

_Бэкап создан: $(Get-Date)_
"@

$RestoreInstructions | Out-File -FilePath $ReadmePath -Encoding UTF8

Write-Log "✅ Манифест и инструкции созданы" $ColorSuccess

# Архивировать в ZIP
Write-Log "🗜️  Создание архива..." $ColorInfo
$ZipPath = "$BackupPath.zip"

try {
    Compress-Archive -Path $TempBackupPath\* -DestinationPath $ZipPath -Force
    Write-Log "✅ Архив создан: $ZipPath" $ColorSuccess
    
    # Получить размер архива
    $ZipSize = (Get-Item $ZipPath).Length / 1MB
    $Manifest.BackupSize = "{0:N2} MB" -f $ZipSize
    Write-Log "📊 Размер архива: $($Manifest.BackupSize)" $ColorInfo
    
} catch {
    Write-Log "❌ Ошибка создания архива: $_" $ColorError
    exit 1
}

# Удалить временную директорию
Remove-Item -Path $TempBackupPath -Recurse -Force

# Создать git tag (если git доступен)
Write-Log "🏷️  Создание git тега..." $ColorInfo
Push-Location $ProjectRoot
try {
    $TagName = "backup-$Timestamp"
    git tag -a $TagName -m "Backup created at $Timestamp before UX/UI refactoring" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Log "✅ Git тег создан: $TagName" $ColorSuccess
    } else {
        Write-Log "⚠️  Git тег не создан (возможно уже существует)" $ColorWarning
    }
} catch {
    Write-Log "⚠️  Git недоступен или произошла ошибка" $ColorWarning
}
Pop-Location

# Финальный отчет
Write-Log "" $ColorSuccess
Write-Log "=== ✅ Бэкап завершен ===" $ColorSuccess
Write-Log "" $ColorSuccess
Write-Log "📦 Архив: $ZipPath" $ColorInfo
Write-Log "📊 Размер: $($Manifest.BackupSize)" $ColorInfo
Write-Log "📁 Frontend: $($Manifest.Files.Frontend) файлов" $ColorInfo
Write-Log "📁 Backend: $($Manifest.Files.Backend) файлов" $ColorInfo
Write-Log "🏷️  Git: $($Manifest.GitBranch) @ $($Manifest.GitCommit)" $ColorInfo
Write-Log "" $ColorSuccess
Write-Log "📖 Инструкции по восстановлению:" $ColorInfo
Write-Log "   1. Распакуйте архив: Expand-Archive -Path '$ZipPath'" $ColorInfo
Write-Log "   2. Читайте: RESTORE_INSTRUCTIONS.md" $ColorInfo
Write-Log "" $ColorSuccess

# Список всех бэкапов
Write-Log "📜 Доступные бэкапы:" $ColorInfo
Get-ChildItem -Path $BackupDir -Filter "*.zip" | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -First 5 | 
    ForEach-Object {
        $age = (Get-Date) - $_.LastWriteTime
        $ageStr = if ($age.Days -gt 0) { "$($age.Days)d" } elseif ($age.Hours -gt 0) { "$($age.Hours)h" } else { "$($age.Minutes)m" }
        Write-Log "   • $($_.Name) ($($_.Length / 1MB | ForEach-Object { '{0:N2}' -f $_ }) MB, $ageStr ago)" $ColorInfo
    }

Write-Log "" $ColorSuccess
Write-Log "✨ Готово! Можно начинать рефакторинг." $ColorSuccess

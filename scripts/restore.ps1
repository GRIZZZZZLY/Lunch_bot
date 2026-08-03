# Скрипт восстановления из бэкапа
# Использование: .\scripts\restore.ps1 -BackupFile "путь\к\бэкапу.zip"

param(
    [Parameter(Mandatory=$false)]
    [string]$BackupFile,
    
    [switch]$Frontend = $false,
    [switch]$Backend = $false,
    [switch]$Force = $false,
    [switch]$SkipInstall = $false
)

$ColorSuccess = "Green"
$ColorInfo = "Cyan"
$ColorWarning = "Yellow"
$ColorError = "Red"

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor $Color
}

Write-Log "=== 🔄 Восстановление из бэкапа ===" $ColorInfo

# Если не указан файл, показать список доступных
if (-not $BackupFile) {
    Write-Log "📜 Доступные бэкапы:" $ColorInfo
    Write-Log "" $ColorInfo
    
    $Backups = Get-ChildItem -Path "C:\BOT_V2\backups" -Filter "*.zip" -ErrorAction SilentlyContinue | 
        Sort-Object LastWriteTime -Descending
    
    if ($Backups.Count -eq 0) {
        Write-Log "❌ Бэкапы не найдены" $ColorError
        exit 1
    }
    
    for ($i = 0; $i -lt $Backups.Count; $i++) {
        $backup = $Backups[$i]
        $age = (Get-Date) - $backup.LastWriteTime
        $ageStr = if ($age.Days -gt 0) { "$($age.Days) дней" } elseif ($age.Hours -gt 0) { "$($age.Hours) часов" } else { "$($age.Minutes) минут" }
        $sizeStr = "{0:N2} MB" -f ($backup.Length / 1MB)
        
        Write-Host "  [$i] " -NoNewline -ForegroundColor Yellow
        Write-Host "$($backup.Name)" -ForegroundColor Cyan
        Write-Host "      Дата: $($backup.LastWriteTime)" -ForegroundColor Gray
        Write-Host "      Размер: $sizeStr, Создан: $ageStr назад" -ForegroundColor Gray
        Write-Log "" $ColorInfo
    }
    
    Write-Host "Выберите номер бэкапа для восстановления (или 'q' для выхода): " -NoNewline -ForegroundColor Yellow
    $choice = Read-Host
    
    if ($choice -eq 'q') {
        Write-Log "Отменено пользователем" $ColorWarning
        exit 0
    }
    
    try {
        $index = [int]$choice
        if ($index -lt 0 -or $index -ge $Backups.Count) {
            Write-Log "❌ Неверный номер" $ColorError
            exit 1
        }
        $BackupFile = $Backups[$index].FullName
    } catch {
        Write-Log "❌ Неверный ввод" $ColorError
        exit 1
    }
}

# Проверка существования файла
if (-not (Test-Path $BackupFile)) {
    Write-Log "❌ Файл не найден: $BackupFile" $ColorError
    exit 1
}

Write-Log "📦 Выбран бэкап: $BackupFile" $ColorInfo

# Подтверждение
if (-not $Force) {
    Write-Host "" 
    Write-Host "⚠️  ВНИМАНИЕ!" -ForegroundColor Red
    Write-Host "Это действие перезапишет текущие файлы!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Что будет восстановлено:" -ForegroundColor Yellow
    if (-not $Frontend -and -not $Backend) {
        Write-Host "  • Frontend" -ForegroundColor Cyan
        Write-Host "  • Backend" -ForegroundColor Cyan
        Write-Host "  • Documentation" -ForegroundColor Cyan
    } else {
        if ($Frontend) { Write-Host "  • Frontend" -ForegroundColor Cyan }
        if ($Backend) { Write-Host "  • Backend" -ForegroundColor Cyan }
    }
    Write-Host ""
    Write-Host "Продолжить? (yes/no): " -NoNewline -ForegroundColor Yellow
    $confirm = Read-Host
    
    if ($confirm -ne 'yes') {
        Write-Log "Отменено пользователем" $ColorWarning
        exit 0
    }
}

# Создать временную директорию
$TempDir = Join-Path $env:TEMP "restore_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $TempDir | Out-Null

# Распаковать архив
Write-Log "📦 Распаковка архива..." $ColorInfo
try {
    Expand-Archive -Path $BackupFile -DestinationPath $TempDir -Force
    Write-Log "✅ Архив распакован" $ColorSuccess
} catch {
    Write-Log "❌ Ошибка распаковки: $_" $ColorError
    exit 1
}

# Прочитать манифест
$ManifestPath = Join-Path $TempDir "BACKUP_MANIFEST.json"
if (Test-Path $ManifestPath) {
    $Manifest = Get-Content $ManifestPath | ConvertFrom-Json
    Write-Log "📋 Манифест:" $ColorInfo
    Write-Log "   Дата: $($Manifest.BackupDate)" $ColorInfo
    Write-Log "   Git: $($Manifest.GitBranch) @ $($Manifest.GitCommit)" $ColorInfo
    Write-Log "   Размер: $($Manifest.BackupSize)" $ColorInfo
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot

# Восстановить Frontend
if (-not $Backend -or $Frontend) {
    Write-Log "🔄 Восстановление Frontend..." $ColorInfo
    
    $FrontendBackup = Join-Path $ProjectRoot "frontend-new.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    $FrontendPath = Join-Path $ProjectRoot "frontend-new"
    
    if (Test-Path $FrontendPath) {
        Move-Item -Path $FrontendPath -Destination $FrontendBackup -Force
        Write-Log "  → Текущий frontend сохранен: $FrontendBackup" $ColorWarning
    }
    
    $FrontendSrc = Join-Path $TempDir "frontend-new"
    Copy-Item -Path $FrontendSrc -Destination $FrontendPath -Recurse -Force
    Write-Log "✅ Frontend восстановлен" $ColorSuccess
}

# Восстановить Backend
if (-not $Frontend -or $Backend) {
    Write-Log "🔄 Восстановление Backend..." $ColorInfo
    
    $BackendBackup = Join-Path $ProjectRoot "backend.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    $BackendPath = Join-Path $ProjectRoot "backend"
    
    if (Test-Path $BackendPath) {
        Move-Item -Path $BackendPath -Destination $BackendBackup -Force
        Write-Log "  → Текущий backend сохранен: $BackendBackup" $ColorWarning
    }
    
    $BackendSrc = Join-Path $TempDir "backend"
    Copy-Item -Path $BackendSrc -Destination $BackendPath -Recurse -Force
    Write-Log "✅ Backend восстановлен" $ColorSuccess
}

# Восстановить документацию (если полное восстановление)
if (-not $Frontend -and -not $Backend) {
    $DocsSrc = Join-Path $TempDir "docs"
    if (Test-Path $DocsSrc) {
        Write-Log "🔄 Восстановление документации..." $ColorInfo
        $DocsPath = Join-Path $ProjectRoot "docs"
        Copy-Item -Path $DocsSrc -Destination $DocsPath -Recurse -Force
        Write-Log "✅ Документация восстановлена" $ColorSuccess
    }
}

# Удалить временную директорию
Remove-Item -Path $TempDir -Recurse -Force

# Установить зависимости
if (-not $SkipInstall) {
    Write-Log "📦 Установка зависимостей..." $ColorInfo
    
    if (-not $Backend -or $Frontend) {
        Write-Log "  → Frontend npm install..." $ColorInfo
        Push-Location (Join-Path $ProjectRoot "frontend-new")
        npm install --silent 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Log "  ✅ Frontend dependencies installed" $ColorSuccess
        } else {
            Write-Log "  ⚠️  Frontend npm install failed" $ColorWarning
        }
        Pop-Location
    }
    
    if (-not $Frontend -or $Backend) {
        Write-Log "  → Backend npm install..." $ColorInfo
        Push-Location (Join-Path $ProjectRoot "backend")
        npm install --silent 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Log "  ✅ Backend dependencies installed" $ColorSuccess
        } else {
            Write-Log "  ⚠️  Backend npm install failed" $ColorWarning
        }
        Pop-Location
    }
}

Write-Log "" $ColorSuccess
Write-Log "=== ✅ Восстановление завершено ===" $ColorSuccess
Write-Log "" $ColorSuccess
Write-Log "📋 Следующие шаги:" $ColorInfo
Write-Log "   1. Проверьте .env файлы" $ColorInfo
Write-Log "   2. Запустите тесты: npm test" $ColorInfo
Write-Log "   3. Запустите приложение: npm run dev" $ColorInfo
Write-Log "" $ColorSuccess

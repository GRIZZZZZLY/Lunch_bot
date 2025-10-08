# Quick Restore Script
# Usage: .\scripts\quick-restore.ps1 [-BackupFile "path\to\backup.zip"] [-FrontendOnly] [-BackendOnly]

param(
    [string]$BackupFile,
    [switch]$FrontendOnly = $false,
    [switch]$BackendOnly = $false,
    [switch]$Force = $false
)

$BackupDir = "C:\BOT_V2\backups"
$ProjectRoot = "C:\BOT_V2\telegram-food-bot"

Write-Host "=== Quick Restore ===" -ForegroundColor Cyan

# If no backup file specified, show list
if (-not $BackupFile) {
    Write-Host ""
    Write-Host "Available backups:" -ForegroundColor Cyan
    Write-Host ""
    
    $Backups = Get-ChildItem -Path $BackupDir -Filter "*.zip" -ErrorAction SilentlyContinue | 
        Sort-Object LastWriteTime -Descending
    
    if ($Backups.Count -eq 0) {
        Write-Host "[ERROR] No backups found in $BackupDir" -ForegroundColor Red
        exit 1
    }
    
    for ($i = 0; $i -lt $Backups.Count; $i++) {
        $backup = $Backups[$i]
        $age = (Get-Date) - $backup.LastWriteTime
        if ($age.Days -gt 0) { $ageStr = "$($age.Days) days" }
        elseif ($age.Hours -gt 0) { $ageStr = "$($age.Hours) hours" }
        else { $ageStr = "$($age.Minutes) minutes" }
        $sizeStr = "{0:N2} MB" -f ($backup.Length / 1MB)
        
        Write-Host "  [$i] " -NoNewline -ForegroundColor Yellow
        Write-Host "$($backup.Name)" -ForegroundColor White
        Write-Host "      Date: $($backup.LastWriteTime)" -ForegroundColor Gray
        Write-Host "      Size: $sizeStr, Created: $ageStr ago" -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Host "Select backup number (or 'q' to quit): " -NoNewline -ForegroundColor Yellow
    $choice = Read-Host
    
    if ($choice -eq 'q') {
        Write-Host "[INFO] Cancelled" -ForegroundColor Yellow
        exit 0
    }
    
    try {
        $index = [int]$choice
        if ($index -lt 0 -or $index -ge $Backups.Count) {
            Write-Host "[ERROR] Invalid number" -ForegroundColor Red
            exit 1
        }
        $BackupFile = $Backups[$index].FullName
    } catch {
        Write-Host "[ERROR] Invalid input" -ForegroundColor Red
        exit 1
    }
}

# Check file exists
if (-not (Test-Path $BackupFile)) {
    Write-Host "[ERROR] File not found: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[INFO] Selected backup: $BackupFile" -ForegroundColor Cyan

# Confirmation
if (-not $Force) {
    Write-Host ""
    Write-Host "WARNING: This will overwrite current files!" -ForegroundColor Red
    Write-Host ""
    Write-Host "What will be restored:" -ForegroundColor Yellow
    if ($FrontendOnly) {
        Write-Host "  - Frontend only" -ForegroundColor Cyan
    } elseif ($BackendOnly) {
        Write-Host "  - Backend only" -ForegroundColor Cyan
    } else {
        Write-Host "  - Frontend" -ForegroundColor Cyan
        Write-Host "  - Backend" -ForegroundColor Cyan
        Write-Host "  - Documentation" -ForegroundColor Cyan
    }
    Write-Host ""
    Write-Host "Continue? (yes/no): " -NoNewline -ForegroundColor Yellow
    $confirm = Read-Host
    
    if ($confirm -ne 'yes') {
        Write-Host "[INFO] Cancelled" -ForegroundColor Yellow
        exit 0
    }
}

# Extract to temp
$TempDir = Join-Path $env:TEMP "restore_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Write-Host ""
Write-Host "[INFO] Extracting archive..." -ForegroundColor Cyan

try {
    Expand-Archive -Path $BackupFile -DestinationPath $TempDir -Force
    Write-Host "[SUCCESS] Archive extracted" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to extract: $_" -ForegroundColor Red
    exit 1
}

# Restore Frontend
if (-not $BackendOnly) {
    Write-Host "[INFO] Restoring frontend..." -ForegroundColor Cyan
    
    $FrontendBackup = Join-Path $ProjectRoot "frontend.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    $FrontendPath = Join-Path $ProjectRoot "frontend"
    
    if (Test-Path $FrontendPath) {
        Move-Item -Path $FrontendPath -Destination $FrontendBackup -Force -ErrorAction SilentlyContinue
        Write-Host "[INFO] Current frontend backed up to: $FrontendBackup" -ForegroundColor Yellow
    }
    
    $FrontendSrc = Join-Path $TempDir "frontend"
    Copy-Item -Path $FrontendSrc -Destination $FrontendPath -Recurse -Force
    Write-Host "[SUCCESS] Frontend restored" -ForegroundColor Green
}

# Restore Backend
if (-not $FrontendOnly) {
    Write-Host "[INFO] Restoring backend..." -ForegroundColor Cyan
    
    $BackendBackup = Join-Path $ProjectRoot "backend.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    $BackendPath = Join-Path $ProjectRoot "backend"
    
    if (Test-Path $BackendPath) {
        Move-Item -Path $BackendPath -Destination $BackendBackup -Force -ErrorAction SilentlyContinue
        Write-Host "[INFO] Current backend backed up to: $BackendBackup" -ForegroundColor Yellow
    }
    
    $BackendSrc = Join-Path $TempDir "backend"
    Copy-Item -Path $BackendSrc -Destination $BackendPath -Recurse -Force
    Write-Host "[SUCCESS] Backend restored" -ForegroundColor Green
}

# Restore docs (if full restore)
if (-not $FrontendOnly -and -not $BackendOnly) {
    $DocsSrc = Join-Path $TempDir "docs"
    if (Test-Path $DocsSrc) {
        Write-Host "[INFO] Restoring documentation..." -ForegroundColor Cyan
        $DocsPath = Join-Path $ProjectRoot "docs"
        Copy-Item -Path $DocsSrc -Destination $DocsPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "[SUCCESS] Documentation restored" -ForegroundColor Green
    }
}

# Clean up temp
Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue

# Install dependencies
Write-Host ""
Write-Host "[INFO] Installing dependencies..." -ForegroundColor Cyan

if (-not $BackendOnly) {
    Write-Host "[INFO] Frontend npm install..." -ForegroundColor Cyan
    Push-Location (Join-Path $ProjectRoot "frontend")
    npm install --silent 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[SUCCESS] Frontend dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Frontend npm install had issues" -ForegroundColor Yellow
    }
    Pop-Location
}

if (-not $FrontendOnly) {
    Write-Host "[INFO] Backend npm install..." -ForegroundColor Cyan
    Push-Location (Join-Path $ProjectRoot "backend")
    npm install --silent 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[SUCCESS] Backend dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Backend npm install had issues" -ForegroundColor Yellow
    }
    Pop-Location
}

Write-Host ""
Write-Host "=== RESTORE COMPLETE ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Check .env files" -ForegroundColor Gray
Write-Host "  2. Run tests: npm test" -ForegroundColor Gray
Write-Host "  3. Start application: npm run dev" -ForegroundColor Gray
Write-Host ""

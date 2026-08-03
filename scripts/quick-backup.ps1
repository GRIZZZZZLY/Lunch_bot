# Quick Backup Script
# Usage: .\scripts\quick-backup.ps1

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$ProjectRoot = "C:\BOT_V2\telegram-food-bot"
$BackupDir = "C:\BOT_V2\backups"
$BackupName = "telegram-food-bot_backup_$Timestamp"
$BackupPath = Join-Path $BackupDir $BackupName

Write-Host "[INFO] Creating backup: $BackupPath" -ForegroundColor Cyan

# Create backup directory
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
    Write-Host "[SUCCESS] Created backup directory" -ForegroundColor Green
}

# Create temp directory
$TempBackupPath = Join-Path $env:TEMP $BackupName
if (Test-Path $TempBackupPath) {
    Remove-Item -Path $TempBackupPath -Recurse -Force
}
New-Item -ItemType Directory -Path $TempBackupPath | Out-Null

# Copy frontend (excluding node_modules)
Write-Host "[INFO] Copying frontend-new..." -ForegroundColor Cyan
$FrontendSrc = Join-Path $ProjectRoot "frontend-new"
$FrontendDst = Join-Path $TempBackupPath "frontend-new"
$null = robocopy $FrontendSrc $FrontendDst /E /XD node_modules .next dist build coverage .vite /NFL /NDL /NJH /NJS

# Copy backend (excluding node_modules)
Write-Host "[INFO] Copying backend..." -ForegroundColor Cyan
$BackendSrc = Join-Path $ProjectRoot "backend"
$BackendDst = Join-Path $TempBackupPath "backend"
$null = robocopy $BackendSrc $BackendDst /E /XD node_modules dist coverage /NFL /NDL /NJH /NJS

# Copy docs
Write-Host "[INFO] Copying docs..." -ForegroundColor Cyan
$DocsSrc = Join-Path $ProjectRoot "docs"
if (Test-Path $DocsSrc) {
    $DocsDst = Join-Path $TempBackupPath "docs"
    Copy-Item -Path $DocsSrc -Destination $DocsDst -Recurse -Force -ErrorAction SilentlyContinue
}

# Copy root files
Write-Host "[INFO] Copying root files..." -ForegroundColor Cyan
$RootFiles = @("README.md", "package.json", "package-lock.json", ".gitignore")
foreach ($file in $RootFiles) {
    $srcFile = Join-Path $ProjectRoot $file
    if (Test-Path $srcFile) {
        Copy-Item -Path $srcFile -Destination $TempBackupPath -Force -ErrorAction SilentlyContinue
    }
}

# Create manifest
Write-Host "[INFO] Creating manifest..." -ForegroundColor Cyan
$Manifest = @{
    BackupDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    ProjectName = "Telegram Food Bot"
    Version = "2.0"
    GitCommit = ""
    GitBranch = ""
    BackupSize = ""
    Files = @{
        Frontend = 0
        Backend = 0
    }
}

# Count files
$Manifest.Files.Frontend = (Get-ChildItem -Path $FrontendDst -Recurse -File -ErrorAction SilentlyContinue).Count
$Manifest.Files.Backend = (Get-ChildItem -Path $BackendDst -Recurse -File -ErrorAction SilentlyContinue).Count

# Get git info
Push-Location $ProjectRoot
try {
    $GitCommit = git rev-parse --short HEAD 2>$null
    $GitBranch = git branch --show-current 2>$null
    if ($GitCommit) { $Manifest.GitCommit = $GitCommit }
    if ($GitBranch) { $Manifest.GitBranch = $GitBranch }
} catch {
    Write-Host "[WARNING] Git info unavailable" -ForegroundColor Yellow
}
Pop-Location

# Save manifest
$ManifestPath = Join-Path $TempBackupPath "BACKUP_MANIFEST.json"
$Manifest | ConvertTo-Json -Depth 10 | Out-File -FilePath $ManifestPath -Encoding UTF8

# Create archive
Write-Host "[INFO] Creating ZIP archive..." -ForegroundColor Cyan
$ZipPath = "$BackupPath.zip"

try {
    Compress-Archive -Path "$TempBackupPath\*" -DestinationPath $ZipPath -Force
    $ZipSize = (Get-Item $ZipPath).Length / 1MB
    $Manifest.BackupSize = "{0:N2} MB" -f $ZipSize
    Write-Host "[SUCCESS] Archive created: $ZipPath" -ForegroundColor Green
    Write-Host "[INFO] Size: $($Manifest.BackupSize)" -ForegroundColor Cyan
} catch {
    Write-Host "[ERROR] Failed to create archive: $_" -ForegroundColor Red
    Remove-Item -Path $TempBackupPath -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

# Clean up temp
Remove-Item -Path $TempBackupPath -Recurse -Force -ErrorAction SilentlyContinue

# Create git tag
Write-Host "[INFO] Creating git tag..." -ForegroundColor Cyan
Push-Location $ProjectRoot
try {
    $TagName = "backup-$Timestamp"
    git tag -a $TagName -m "Backup created at $Timestamp before refactoring" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[SUCCESS] Git tag created: $TagName" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Git tag not created" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARNING] Git unavailable" -ForegroundColor Yellow
}
Pop-Location

# Final report
Write-Host ""
Write-Host "=== BACKUP COMPLETE ===" -ForegroundColor Green
Write-Host ""
Write-Host "Archive: $ZipPath" -ForegroundColor Cyan
Write-Host "Size: $($Manifest.BackupSize)" -ForegroundColor Cyan
Write-Host "Frontend: $($Manifest.Files.Frontend) files" -ForegroundColor Cyan
Write-Host "Backend: $($Manifest.Files.Backend) files" -ForegroundColor Cyan
Write-Host "Git: $($Manifest.GitBranch) @ $($Manifest.GitCommit)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Available backups:" -ForegroundColor Cyan
Get-ChildItem -Path $BackupDir -Filter "*.zip" -ErrorAction SilentlyContinue | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -First 5 | 
    ForEach-Object {
        $age = (Get-Date) - $_.LastWriteTime
        if ($age.Days -gt 0) { $ageStr = "$($age.Days)d" }
        elseif ($age.Hours -gt 0) { $ageStr = "$($age.Hours)h" }
        else { $ageStr = "$($age.Minutes)m" }
        $sizeMB = "{0:N2}" -f ($_.Length / 1MB)
        Write-Host "  - $($_.Name) ($sizeMB MB, $ageStr ago)" -ForegroundColor Gray
    }
Write-Host ""
Write-Host "Done! Ready to start refactoring." -ForegroundColor Green

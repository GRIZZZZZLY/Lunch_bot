# ========================================
# Update ngrok URLs in .env files
# ========================================

param(
    [string]$NgrokUrl = ""
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Update ngrok URLs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ask for URL if not provided
if (-not $NgrokUrl) {
    Write-Host "Paste your ngrok URL from the ngrok window:" -ForegroundColor Yellow
    Write-Host "Example: https://abc123.ngrok-free.app" -ForegroundColor Gray
    Write-Host ""
    $NgrokUrl = Read-Host "ngrok URL"
}

# Validate URL
if (-not $NgrokUrl) {
    Write-Host "ERROR: No URL provided!" -ForegroundColor Red
    exit 1
}

# Remove trailing slash if present
$NgrokUrl = $NgrokUrl.TrimEnd('/')

# Validate format
if ($NgrokUrl -notmatch '^https://[a-zA-Z0-9\-\.]+\.ngrok-free\.app$') {
    Write-Host "WARNING: URL format doesn't match ngrok pattern" -ForegroundColor Yellow
    Write-Host "Expected format: https://xxxxx.ngrok-free.app" -ForegroundColor Yellow
    Write-Host "Provided: $NgrokUrl" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Cancelled" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Using ngrok URL: $NgrokUrl" -ForegroundColor Green
Write-Host ""

# Backup files
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "backups\env_$timestamp"

Write-Host "Creating backups..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

if (Test-Path "backend\.env") {
    Copy-Item "backend\.env" "$backupDir\backend.env.backup"
    Write-Host "  Backed up: backend\.env" -ForegroundColor Gray
}

if (Test-Path "frontend\.env") {
    Copy-Item "frontend\.env" "$backupDir\frontend.env.backup"
    Write-Host "  Backed up: frontend\.env" -ForegroundColor Gray
}

Write-Host "Backups saved to: $backupDir" -ForegroundColor Green
Write-Host ""

# Update backend\.env
Write-Host "Updating backend\.env..." -ForegroundColor Yellow

if (Test-Path "backend\.env") {
    $backendEnv = Get-Content "backend\.env"
    
    # Update WEBAPP_URL
    $backendEnv = $backendEnv -replace '^(WEBAPP_URL=)https://.*', "`${1}$NgrokUrl"
    
    # Update CORS_ORIGIN - simple replace of ngrok URLs
    $backendEnv = $backendEnv -replace '^(CORS_ORIGIN=.*)https://[a-zA-Z0-9\-]+\.ngrok-free\.app(.*)$', "`${1}$NgrokUrl`$2"
    
    # If no ngrok URL in CORS_ORIGIN, add it
    $corsLine = $backendEnv | Where-Object { $_ -match '^CORS_ORIGIN=' }
    if ($corsLine -and $corsLine -notmatch $NgrokUrl) {
        $backendEnv = $backendEnv -replace '^(CORS_ORIGIN=.*)$', "`${1},$NgrokUrl"
    }
    
    # Save
    $backendEnv | Set-Content "backend\.env"
    Write-Host "  Updated WEBAPP_URL" -ForegroundColor Green
    Write-Host "  Updated CORS_ORIGIN" -ForegroundColor Green
} else {
    Write-Host "  WARNING: backend\.env not found!" -ForegroundColor Red
}

Write-Host ""

# Update frontend\.env
Write-Host "Updating frontend\.env..." -ForegroundColor Yellow

if (Test-Path "frontend\.env") {
    $frontendEnv = Get-Content "frontend\.env" -Raw
    
    # Update VITE_API_URL
    $apiUrl = "$NgrokUrl/api"
    $frontendEnv = $frontendEnv -replace '(VITE_API_URL=)https://[^\s]+', "`$1$apiUrl"
    
    # Save
    $frontendEnv | Set-Content "frontend\.env" -NoNewline
    Write-Host "  Updated VITE_API_URL to: $apiUrl" -ForegroundColor Green
} else {
    Write-Host "  WARNING: frontend\.env not found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  URLs UPDATED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Show summary
Write-Host "Summary of changes:" -ForegroundColor Cyan
Write-Host ""
Write-Host "backend\.env:" -ForegroundColor Yellow
Write-Host "  WEBAPP_URL=$NgrokUrl" -ForegroundColor Gray
Write-Host "  CORS_ORIGIN=http://localhost:5173,...,$NgrokUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "frontend\.env:" -ForegroundColor Yellow
Write-Host "  VITE_API_URL=$NgrokUrl/api" -ForegroundColor Gray
Write-Host ""

# Ask to restart backend
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  IMPORTANT: Restart Backend!" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Backend needs to be restarted for changes to take effect." -ForegroundColor White
Write-Host ""
Write-Host "Steps:" -ForegroundColor Cyan
Write-Host "  1. Find the 'BACKEND DEV SERVER' window" -ForegroundColor White
Write-Host "  2. Press Ctrl+C to stop" -ForegroundColor White
Write-Host "  3. Run: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Or run this script to restart automatically:" -ForegroundColor Cyan
Write-Host "  .\restart-backend.ps1" -ForegroundColor Gray
Write-Host ""

# Offer to restart backend automatically
$restart = Read-Host "Restart backend automatically? (Y/n)"
if ($restart -ne "n" -and $restart -ne "N") {
    Write-Host ""
    Write-Host "Attempting to restart backend..." -ForegroundColor Yellow
    
    # Kill existing node processes on port 3001
    $nodeProcesses = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object {
        Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    }
    
    if ($nodeProcesses) {
        $nodeProcesses | Stop-Process -Force
        Write-Host "Stopped existing backend process" -ForegroundColor Green
        Start-Sleep -Seconds 1
    }
    
    # Start new backend process
    Write-Host "Starting backend..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "cd '$PWD\backend'; `
         Write-Host ''; `
         Write-Host '========================================' -ForegroundColor Green; `
         Write-Host '  BACKEND DEV SERVER (RESTARTED)' -ForegroundColor Green; `
         Write-Host '========================================' -ForegroundColor Green; `
         Write-Host ''; `
         Write-Host 'URLs updated! ngrok URL: $NgrokUrl' -ForegroundColor Cyan; `
         Write-Host ''; `
         npm run dev"
    )
    
    Write-Host "Backend restarted in new window!" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All Done! Test in Telegram!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open @rocket_lunch_bot in Telegram" -ForegroundColor White
Write-Host "2. Press 'Menu' button (left side)" -ForegroundColor White
Write-Host "3. WebApp should open!" -ForegroundColor White
Write-Host ""

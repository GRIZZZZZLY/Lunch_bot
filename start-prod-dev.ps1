# ========================================
# Telegram Food Bot - PRODUCTION-DEV Mode
# ========================================
# Hybrid mode:
# - Production build (optimized, fast)
# - Dev conveniences (console.log, source maps, SKIP_TELEGRAM_VALIDATION)
# - Watch mode (auto-rebuild on changes)

param(
    [switch]$SkipChecks
)

$ErrorActionPreference = 'Stop'

# Единственный интерфейс. Флаг -OldFrontend убран вместе с каталогом frontend/.
$frontendDir = 'frontend-new'
Write-Host "Frontend directory: $frontendDir" -ForegroundColor Cyan

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PRODUCTION-DEV MODE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This mode combines:" -ForegroundColor Yellow
Write-Host "  Production optimization (fast, minified)" -ForegroundColor Green
Write-Host "  Dev debugging (console.log, source maps)" -ForegroundColor Green
Write-Host "  SKIP_TELEGRAM_VALIDATION (ngrok friendly)" -ForegroundColor Green
Write-Host "  Watch mode (auto-rebuild on changes)" -ForegroundColor Green
Write-Host ""

# Check if in correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: Must run from telegram-food-bot directory!" -ForegroundColor Red
    exit 1
}

# Check Node.js
if (-not $SkipChecks) {
    Write-Host "Checking Node.js..." -ForegroundColor Yellow
    try {
        $nodeVersion = node --version
        Write-Host "OK Node.js: $nodeVersion" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: Node.js not found! Install from https://nodejs.org" -ForegroundColor Red
        exit 1
    }

    Write-Host "Checking npm..." -ForegroundColor Yellow
    try {
        $npmVersion = npm --version
        Write-Host "OK npm: $npmVersion" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: npm not found!" -ForegroundColor Red
        exit 1
    }
}

# Check dependencies
Write-Host ""
Write-Host "Checking dependencies..." -ForegroundColor Yellow

if (-not (Test-Path "backend\node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    Set-Location backend
    npm install
    Set-Location ..
}

if (-not (Test-Path "$frontendDir\node_modules")) {
    Write-Host "Installing $frontendDir dependencies..." -ForegroundColor Yellow
    Set-Location $frontendDir
    npm install
    Set-Location ..
}

Write-Host "OK Dependencies OK" -ForegroundColor Green

# Copy .env.prod-dev files
Write-Host ""
Write-Host "Setting up prod-dev environment..." -ForegroundColor Yellow

# Backend
if (Test-Path "backend\.env") {
    Copy-Item "backend\.env" "backend\.env.backup" -Force
    Write-Host "OK Backed up backend/.env" -ForegroundColor Gray
}
if (Test-Path "backend\.env.prod-dev") {
    Copy-Item "backend\.env.prod-dev" "backend\.env" -Force
    Write-Host "OK Loaded backend/.env.prod-dev" -ForegroundColor Green
} else {
    Write-Host "WARNING: backend/.env.prod-dev not found!" -ForegroundColor Yellow
}

# Frontend env
if (Test-Path "$frontendDir\.env") {
    Copy-Item "$frontendDir\.env" "$frontendDir\.env.backup" -Force
    Write-Host "OK Backed up $frontendDir/.env" -ForegroundColor Gray
}
if (Test-Path "$frontendDir\.env.prod-dev") {
    Copy-Item "$frontendDir\.env.prod-dev" "$frontendDir\.env" -Force
    Write-Host "OK Loaded $frontendDir/.env.prod-dev" -ForegroundColor Green
} elseif (Test-Path "$frontendDir\.env.development") {
    Copy-Item "$frontendDir\.env.development" "$frontendDir\.env" -Force
    Write-Host "OK Loaded $frontendDir/.env.development (fallback)" -ForegroundColor Green
}

# Ensure backend serves the new frontend
$envFile = "backend\.env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -notmatch 'FRONTEND_DIR=') {
        Add-Content $envFile "`nFRONTEND_DIR=$frontendDir"
        Write-Host "OK Added FRONTEND_DIR=$frontendDir to backend/.env" -ForegroundColor Green
    } else {
        (Get-Content $envFile) -replace '^FRONTEND_DIR=.*', "FRONTEND_DIR=$frontendDir" | Set-Content $envFile
        Write-Host "OK Set FRONTEND_DIR=$frontendDir in backend/.env" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Starting Services..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$projectRoot = Get-Location

# Clean up stale tunnel log
$tunnelLog = "$projectRoot\.cloudflared.log"
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }

# -------------------------------------------------------------
# Step 1: Start Cloudflare Tunnel (Window 1)
# -------------------------------------------------------------
Write-Host "Starting Cloudflare Tunnel..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '';
Write-Host '========================================' -ForegroundColor Cyan;
Write-Host '  CLOUDFLARE TUNNEL' -ForegroundColor Cyan;
Write-Host '========================================' -ForegroundColor Cyan;
Write-Host '';
Write-Host 'Tunneling: http://localhost:3001' -ForegroundColor White;
Write-Host 'URL is auto-injected into backend/.env before backend starts' -ForegroundColor Yellow;
Write-Host '';
cmd /c 'cloudflared tunnel --url http://localhost:3001 2>&1' | Tee-Object -FilePath '$tunnelLog'
"@

# -------------------------------------------------------------
# Step 2: Wait for tunnel URL and update backend/.env
#   (synchronous in main script so backend starts with fresh URL)
# -------------------------------------------------------------
Write-Host "Waiting for tunnel URL..." -ForegroundColor Yellow
$tunnelUrl = $null
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
        $content = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
        if ($content -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
            $tunnelUrl = $matches[0]
            break
        }
    }
}

if (-not $tunnelUrl) {
    Write-Host ""
    Write-Host "ERROR: Tunnel URL not detected in 60s." -ForegroundColor Red
    Write-Host "Check the Cloudflare Tunnel window. Install if missing:" -ForegroundColor Yellow
    Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "OK Tunnel URL: $tunnelUrl" -ForegroundColor Green

# Update backend/.env
$envPath = Join-Path $projectRoot 'backend\.env'
if (Test-Path $envPath) {
    $nl = [char]10
    $envRaw = Get-Content $envPath -Raw
    if ($envRaw -match '(?m)^WEBAPP_URL=') {
        $envRaw = [regex]::Replace($envRaw, '(?m)^WEBAPP_URL=.*', ('WEBAPP_URL=' + $tunnelUrl))
    } else {
        $envRaw = $envRaw.TrimEnd() + $nl + 'WEBAPP_URL=' + $tunnelUrl + $nl
    }
    $corsValue = 'CORS_ORIGIN=http://localhost:5173,http://localhost:3001,' + $tunnelUrl
    if ($envRaw -match '(?m)^CORS_ORIGIN=') {
        $envRaw = [regex]::Replace($envRaw, '(?m)^CORS_ORIGIN=.*', $corsValue)
    } else {
        $envRaw = $envRaw.TrimEnd() + $nl + $corsValue + $nl
    }
    Set-Content -Path $envPath -Value $envRaw -NoNewline
    Write-Host "OK backend/.env updated (WEBAPP_URL, CORS_ORIGIN)" -ForegroundColor Green
} else {
    Write-Host "ERROR: backend/.env not found at $envPath" -ForegroundColor Red
    exit 1
}

# -------------------------------------------------------------
# Step 3: Start Backend (Window 2) — now reads fresh WEBAPP_URL.
#   setupDefaultMenuButton at bot startup will set the menu button
#   to the new tunnel URL with text "🍽 Обед" (see group-events.ts).
# -------------------------------------------------------------
Write-Host ""
Write-Host "Starting Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '';
Write-Host '========================================' -ForegroundColor Cyan;
Write-Host '  BACKEND PROD-DEV' -ForegroundColor Cyan;
Write-Host '========================================' -ForegroundColor Cyan;
Write-Host '';
Write-Host 'WEBAPP_URL: $tunnelUrl' -ForegroundColor White;
Write-Host 'Port: 3001' -ForegroundColor White;
Write-Host '';
Write-Host 'Building TypeScript...' -ForegroundColor Yellow;
cd '$projectRoot\backend';
npm run build;
Write-Host '';
Write-Host 'OK Build completed' -ForegroundColor Green;
Write-Host 'Starting backend (will set menu button on bot startup)...' -ForegroundColor Yellow;
Write-Host '';
npm start
"@

Start-Sleep -Seconds 2

# -------------------------------------------------------------
# Step 4: Start Frontend (Window 3)
# -------------------------------------------------------------
Write-Host "Starting Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '';
Write-Host '========================================' -ForegroundColor Cyan;
Write-Host '  FRONTEND PROD-DEV (Watch Mode)' -ForegroundColor Cyan;
Write-Host '========================================' -ForegroundColor Cyan;
Write-Host '';
Write-Host 'Output: dist/  (served by backend at $tunnelUrl)' -ForegroundColor White;
Write-Host '';
cd '$projectRoot\$frontendDir';
npm run build:prod-dev
"@

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  OK All Services Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "3 Windows opened:" -ForegroundColor Cyan
Write-Host "  1. Cloudflare Tunnel" -ForegroundColor White
Write-Host "  2. Backend PROD-DEV (build + run, sets menu button on startup)" -ForegroundColor White
Write-Host "  3. Frontend PROD-DEV (watch mode)" -ForegroundColor White
Write-Host ""
Write-Host "Mini App URL: $tunnelUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Telegram cache note:" -ForegroundColor Yellow
Write-Host "  If menu button still shows the old URL in Telegram Desktop," -ForegroundColor Gray
Write-Host "  fully quit via tray (right-click -> Quit) and reopen." -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C in each window to stop" -ForegroundColor DarkGray
Write-Host ""

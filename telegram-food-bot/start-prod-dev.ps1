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

if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location frontend
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

# Frontend
if (Test-Path "frontend\.env") {
    Copy-Item "frontend\.env" "frontend\.env.backup" -Force
    Write-Host "OK Backed up frontend/.env" -ForegroundColor Gray
}
if (Test-Path "frontend\.env.prod-dev") {
    Copy-Item "frontend\.env.prod-dev" "frontend\.env" -Force
    Write-Host "OK Loaded frontend/.env.prod-dev" -ForegroundColor Green
} else {
    Write-Host "WARNING: frontend/.env.prod-dev not found!" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Starting Services..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$projectRoot = Get-Location

# Window 1: Backend (production build with watch mode)
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host ''; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host '  BACKEND PROD-DEV' -ForegroundColor Cyan; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host ''; 
Write-Host 'Building TypeScript...' -ForegroundColor Yellow; 
Write-Host ''; 
cd '$projectRoot\backend'; 
npm run build; 
Write-Host ''; 
Write-Host 'OK Build completed' -ForegroundColor Green; 
Write-Host 'Starting backend...' -ForegroundColor Yellow; 
Write-Host ''; 
Write-Host 'Port: 3001' -ForegroundColor White; 
Write-Host 'API:  http://localhost:3001/api' -ForegroundColor White; 
Write-Host 'Web:  http://localhost:3001' -ForegroundColor White; 
Write-Host ''; 
Write-Host 'OK Production build' -ForegroundColor Green; 
Write-Host 'OK Serving static from dist/' -ForegroundColor Green; 
Write-Host 'OK SKIP_TELEGRAM_VALIDATION' -ForegroundColor Green; 
Write-Host ''; 
npm start
"@

Start-Sleep -Seconds 2

# Window 2: Frontend (Vite build watch mode)
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host ''; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host '  FRONTEND PROD-DEV (Watch Mode)' -ForegroundColor Cyan; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host ''; 
Write-Host 'Output: dist/' -ForegroundColor White; 
Write-Host ''; 
Write-Host 'OK Production build' -ForegroundColor Green; 
Write-Host 'OK Source maps enabled' -ForegroundColor Green; 
Write-Host 'OK Console.log preserved' -ForegroundColor Green; 
Write-Host 'OK Watch mode' -ForegroundColor Green; 
Write-Host ''; 
Write-Host 'Building...' -ForegroundColor Yellow; 
cd '$projectRoot\frontend'; 
npm run build:prod-dev
"@

Start-Sleep -Seconds 2

# Window 3: ngrok
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host ''; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host '  NGROK TUNNEL' -ForegroundColor Cyan; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host ''; 
Write-Host 'Tunneling: http://localhost:3001' -ForegroundColor White; 
Write-Host ''; 
Write-Host 'Copy the HTTPS URL below and paste it in Window 4!' -ForegroundColor Yellow; 
Write-Host ''; 
ngrok http 3001
"@

Start-Sleep -Seconds 2

# Window 4: URL Updater (автоматически обновляет ngrok URL)
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host ''; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host '  URL UPDATER' -ForegroundColor Cyan; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host ''; 
Write-Host 'Waiting for ngrok to start...' -ForegroundColor Yellow; 
Start-Sleep -Seconds 5; 
Write-Host ''; 
Write-Host 'Fetching ngrok URL...' -ForegroundColor Yellow; 
try {
    `$ngrokApi = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -ErrorAction Stop;
    `$ngrokUrl = `$ngrokApi.tunnels[0].public_url;
    if (`$ngrokUrl) {
        Write-Host ''; 
        Write-Host '[OK] Found ngrok URL:' -ForegroundColor Green; 
        Write-Host '  ' `$ngrokUrl -ForegroundColor White; 
        Write-Host ''; 
        Write-Host 'Updating .env files...' -ForegroundColor Yellow; 
        cd '$projectRoot';
        `$output = .\update-urls.ps1 -NgrokUrl `$ngrokUrl -Auto;
        Write-Host ''; 
        Write-Host '[OK] URLs updated successfully!' -ForegroundColor Green; 
        Write-Host ''; 
        Write-Host '========================================' -ForegroundColor Green; 
        Write-Host '  READY TO TEST!' -ForegroundColor Green; 
        Write-Host '========================================' -ForegroundColor Green; 
        Write-Host ''; 
        Write-Host 'Open @rocket_lunch_bot in Telegram' -ForegroundColor White; 
        Write-Host 'Mini App URL: ' `$ngrokUrl -ForegroundColor Cyan; 
        Write-Host ''; 
    } else {
        Write-Host ''; 
        Write-Host '[ERROR] Could not get ngrok URL' -ForegroundColor Red; 
        Write-Host ''; 
        Write-Host 'Manual steps:' -ForegroundColor Yellow; 
        Write-Host '  1. Copy ngrok URL from Window 3' -ForegroundColor Gray; 
        Write-Host '  2. Run: .\update-urls.ps1' -ForegroundColor Gray; 
        Write-Host ''; 
    }
} catch {
    Write-Host ''; 
    Write-Host '[ERROR] Failed to connect to ngrok API' -ForegroundColor Red; 
    Write-Host ''; 
    Write-Host 'Manual steps:' -ForegroundColor Yellow; 
    Write-Host '  1. Copy ngrok URL from Window 3' -ForegroundColor Gray; 
    Write-Host '  2. Run: .\update-urls.ps1' -ForegroundColor Gray; 
    Write-Host ''; 
}
Write-Host 'Press Ctrl+C to close' -ForegroundColor DarkGray; 
while (`$true) { Start-Sleep -Seconds 60 }
"@

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  OK All Services Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "4 Windows opened:" -ForegroundColor Cyan
Write-Host "  1. Backend PROD-DEV (build + run)" -ForegroundColor White
Write-Host "  2. Frontend PROD-DEV (watch mode)" -ForegroundColor White
Write-Host "  3. ngrok Tunnel (port 3001)" -ForegroundColor White
Write-Host "  4. URL Updater (auto-updates ngrok URL)" -ForegroundColor White
Write-Host ""
Write-Host "Architecture:" -ForegroundColor Yellow
Write-Host "  Telegram -> ngrok -> Backend:3001 -+- /api -> API" -ForegroundColor Gray
Write-Host "                                      +- /    -> Static (dist/)" -ForegroundColor Gray
Write-Host ""
Write-Host "ngrok URL will be auto-detected and updated in ~10 seconds..." -ForegroundColor Cyan
Write-Host "Check Window 4 (URL Updater) for status!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Features:" -ForegroundColor Yellow
Write-Host "  OK Production optimization" -ForegroundColor Green
Write-Host "  OK Auto-rebuild on file changes" -ForegroundColor Green
Write-Host "  OK Console.log for debugging" -ForegroundColor Green
Write-Host "  OK Source maps for debugging" -ForegroundColor Green
Write-Host "  OK SKIP_TELEGRAM_VALIDATION" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C in each window to stop" -ForegroundColor DarkGray
Write-Host ""

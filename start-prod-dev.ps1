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

# Window 1: Backend (compiled with watch mode)
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host ''; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host '  BACKEND PROD-DEV (Watch Mode)' -ForegroundColor Cyan; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host ''; 
Write-Host 'Port: 3001' -ForegroundColor White; 
Write-Host 'URL: http://localhost:3001' -ForegroundColor White; 
Write-Host ''; 
Write-Host 'OK Production environment' -ForegroundColor Green; 
Write-Host 'OK Watch mode (auto-restart)' -ForegroundColor Green; 
Write-Host 'OK SKIP_TELEGRAM_VALIDATION' -ForegroundColor Green; 
Write-Host ''; 
cd '$projectRoot\backend'; 
npm run dev
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

# Window 3: Proxy Server
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host ''; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host '  PROXY SERVER' -ForegroundColor Cyan; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host ''; 
Write-Host 'Port: 8080' -ForegroundColor White; 
Write-Host 'URL: http://localhost:8080' -ForegroundColor White; 
Write-Host ''; 
Write-Host 'Routes:' -ForegroundColor Yellow; 
Write-Host '  /api/*  -> http://localhost:3001/api/*' -ForegroundColor Gray; 
Write-Host '  /*      -> frontend/dist/*' -ForegroundColor Gray; 
Write-Host ''; 
cd '$projectRoot'; 
node proxy-server.js
"@

Start-Sleep -Seconds 2

# Window 4: ngrok
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host ''; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host '  NGROK TUNNEL' -ForegroundColor Cyan; 
Write-Host '========================================' -ForegroundColor Cyan; 
Write-Host ''; 
Write-Host 'Tunneling: http://localhost:8080' -ForegroundColor White; 
Write-Host ''; 
Write-Host 'Copy the HTTPS URL below and paste it in Window 5!' -ForegroundColor Yellow; 
Write-Host ''; 
ngrok http 8080
"@

Start-Sleep -Seconds 2

# Window 5: URL Updater
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host ''; 
Write-Host '========================================' -ForegroundColor Green; 
Write-Host '  URL UPDATER' -ForegroundColor Green; 
Write-Host '========================================' -ForegroundColor Green; 
Write-Host ''; 
Write-Host 'This will update .env files with ngrok URL' -ForegroundColor Cyan; 
Write-Host ''; 
cd '$projectRoot'; 
.\update-urls-prod.ps1
"@

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  OK All Services Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "5 Windows opened:" -ForegroundColor Cyan
Write-Host "  1. Backend PROD-DEV (Watch Mode)" -ForegroundColor White
Write-Host "  2. Frontend PROD-DEV (Watch Mode)" -ForegroundColor White
Write-Host "  3. Proxy Server (8080)" -ForegroundColor White
Write-Host "  4. ngrok Tunnel" -ForegroundColor White
Write-Host "  5. URL Updater" -ForegroundColor White
Write-Host ""
Write-Host "Window 5 (URL Updater) will guide you through:" -ForegroundColor Cyan
Write-Host "  1. Paste ngrok URL" -ForegroundColor White
Write-Host "  2. Auto-update .env files" -ForegroundColor White
Write-Host "  3. Auto-rebuild frontend" -ForegroundColor White
Write-Host "  4. Auto-restart backend" -ForegroundColor White
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

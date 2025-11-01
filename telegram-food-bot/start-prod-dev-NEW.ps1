# ========================================
# Telegram Food Bot - PROD-DEV Environment
# Production build with Dev conveniences
# ========================================

param(
    [switch]$SkipChecks,
    [switch]$NoNgrok
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PROD-DEV MODE - Optimized + Debug" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not installed!" -ForegroundColor Red
    exit 1
}

# Check ngrok (unless skipped)
if (-not $NoNgrok) {
    if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
        Write-Host "WARNING: ngrok not installed!" -ForegroundColor Yellow
        Write-Host "Install: winget install ngrok" -ForegroundColor Yellow
        Write-Host "Or run with -NoNgrok to skip ngrok check" -ForegroundColor Yellow
        exit 1
    }
}

# Check project structure
$requiredPaths = @(
    "backend\package.json",
    "frontend\package.json",
    "proxy-server.js"
)

foreach ($path in $requiredPaths) {
    if (-not (Test-Path $path)) {
        Write-Host "ERROR: $path not found!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "OK: All checks passed" -ForegroundColor Green
Write-Host ""

# Setup PROD-DEV environment files
Write-Host "Setting up PROD-DEV environment..." -ForegroundColor Yellow

# Backend: Copy .env.prod-dev to .env
if (Test-Path "backend\.env") {
    Copy-Item "backend\.env" "backend\.env.backup" -Force
    Write-Host "  Backed up backend/.env" -ForegroundColor Gray
}
if (Test-Path "backend\.env.prod-dev") {
    Copy-Item "backend\.env.prod-dev" "backend\.env" -Force
    Write-Host "  Loaded backend/.env.prod-dev" -ForegroundColor Green
} else {
    Write-Host "  WARNING: backend/.env.prod-dev not found!" -ForegroundColor Yellow
}

# Frontend: Copy .env.prod-dev to .env
if (Test-Path "frontend\.env") {
    Copy-Item "frontend\.env" "frontend\.env.backup" -Force
    Write-Host "  Backed up frontend/.env" -ForegroundColor Gray
}
if (Test-Path "frontend\.env.prod-dev") {
    Copy-Item "frontend\.env.prod-dev" "frontend\.env" -Force
    Write-Host "  Loaded frontend/.env.prod-dev" -ForegroundColor Green
} else {
    Write-Host "  Using existing frontend/.env" -ForegroundColor Gray
}

Write-Host ""

# Install dependencies if needed (unless skipped)
if (-not $SkipChecks) {
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

    if (-not (Test-Path "node_modules\http-proxy")) {
        Write-Host "Installing http-proxy..." -ForegroundColor Yellow
        npm install http-proxy
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Preparing Frontend..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if frontend/dist exists, if not - create initial build
if (-not (Test-Path "frontend\dist")) {
    Write-Host "No dist/ found, creating initial build..." -ForegroundColor Yellow
    Set-Location frontend
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Initial frontend build failed!" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    Write-Host "OK: Initial build completed" -ForegroundColor Green
    Set-Location ..
} else {
    Write-Host "OK: Using existing dist/, watcher will rebuild if needed" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Starting Services..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
if (-not $NoNgrok) {
    Write-Host "4 terminal windows will open:" -ForegroundColor White
    Write-Host "  1. Backend (port 3001) - serves API + static" -ForegroundColor Cyan
    Write-Host "  2. Frontend Watcher - rebuilds on changes" -ForegroundColor Cyan
    Write-Host "  3. ngrok (HTTPS tunnel on 3001)" -ForegroundColor Cyan
    Write-Host "  4. URL Updater (auto-config)" -ForegroundColor Green
} else {
    Write-Host "2 terminal windows will open:" -ForegroundColor White
    Write-Host "  1. Backend (port 3001)" -ForegroundColor Cyan
    Write-Host "  2. Frontend Watcher" -ForegroundColor Cyan
}
Write-Host ""

# Get current directory
$projectRoot = Get-Location

# 1. Start Backend (serves static + API)
Write-Host "[1/3] Starting Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot\backend'; `
     Write-Host ''; `
     Write-Host '========================================' -ForegroundColor Green; `
     Write-Host '  BACKEND PROD-DEV SERVER' -ForegroundColor Green; `
     Write-Host '========================================' -ForegroundColor Green; `
     Write-Host ''; `
     Write-Host 'Port: 3001' -ForegroundColor Cyan; `
     Write-Host 'Mode: Production build + Dev logging' -ForegroundColor Yellow; `
     Write-Host ''; `
     Write-Host 'Serving:' -ForegroundColor White; `
     Write-Host '  /api  -> Express API' -ForegroundColor Gray; `
     Write-Host '  /     -> Static (from ../frontend/dist/)' -ForegroundColor Gray; `
     Write-Host ''; `
     npm run dev"
)

Start-Sleep -Seconds 3

# 2. Start Frontend Watcher (rebuilds on changes)
Write-Host "[2/3] Starting Frontend Watcher..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot\frontend'; `
     Write-Host ''; `
     Write-Host '========================================' -ForegroundColor Green; `
     Write-Host '  FRONTEND WATCHER (PROD-DEV)' -ForegroundColor Green; `
     Write-Host '========================================' -ForegroundColor Green; `
     Write-Host ''; `
     Write-Host 'Mode: Production build + Watch' -ForegroundColor Cyan; `
     Write-Host 'Output: dist/' -ForegroundColor Cyan; `
     Write-Host ''; `
     Write-Host 'First build in progress...' -ForegroundColor Yellow; `
     Write-Host 'After that: watching for changes' -ForegroundColor Gray; `
     Write-Host ''; `
     Write-Host 'Changes will be picked up by backend automatically' -ForegroundColor Gray; `
     Write-Host 'Refresh browser/Telegram to see changes' -ForegroundColor Yellow; `
     Write-Host ''; `
     npm run build:prod-dev"
)

Start-Sleep -Seconds 2

# 3. Start ngrok (unless skipped)
if (-not $NoNgrok) {
    Write-Host "[3/3] Starting ngrok..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Write-Host ''; `
         Write-Host '========================================' -ForegroundColor Magenta; `
         Write-Host '  NGROK HTTPS TUNNEL' -ForegroundColor Magenta; `
         Write-Host '========================================' -ForegroundColor Magenta; `
         Write-Host ''; `
         Write-Host 'Port: 3001 (Backend)' -ForegroundColor Cyan; `
         Write-Host ''; `
         Write-Host '========================================' -ForegroundColor Yellow; `
         Write-Host '  IMPORTANT: COPY THE HTTPS URL BELOW' -ForegroundColor Yellow; `
         Write-Host '========================================' -ForegroundColor Yellow; `
         Write-Host ''; `
         ngrok http 3001"
    )
    
    Start-Sleep -Seconds 2
    
    # 4. Start URL updater in separate window
    Write-Host "[4/4] Starting URL updater..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "cd '$projectRoot'; `
         Write-Host ''; `
         Write-Host '========================================' -ForegroundColor Green; `
         Write-Host '  AUTOMATIC URL UPDATER' -ForegroundColor Green; `
         Write-Host '========================================' -ForegroundColor Green; `
         Write-Host ''; `
         Write-Host 'This will update .env files with ngrok URL' -ForegroundColor Cyan; `
         Write-Host ''; `
         .\update-urls.ps1"
    )
}

Start-Sleep -Seconds 1

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ALL SERVICES STARTED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

if (-not $NoNgrok) {
    Write-Host "PROD-DEV MODE ACTIVATED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Features:" -ForegroundColor Cyan
    Write-Host "  [OK] Production optimizations (minified, fast)" -ForegroundColor Green
    Write-Host "  [OK] Dev debugging (console.log, source maps)" -ForegroundColor Green
    Write-Host "  [OK] Auto-rebuild on file changes" -ForegroundColor Green
    Write-Host "  [OK] SKIP_TELEGRAM_VALIDATION enabled" -ForegroundColor Green
    Write-Host ""
    Write-Host "Window 5 (URL Updater) will guide you through:" -ForegroundColor Cyan
    Write-Host "  1. Paste ngrok URL" -ForegroundColor White
    Write-Host "  2. Auto-update .env files" -ForegroundColor White  
    Write-Host "  3. Auto-restart backend" -ForegroundColor White
    Write-Host ""
    Write-Host "Just copy the ngrok URL from window 4 and paste it in window 5!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "After that:" -ForegroundColor Cyan
    Write-Host "  -> Open @rocket_lunch_bot in Telegram" -ForegroundColor White
    Write-Host "  -> Press 'Menu' button" -ForegroundColor White
    Write-Host "  -> WebApp opens! Done!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "NGROK SKIPPED - Services running without HTTPS tunnel" -ForegroundColor Yellow
    Write-Host "WebApp will only work if WEBAPP_URL is already configured" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop all services: Close all terminal windows" -ForegroundColor Gray
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "  - PROD-DEV-MODE.md" -ForegroundColor Gray
Write-Host "  - QUICK_START_PROD_DEV.md" -ForegroundColor Gray
Write-Host ""

# Keep this window open
Write-Host "Press any key to close this window..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

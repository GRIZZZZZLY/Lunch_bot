# ========================================
# Telegram Food Bot - Dev Environment
# Starts ALL services in one command
# ========================================

param(
    [switch]$SkipChecks,
    [switch]$NoNgrok
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Telegram Food Bot - Dev Start" -ForegroundColor Cyan
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

# Setup development environment files
Write-Host "Setting up development environment..." -ForegroundColor Yellow

# Backend: Copy .env.development to .env
if (Test-Path "backend\.env") {
    Copy-Item "backend\.env" "backend\.env.backup" -Force
    Write-Host "  Backed up backend/.env" -ForegroundColor Gray
}
if (Test-Path "backend\.env.development") {
    Copy-Item "backend\.env.development" "backend\.env" -Force
    Write-Host "  Loaded backend/.env.development" -ForegroundColor Green
} else {
    Write-Host "  WARNING: backend/.env.development not found!" -ForegroundColor Yellow
}

# Frontend: Copy .env.development to .env (if exists)
if (Test-Path "frontend\.env") {
    Copy-Item "frontend\.env" "frontend\.env.backup" -Force
    Write-Host "  Backed up frontend/.env" -ForegroundColor Gray
}
if (Test-Path "frontend\.env.development") {
    Copy-Item "frontend\.env.development" "frontend\.env" -Force
    Write-Host "  Loaded frontend/.env.development" -ForegroundColor Green
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
Write-Host "  Starting Services..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
if (-not $NoNgrok) {
    Write-Host "5 terminal windows will open:" -ForegroundColor White
    Write-Host "  1. Backend (port 3001)" -ForegroundColor Cyan
    Write-Host "  2. Frontend (port 5173)" -ForegroundColor Cyan
    Write-Host "  3. Proxy (port 8080)" -ForegroundColor Cyan
    Write-Host "  4. ngrok (HTTPS tunnel)" -ForegroundColor Cyan
    Write-Host "  5. URL Updater (auto-config)" -ForegroundColor Green
} else {
    Write-Host "3 terminal windows will open:" -ForegroundColor White
    Write-Host "  1. Backend (port 3001)" -ForegroundColor Cyan
    Write-Host "  2. Frontend (port 5173)" -ForegroundColor Cyan
    Write-Host "  3. Proxy (port 8080)" -ForegroundColor Cyan
}
Write-Host ""

# Get current directory
$projectRoot = Get-Location

# 1. Start Backend
Write-Host "[1/4] Starting Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot\backend'; `
     Write-Host ''; `
     Write-Host '========================================' -ForegroundColor Green; `
     Write-Host '  BACKEND DEV SERVER' -ForegroundColor Green; `
     Write-Host '========================================' -ForegroundColor Green; `
     Write-Host ''; `
     Write-Host 'Port: 3001' -ForegroundColor Cyan; `
     Write-Host 'URL:  http://localhost:3001' -ForegroundColor Cyan; `
     Write-Host ''; `
     npm run dev"
)

Start-Sleep -Seconds 2

# 2. Start Frontend
Write-Host "[2/4] Starting Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot\frontend'; `
     Write-Host ''; `
     Write-Host '========================================' -ForegroundColor Green; `
     Write-Host '  FRONTEND DEV SERVER' -ForegroundColor Green; `
     Write-Host '========================================' -ForegroundColor Green; `
     Write-Host ''; `
     Write-Host 'Port: 5173' -ForegroundColor Cyan; `
     Write-Host 'URL:  http://localhost:5173' -ForegroundColor Cyan; `
     Write-Host ''; `
     npm run dev"
)

Start-Sleep -Seconds 3

# 3. Start Proxy
Write-Host "[3/4] Starting Proxy..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot'; `
     Write-Host ''; `
     Write-Host '========================================' -ForegroundColor Magenta; `
     Write-Host '  PROXY SERVER' -ForegroundColor Magenta; `
     Write-Host '========================================' -ForegroundColor Magenta; `
     Write-Host ''; `
     Write-Host 'Port: 8080' -ForegroundColor Cyan; `
     Write-Host 'URL:  http://localhost:8080' -ForegroundColor Cyan; `
     Write-Host ''; `
     Write-Host 'Routing:' -ForegroundColor Yellow; `
     Write-Host '  /     -> Frontend (5173)' -ForegroundColor Gray; `
     Write-Host '  /api  -> Backend (3001)' -ForegroundColor Gray; `
     Write-Host ''; `
     node proxy-server.js"
)

Start-Sleep -Seconds 2

# 4. Start ngrok (unless skipped)
if (-not $NoNgrok) {
    Write-Host "[4/4] Starting ngrok..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Write-Host ''; `
         Write-Host '========================================' -ForegroundColor Magenta; `
         Write-Host '  NGROK HTTPS TUNNEL' -ForegroundColor Magenta; `
         Write-Host '========================================' -ForegroundColor Magenta; `
         Write-Host ''; `
         Write-Host 'Port: 8080 (Proxy)' -ForegroundColor Cyan; `
         Write-Host ''; `
         Write-Host '========================================' -ForegroundColor Yellow; `
         Write-Host '  IMPORTANT: COPY THE HTTPS URL BELOW' -ForegroundColor Yellow; `
         Write-Host '========================================' -ForegroundColor Yellow; `
         Write-Host ''; `
         ngrok http 8080"
    )
    
    Start-Sleep -Seconds 2
    
    # 5. Start URL updater in separate window
    Write-Host "[5/5] Starting URL updater..." -ForegroundColor Yellow
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
    Write-Host "AUTOMATIC SETUP ACTIVATED!" -ForegroundColor Green
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
Write-Host "  - WEBAPP_QUICK_START.md" -ForegroundColor Gray
Write-Host "  - WEBAPP_SETUP.md" -ForegroundColor Gray
Write-Host "  - DEV_README.md" -ForegroundColor Gray
Write-Host ""

# Keep this window open
Write-Host "Press any key to close this window..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# ========================================
# Telegram Food Bot - Production Start
# Starts Backend + ngrok for production
# ========================================

param(
    [switch]$SkipChecks,
    [switch]$NoNgrok,
    [switch]$SkipBuild
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Telegram Food Bot - Production Start" -ForegroundColor Cyan
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
    "frontend\package.json"
)

foreach ($path in $requiredPaths) {
    if (-not (Test-Path $path)) {
        Write-Host "ERROR: $path not found!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "OK: All checks passed" -ForegroundColor Green
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
}

# Build backend (unless skipped)
if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  Building Backend..." -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    
    Set-Location backend
    npm run build
    $backendBuildResult = $LASTEXITCODE
    Set-Location ..
    
    if ($backendBuildResult -ne 0) {
        Write-Host ""
        Write-Host "ERROR: Backend build failed!" -ForegroundColor Red
        exit 1
    }
    
    if (-not (Test-Path "backend\dist\index.js")) {
        Write-Host "ERROR: Backend build output not found!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "OK: Backend built successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Skipping backend build..." -ForegroundColor Yellow
    if (-not (Test-Path "backend\dist\index.js")) {
        Write-Host "ERROR: No backend build found! Run without -SkipBuild first." -ForegroundColor Red
        exit 1
    }
}

# Build frontend (unless skipped)
if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  Building Frontend..." -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    
    Set-Location frontend
    npm run build
    $buildResult = $LASTEXITCODE
    Set-Location ..
    
    if ($buildResult -ne 0) {
        Write-Host ""
        Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red
        exit 1
    }
    
    if (-not (Test-Path "frontend\dist\index.html")) {
        Write-Host "ERROR: Frontend build output not found!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "OK: Frontend built successfully" -ForegroundColor Green
    
    # Show build size
    $distSize = (Get-ChildItem -Path "frontend\dist" -Recurse | Measure-Object -Property Length -Sum).Sum
    $distSizeMB = [math]::Round($distSize / 1MB, 2)
    Write-Host "Build size: $distSizeMB MB" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "Skipping frontend build..." -ForegroundColor Yellow
    if (-not (Test-Path "frontend\dist\index.html")) {
        Write-Host "WARNING: No frontend build found! Run without -SkipBuild first." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Starting Services..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

if (-not $NoNgrok) {
    Write-Host "3 terminal windows will open:" -ForegroundColor White
    Write-Host "  1. Backend (port 3001) - API + Static" -ForegroundColor Cyan
    Write-Host "  2. ngrok (HTTPS tunnel)" -ForegroundColor Cyan
    Write-Host "  3. URL Updater (auto-config)" -ForegroundColor Green
} else {
    Write-Host "1 terminal window will open:" -ForegroundColor White
    Write-Host "  1. Backend (port 3001) - API + Static" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "Architecture:" -ForegroundColor Yellow
Write-Host "  Telegram -> ngrok -> Backend:3001 -+- /api -> API" -ForegroundColor Gray
Write-Host "                                      +- /    -> Static (dist/)" -ForegroundColor Gray
Write-Host ""

# Get current directory
$projectRoot = Get-Location

# 1. Start Backend
Write-Host "[1/3] Starting Backend..." -ForegroundColor Yellow

$backendScript = @"
cd '$projectRoot\backend'
Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '  BACKEND PRODUCTION SERVER' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
Write-Host 'Port: 3001' -ForegroundColor Cyan
Write-Host 'API:  http://localhost:3001/api' -ForegroundColor Cyan
Write-Host 'Web:  http://localhost:3001/' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Serving:' -ForegroundColor Yellow
Write-Host '  /api  -> API endpoints' -ForegroundColor Gray
Write-Host '  /     -> Static files (dist/)' -ForegroundColor Gray
Write-Host ''
Write-Host '🔐 Loading production environment...' -ForegroundColor Yellow

# Backup current .env and use .env.production
if (Test-Path .env) {
    Copy-Item .env .env.backup -Force
    Write-Host '✅ Backed up .env to .env.backup' -ForegroundColor Gray
}
if (Test-Path .env.production) {
    Copy-Item .env.production .env -Force
    Write-Host '✅ Loaded .env.production' -ForegroundColor Green
} else {
    Write-Host '⚠️  WARNING: .env.production not found!' -ForegroundColor Yellow
}
Write-Host ''

`$env:NODE_ENV='production'
npm start
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript

Start-Sleep -Seconds 3

# 2. Start ngrok (unless skipped)
if (-not $NoNgrok) {
    Write-Host "[2/3] Starting ngrok..." -ForegroundColor Yellow
    
    $ngrokScript = @"
Write-Host ''
Write-Host '========================================' -ForegroundColor Magenta
Write-Host '  NGROK HTTPS TUNNEL' -ForegroundColor Magenta
Write-Host '========================================' -ForegroundColor Magenta
Write-Host ''
Write-Host 'Forwarding: Backend port 3001' -ForegroundColor Cyan
Write-Host ''
Write-Host '========================================' -ForegroundColor Yellow
Write-Host '  IMPORTANT: COPY THE HTTPS URL BELOW' -ForegroundColor Yellow
Write-Host '========================================' -ForegroundColor Yellow
Write-Host ''
ngrok http 3001
"@
    
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $ngrokScript
    
    Start-Sleep -Seconds 2
    
    # 3. Start URL updater in separate window
    Write-Host "[3/3] Starting URL updater..." -ForegroundColor Yellow
    
    $updaterScript = @"
cd '$projectRoot'
Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '  PRODUCTION URL UPDATER' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
Write-Host 'This will update .env files with ngrok URL' -ForegroundColor Cyan
Write-Host ''
.\update-urls-prod.ps1
"@
    
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $updaterScript
}

Start-Sleep -Seconds 1

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  PRODUCTION SERVICES STARTED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

if (-not $NoNgrok) {
    Write-Host "AUTOMATIC SETUP ACTIVATED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Window 3 (URL Updater) will guide you through:" -ForegroundColor Cyan
    Write-Host "  1. Paste ngrok URL" -ForegroundColor White
    Write-Host "  2. Auto-update .env files" -ForegroundColor White  
    Write-Host "  3. Auto-rebuild frontend" -ForegroundColor White
    Write-Host "  4. Auto-restart backend" -ForegroundColor White
    Write-Host ""
    Write-Host "Just copy the ngrok URL from window 2 and paste it in window 3!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "After that:" -ForegroundColor Cyan
    Write-Host "  -> Open @rocket_lunch_bot in Telegram" -ForegroundColor White
    Write-Host "  -> Press 'Menu' button" -ForegroundColor White
    Write-Host "  -> WebApp opens! Done!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "NGROK SKIPPED - Backend running on http://localhost:3001" -ForegroundColor Yellow
    Write-Host "WebApp will only work if WEBAPP_URL is already configured" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Production vs Development:" -ForegroundColor Yellow
Write-Host "  Production: Backend serves static files from frontend/dist/" -ForegroundColor Gray
Write-Host "  Development: Frontend dev server (5173) + Proxy (8080)" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop all services: Close all terminal windows" -ForegroundColor Gray
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "  - WEBAPP_QUICK_START.md" -ForegroundColor Gray
Write-Host "  - WEBAPP_SETUP.md" -ForegroundColor Gray
Write-Host ""

# Keep this window open
Write-Host "Press any key to close this window..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')

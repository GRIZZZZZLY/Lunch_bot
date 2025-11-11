# ========================================
# Telegram Food Bot - PROD-DEV Environment
# Production build with Dev conveniences
# ========================================

param(
    [switch]$SkipChecks,
    [switch]$NoNgrok,
    [switch]$SkipBuild
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
    "frontend\package.json"
)

foreach ($path in $requiredPaths) {
    if (-not (Test-Path $path)) {
        Write-Host "ERROR: $path not found!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "OK: Project structure valid" -ForegroundColor Green

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

}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Preparing Frontend..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# ИСПРАВЛЕНИЕ: Всегда пересобираем frontend для гарантии актуальности (если не пропущено)
if (-not $SkipBuild) {
    # Это занимает ~15-20 секунд, но предотвращает проблемы с устаревшими файлами
    Write-Host "Building frontend with prod-dev config..." -ForegroundColor Yellow
    Write-Host "(This ensures all files are up-to-date)" -ForegroundColor Gray
    Write-Host "(Use -SkipBuild to skip this step)" -ForegroundColor DarkGray
    Set-Location frontend

    # Запускаем сборку
    npm run build:prod-dev
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red
        Set-Location ..
        exit 1
    }

    Write-Host "OK: Frontend built successfully" -ForegroundColor Green
    Set-Location ..
} else {
    Write-Host "Skipping frontend build (-SkipBuild flag)" -ForegroundColor Yellow
    Write-Host "WARNING: Make sure frontend/dist is up-to-date!" -ForegroundColor Yellow

    # Проверяем что dist существует
    if (-not (Test-Path "frontend\dist")) {
        Write-Host "ERROR: frontend/dist not found! Cannot skip build." -ForegroundColor Red
        Write-Host "Run without -SkipBuild first" -ForegroundColor Red
        exit 1
    }

    Write-Host "OK: Using existing dist/" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Starting Services..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
if (-not $NoNgrok) {
    Write-Host "4 terminal windows will open:" -ForegroundColor White
    Write-Host "  1. Backend (port 3001) - serves API + static" -ForegroundColor Cyan
    Write-Host "  2. Frontend (watch mode) - auto-rebuilds on changes" -ForegroundColor Cyan
    Write-Host "  3. ngrok (HTTPS tunnel)" -ForegroundColor Cyan
    Write-Host "  4. URL Updater (auto-config)" -ForegroundColor Green
} else {
    Write-Host "2 terminal windows will open:" -ForegroundColor White
    Write-Host "  1. Backend (port 3001)" -ForegroundColor Cyan
    Write-Host "  2. Frontend (watch mode)" -ForegroundColor Cyan
}
Write-Host ""

# Get current directory
$projectRoot = Get-Location

# 1. Start Backend (serves static + API in watch mode)
Write-Host "[1/4] Starting Backend..." -ForegroundColor Yellow
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
     Write-Host 'Mode: tsx watch + PROD env' -ForegroundColor Yellow; `
     Write-Host ''; `
     Write-Host 'Serving:' -ForegroundColor White; `
     Write-Host '  /api  -> Express API' -ForegroundColor Gray; `
     Write-Host '  /     -> Static (from ../frontend/dist/)' -ForegroundColor Gray; `
     Write-Host ''; `
     Write-Host 'Starting backend watch mode...' -ForegroundColor Green; `
     Write-Host 'Backend will auto-restart on file changes' -ForegroundColor Yellow; `
     Write-Host ''; `
     npm run dev"
)

Start-Sleep -Seconds 3

# 2. Start Frontend Watch Mode
Write-Host "[2/4] Starting Frontend watch mode..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot\frontend'; `
     Write-Host ''; `
     Write-Host '========================================' -ForegroundColor Green; `
     Write-Host '  FRONTEND PROD-DEV WATCH' -ForegroundColor Green; `
     Write-Host '========================================' -ForegroundColor Green; `
     Write-Host ''; `
     Write-Host 'Output: dist/' -ForegroundColor Cyan; `
     Write-Host 'Mode: Production build with watch' -ForegroundColor Yellow; `
     Write-Host ''; `
     Write-Host 'Features:' -ForegroundColor White; `
     Write-Host '  Auto-rebuild on file changes' -ForegroundColor Gray; `
     Write-Host '  Console.log preserved' -ForegroundColor Gray; `
     Write-Host '  Source maps enabled' -ForegroundColor Gray; `
     Write-Host ''; `
     Write-Host 'Watching for changes...' -ForegroundColor Green; `
     Write-Host 'Frontend will auto-rebuild on file changes' -ForegroundColor Yellow; `
     Write-Host ''; `
     npm run build:prod-dev"
)

Start-Sleep -Seconds 2  # Wait for frontend to start

# 3. Start ngrok (unless skipped)
if (-not $NoNgrok) {
    Write-Host "[3/4] Starting ngrok..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Write-Host ''; `
         Write-Host '========================================' -ForegroundColor Magenta; `
         Write-Host '  NGROK HTTPS TUNNEL' -ForegroundColor Magenta; `
         Write-Host '========================================' -ForegroundColor Magenta; `
         Write-Host ''; `
         Write-Host 'Tunneling: Backend on port 3001' -ForegroundColor Cyan; `
         Write-Host 'Backend serves: API + Static files' -ForegroundColor Gray; `
         Write-Host ''; `
         Write-Host '========================================' -ForegroundColor Yellow; `
         Write-Host '  COPY THE HTTPS URL BELOW!' -ForegroundColor Yellow; `
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
    Write-Host "Architecture:" -ForegroundColor Cyan
    Write-Host "  [Backend] Serves API + static files on port 3001" -ForegroundColor White
    Write-Host "  [Frontend] Production build in dist/ with watch mode" -ForegroundColor White
    Write-Host "  [ngrok] Tunnels backend:3001 to HTTPS" -ForegroundColor White
    Write-Host ""
    Write-Host "Features:" -ForegroundColor Cyan
    Write-Host "  ✅ Production build (esbuild minify + source maps)" -ForegroundColor Green
    Write-Host "  ✅ Dev debugging (console.log preserved)" -ForegroundColor Green
    Write-Host "  ✅ Auto-rebuild on file changes (watch mode)" -ForegroundColor Green
    Write-Host "  ✅ SKIP_TELEGRAM_VALIDATION enabled" -ForegroundColor Green
    Write-Host ""
    Write-Host "Watch mode active:" -ForegroundColor Cyan
    Write-Host "  Frontend auto-rebuilds on changes to:" -ForegroundColor White
    Write-Host "  - src/**/*.tsx, src/**/*.ts" -ForegroundColor Gray
    Write-Host "  - tailwind.config.js" -ForegroundColor Gray
    Write-Host "  - vite.config.ts" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Window 4 (URL Updater) will guide you:" -ForegroundColor Cyan
    Write-Host "  1. Paste ngrok URL from window 3" -ForegroundColor White
    Write-Host "  2. Auto-update .env files" -ForegroundColor White
    Write-Host "  3. Auto-restart backend" -ForegroundColor White
    Write-Host ""
    Write-Host "After setup:" -ForegroundColor Cyan
    Write-Host "  -> Open @rocket_lunch_bot in Telegram" -ForegroundColor White
    Write-Host "  -> Press 'Menu' button" -ForegroundColor White
    Write-Host "  -> WebApp loads! Ready!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "NGROK SKIPPED - Backend running on port 3001" -ForegroundColor Yellow
    Write-Host "Configure WEBAPP_URL in .env manually" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Features:" -ForegroundColor Cyan
    Write-Host "  ✅ Production build (esbuild minify + source maps)" -ForegroundColor Green
    Write-Host "  ✅ Dev debugging (console.log preserved)" -ForegroundColor Green
    Write-Host "  ✅ Auto-rebuild on file changes (watch mode)" -ForegroundColor Green
    Write-Host "  ✅ Backend auto-restarts on changes" -ForegroundColor Green
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

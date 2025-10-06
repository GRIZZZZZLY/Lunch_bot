# ========================================
# Start Production Build (with ngrok)
# ========================================

param(
    [switch]$NoBuild,
    [switch]$NoNgrok
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Production Mode Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if builds exist
if (-not $NoBuild) {
    if (-not (Test-Path "frontend\dist\index.html") -or -not (Test-Path "backend\dist\index.js")) {
        Write-Host "WARNING: Build files not found!" -ForegroundColor Yellow
        Write-Host "Running build first..." -ForegroundColor Yellow
        Write-Host ""
        
        .\build-all.ps1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Build failed! Cannot start production." -ForegroundColor Red
            exit 1
        }
    }
}

# Check for required tools
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not installed!" -ForegroundColor Red
    exit 1
}

if (-not $NoNgrok -and -not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "WARNING: ngrok not installed!" -ForegroundColor Yellow
    Write-Host "Install: winget install ngrok" -ForegroundColor Yellow
    Write-Host "Or run with -NoNgrok flag" -ForegroundColor Yellow
    exit 1
}

# Install serve if not present
if (-not (Test-Path "node_modules\.bin\serve.ps1") -and -not (Test-Path "node_modules\.bin\serve")) {
    Write-Host "Installing 'serve' for static file serving..." -ForegroundColor Yellow
    npm install --save-dev serve
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Starting Services (PRODUCTION)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

if (-not $NoNgrok) {
    Write-Host "5 terminal windows will open:" -ForegroundColor White
} else {
    Write-Host "3 terminal windows will open:" -ForegroundColor White
}

Write-Host "  1. Backend PRODUCTION (port 3001)" -ForegroundColor Cyan
Write-Host "  2. Frontend STATIC (port 5173)" -ForegroundColor Cyan
Write-Host "  3. Proxy (port 8080)" -ForegroundColor Cyan
if (-not $NoNgrok) {
    Write-Host "  4. ngrok (HTTPS tunnel)" -ForegroundColor Cyan
    Write-Host "  5. URL Updater (auto-config)" -ForegroundColor Green
}
Write-Host ""

$projectRoot = Get-Location

# Create production .env for backend if not exists
if (-not (Test-Path "backend\.env.production")) {
    Write-Host "Creating backend/.env.production..." -ForegroundColor Yellow
    
    $prodEnv = Get-Content "backend\.env" -Raw
    $prodEnv = $prodEnv -replace 'NODE_ENV=development', 'NODE_ENV=production'
    $prodEnv = $prodEnv -replace 'SKIP_TELEGRAM_VALIDATION=true', 'SKIP_TELEGRAM_VALIDATION=false'
    $prodEnv = $prodEnv -replace 'LOG_LEVEL=debug', 'LOG_LEVEL=info'
    
    Set-Content "backend\.env.production" -Value $prodEnv
    Write-Host "  Created (based on .env)" -ForegroundColor Green
}

# 1. Start Backend PRODUCTION
Write-Host "[1/4] Starting Backend (PRODUCTION)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot\backend'; `
     Write-Host ''; `
     Write-Host '========================================' -ForegroundColor Red; `
     Write-Host '  BACKEND PRODUCTION MODE' -ForegroundColor Red; `
     Write-Host '========================================' -ForegroundColor Red; `
     Write-Host ''; `
     Write-Host 'Port: 3001' -ForegroundColor Cyan; `
     Write-Host 'Mode: PRODUCTION' -ForegroundColor Yellow; `
     Write-Host ''; `
     `$env:NODE_ENV='production'; `
     node dist/index.js"
)

Start-Sleep -Seconds 3

# 2. Start Frontend STATIC
Write-Host "[2/4] Starting Frontend (STATIC)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot\frontend'; `
     Write-Host ''; `
     Write-Host '========================================' -ForegroundColor Red; `
     Write-Host '  FRONTEND STATIC SERVER' -ForegroundColor Red; `
     Write-Host '========================================' -ForegroundColor Red; `
     Write-Host ''; `
     Write-Host 'Port: 5173' -ForegroundColor Cyan; `
     Write-Host 'Serving: dist/' -ForegroundColor Yellow; `
     Write-Host ''; `
     npx serve -s dist -p 5173"
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
     Write-Host 'Backend: 3001 (production)' -ForegroundColor Yellow; `
     Write-Host 'Frontend: 5173 (static)' -ForegroundColor Yellow; `
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
         Write-Host 'Mode: PRODUCTION' -ForegroundColor Red; `
         Write-Host 'Port: 8080 (Proxy)' -ForegroundColor Cyan; `
         Write-Host ''; `
         Write-Host '========================================' -ForegroundColor Yellow; `
         Write-Host '  IMPORTANT: COPY THE HTTPS URL BELOW' -ForegroundColor Yellow; `
         Write-Host '========================================' -ForegroundColor Yellow; `
         Write-Host ''; `
         ngrok http 8080"
    )
    
    Start-Sleep -Seconds 2
    
    # 5. Start URL updater
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
Write-Host "  PRODUCTION MODE STARTED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "IMPORTANT DIFFERENCES:" -ForegroundColor Yellow
Write-Host "  Frontend: Static build (no hot reload)" -ForegroundColor White
Write-Host "  Backend: Compiled JS (faster)" -ForegroundColor White
Write-Host "  Security: All validations ENABLED" -ForegroundColor White
Write-Host "  Performance: 10-20x faster load times" -ForegroundColor Green
Write-Host ""

if (-not $NoNgrok) {
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Copy ngrok URL from window 4" -ForegroundColor White
    Write-Host "  2. Paste in window 5 (URL Updater)" -ForegroundColor White
    Write-Host "  3. Open @rocket_lunch_bot in Telegram" -ForegroundColor White
    Write-Host "  4. Test Menu button" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "NGROK SKIPPED - Configure WEBAPP_URL manually" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "To rebuild:" -ForegroundColor Cyan
Write-Host "  .\build-all.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop all services: Close all terminal windows" -ForegroundColor Gray
Write-Host ""

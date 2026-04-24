# ========================================
# Telegram Food Bot - Production Start
# Starts Backend + ngrok (static domain)
# ========================================

param(
    [switch]$SkipChecks,
    [switch]$NoNgrok,
    [switch]$SkipBuild
)

# ========================================
# STATIC NGROK DOMAIN - never changes!
# ========================================
$NGROK_DOMAIN = "unprying-marita-nonvacantly.ngrok-free.dev"
$NGROK_URL    = "https://$NGROK_DOMAIN"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Telegram Food Bot - Production Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Static ngrok domain: $NGROK_URL" -ForegroundColor Green
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
        Write-Host "Or run with -NoNgrok to skip ngrok" -ForegroundColor Yellow
        exit 1
    }
}

# Check project structure
foreach ($path in @("backend\package.json", "frontend\package.json")) {
    if (-not (Test-Path $path)) {
        Write-Host "ERROR: $path not found!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "OK: All checks passed" -ForegroundColor Green
Write-Host ""

# Install dependencies if needed
if (-not $SkipChecks) {
    if (-not (Test-Path "backend\node_modules")) {
        Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
        Set-Location backend; npm install; Set-Location ..
    }
    if (-not (Test-Path "frontend\node_modules")) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
        Set-Location frontend; npm install; Set-Location ..
    }
}

# Build backend
if (-not $SkipBuild) {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  Building Backend..." -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Set-Location backend
    npm run build
    $buildOk = $LASTEXITCODE
    Set-Location ..
    if ($buildOk -ne 0) { Write-Host "ERROR: Backend build failed!" -ForegroundColor Red; exit 1 }
    Write-Host "OK: Backend built" -ForegroundColor Green
    Write-Host ""
} else {
    if (-not (Test-Path "backend\dist\index.js")) {
        Write-Host "ERROR: No backend build found! Run without -SkipBuild first." -ForegroundColor Red; exit 1
    }
    Write-Host "Skipping backend build..." -ForegroundColor Yellow
}

# Build frontend
if (-not $SkipBuild) {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  Building Frontend..." -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Set-Location frontend
    npm run build
    $buildOk = $LASTEXITCODE
    Set-Location ..
    if ($buildOk -ne 0) { Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red; exit 1 }
    $distSize = [math]::Round((Get-ChildItem "frontend\dist" -Recurse | Measure-Object Length -Sum).Sum / 1MB, 2)
    Write-Host "OK: Frontend built ($distSize MB)" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Skipping frontend build..." -ForegroundColor Yellow
}

$projectRoot = Get-Location

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Starting Services..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 1. Start Backend
Write-Host "[1/2] Starting Backend..." -ForegroundColor Yellow

$backendScript = @"
cd '$projectRoot\backend'
Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '  BACKEND SERVER (port 3001)' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
`$env:NODE_ENV='production'
node dist/index.js
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript
Start-Sleep -Seconds 3

# 2. Start ngrok with static domain
if (-not $NoNgrok) {
    Write-Host "[2/2] Starting ngrok (static domain)..." -ForegroundColor Yellow

    $ngrokScript = @"
Write-Host ''
Write-Host '========================================' -ForegroundColor Magenta
Write-Host '  NGROK - STATIC DOMAIN' -ForegroundColor Magenta
Write-Host '========================================' -ForegroundColor Magenta
Write-Host ''
Write-Host 'Domain: https://$NGROK_DOMAIN' -ForegroundColor Green
Write-Host 'Target: http://localhost:3001' -ForegroundColor Cyan
Write-Host ''
Write-Host 'URL never changes - no reconfiguration needed!' -ForegroundColor Green
Write-Host ''
ngrok http --domain=$NGROK_DOMAIN 3001
"@

    Start-Process powershell -ArgumentList "-NoExit", "-Command", $ngrokScript
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ALL SERVICES STARTED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Static URL (never changes):" -ForegroundColor Yellow
Write-Host "  $NGROK_URL" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Open @rocket_lunch_bot in Telegram" -ForegroundColor White
Write-Host "  2. Press 'Menu' button" -ForegroundColor White
Write-Host "  3. WebApp should open!" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to close this window..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')

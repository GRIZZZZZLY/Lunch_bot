# ========================================
# Rocket Lunch - DEV (new redesigned frontend)
# Runs the parallel frontend-new/ on port 5174
# Does NOT touch the original frontend/
# ========================================

param(
    [switch]$SkipBackend,   # skip starting the backend (assumes it's already up)
    [switch]$InstallDeps    # run npm install in frontend-new/ first
)

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Rocket Lunch - DEV (new frontend)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not installed" -ForegroundColor Red
    exit 1
}

# Verify paths
$required = @("frontend-new\package.json", "backend\package.json")
foreach ($p in $required) {
    if (-not (Test-Path $p)) {
        Write-Host "ERROR: $p not found. Run from repo root (telegram-food-bot/)." -ForegroundColor Red
        exit 1
    }
}

# Install deps for frontend-new if requested or missing
if ($InstallDeps -or -not (Test-Path "frontend-new\node_modules")) {
    Write-Host "Installing frontend-new dependencies..." -ForegroundColor Yellow
    Push-Location "frontend-new"
    npm install
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Host "ERROR: npm install failed" -ForegroundColor Red
        exit 1
    }
    Pop-Location
    Write-Host "OK: dependencies installed" -ForegroundColor Green
}

# Prepare backend env for dev
if (-not $SkipBackend) {
    if (Test-Path "backend\.env.development") {
        Copy-Item "backend\.env.development" "backend\.env" -Force
        Write-Host "Loaded backend/.env.development" -ForegroundColor Green
    } else {
        Write-Host "WARNING: backend/.env.development not found. Using existing backend/.env" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Launching services..." -ForegroundColor Yellow

# 1. Backend (unless skipped)
if (-not $SkipBackend) {
    Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$PWD\backend'; Write-Host 'BACKEND :: :3001' -ForegroundColor Cyan; npm run dev"
    Write-Host "  [ok] backend  → http://localhost:3001" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "  [skip] backend (assumed running)" -ForegroundColor Gray
}

# 2. Frontend-new on port 5174
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$PWD\frontend-new'; Write-Host 'FRONTEND-NEW :: :5174' -ForegroundColor Magenta; npm run dev"
Write-Host "  [ok] frontend-new → http://localhost:5174" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Ready" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  New UI:      http://localhost:5174" -ForegroundColor White
Write-Host "  Backend API: http://localhost:3001/api" -ForegroundColor Gray
Write-Host ""
Write-Host "  Old frontend is untouched. Run .\start-dev.ps1 if you want it on 5173." -ForegroundColor Gray
Write-Host ""

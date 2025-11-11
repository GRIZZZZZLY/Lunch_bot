# ========================================
# Telegram Food Bot - LOCAL PRODUCTION TEST
# Тестирование production сборки локально
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LOCAL PRODUCTION TEST MODE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not installed!" -ForegroundColor Red
    exit 1
}

# Setup PRODUCTION environment files
Write-Host "Setting up PRODUCTION environment..." -ForegroundColor Yellow

# Backend: Copy .env.production to .env
if (Test-Path "backend\.env") {
    Copy-Item "backend\.env" "backend\.env.backup" -Force
    Write-Host "  Backed up backend/.env" -ForegroundColor Gray
}
if (Test-Path "backend\.env.production") {
    Copy-Item "backend\.env.production" "backend\.env" -Force
    Write-Host "  Loaded backend/.env.production" -ForegroundColor Green
} else {
    Write-Host "  WARNING: backend/.env.production not found!" -ForegroundColor Yellow
}

# Frontend: Copy .env.production to .env
if (Test-Path "frontend\.env") {
    Copy-Item "frontend\.env" "frontend\.env.backup" -Force
    Write-Host "  Backed up frontend/.env" -ForegroundColor Gray
}
if (Test-Path "frontend\.env.production") {
    Copy-Item "frontend\.env.production" "frontend\.env" -Force
    Write-Host "  Loaded frontend/.env.production" -ForegroundColor Green
} else {
    Write-Host "  Using existing frontend/.env" -ForegroundColor Gray
}

Write-Host ""

# Build Frontend (production)
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Building Frontend (Production)..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Set-Location frontend

Write-Host "Cleaning dist/..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}

Write-Host "Building with vite.config.ts (production)..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host ""
Write-Host "OK: Frontend built successfully" -ForegroundColor Green
Set-Location ..

# Build Backend (production)
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Building Backend (Production)..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Set-Location backend
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Backend build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host ""
Write-Host "OK: Backend built successfully" -ForegroundColor Green
Set-Location ..

# Start Backend (serves static from frontend/dist)
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Starting Backend Server..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$projectRoot = Get-Location

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot\backend'; `
     Write-Host ''; `
     Write-Host '========================================' -ForegroundColor Green; `
     Write-Host '  PRODUCTION SERVER (LOCAL TEST)' -ForegroundColor Green; `
     Write-Host '========================================' -ForegroundColor Green; `
     Write-Host ''; `
     Write-Host 'Mode: PRODUCTION' -ForegroundColor Cyan; `
     Write-Host 'Port: 3001' -ForegroundColor Cyan; `
     Write-Host ''; `
     Write-Host 'Serving:' -ForegroundColor White; `
     Write-Host '  /api  -> Express API' -ForegroundColor Gray; `
     Write-Host '  /     -> Static (from ../frontend/dist/)' -ForegroundColor Gray; `
     Write-Host ''; `
     Write-Host 'Console.log удалены, source maps отключены' -ForegroundColor Yellow; `
     Write-Host ''; `
     Write-Host 'Откройте: http://localhost:3001' -ForegroundColor Cyan; `
     Write-Host ''; `
     npm start"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SERVER STARTED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Откройте в браузере:" -ForegroundColor Cyan
Write-Host "  http://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host "Для остановки: закройте окно backend" -ForegroundColor Gray
Write-Host ""
Write-Host "ВАЖНО: Это production сборка:" -ForegroundColor Yellow
Write-Host "  - Код минифицирован" -ForegroundColor Gray
Write-Host "  - console.log удалены" -ForegroundColor Gray
Write-Host "  - Source maps отключены" -ForegroundColor Gray
Write-Host "  - Максимальная оптимизация" -ForegroundColor Gray
Write-Host ""
Write-Host "Для отладки используйте: start-dev.ps1 или start-prod-dev-NEW.ps1" -ForegroundColor Gray
Write-Host ""

# Keep this window open
Write-Host "Press any key to close this window..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Dev Start with Proxy + Single ngrok
# Starts backend, frontend, proxy and ONE ngrok tunnel

Write-Host "=== Starting Telegram Food Bot with Proxy ===" -ForegroundColor Cyan
Write-Host ""

# Check ngrok
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: ngrok not installed!" -ForegroundColor Red
    Write-Host "Install: winget install ngrok" -ForegroundColor Yellow
    Write-Host "Or download: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK: ngrok installed" -ForegroundColor Green

# Check node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not installed!" -ForegroundColor Red
    exit 1
}

Write-Host "OK: Node.js installed" -ForegroundColor Green

# Check files
if (-not (Test-Path "backend\package.json")) {
    Write-Host "ERROR: Backend not found!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "frontend\package.json")) {
    Write-Host "ERROR: Frontend not found!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "proxy-server.js")) {
    Write-Host "ERROR: proxy-server.js not found!" -ForegroundColor Red
    exit 1
}

Write-Host "OK: All files found" -ForegroundColor Green
Write-Host ""

# Check dependencies
Write-Host "Checking dependencies..." -ForegroundColor Cyan

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

# Check http-proxy
Write-Host "Checking http-proxy..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules\http-proxy")) {
    Write-Host "Installing http-proxy..." -ForegroundColor Yellow
    npm install http-proxy
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  PROXY MODE (RECOMMENDED)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  4 terminal windows will open:" -ForegroundColor White
Write-Host ""
Write-Host "  1. Backend Dev Server (port 3001)" -ForegroundColor White
Write-Host "  2. Frontend Dev Server (port 5173)" -ForegroundColor White
Write-Host "  3. Proxy Server (port 8080) - routing" -ForegroundColor White
Write-Host "  4. ngrok (ONE tunnel for everything!)" -ForegroundColor White
Write-Host ""
Write-Host "  EASIER: Only ONE URL to configure!" -ForegroundColor Green
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "AFTER LAUNCH:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Copy HTTPS URL from ngrok window" -ForegroundColor White
Write-Host "   Example: https://abc123.ngrok-free.app" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Update .env files with ONE URL:" -ForegroundColor White
Write-Host ""
Write-Host "   backend\.env:" -ForegroundColor Yellow
Write-Host "   WEBAPP_URL=https://YOUR_NGROK_URL" -ForegroundColor Gray
Write-Host "   CORS_ORIGIN=http://localhost:5173,https://YOUR_NGROK_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "   frontend\.env:" -ForegroundColor Yellow
Write-Host "   VITE_API_URL=https://YOUR_NGROK_URL/api" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Restart Backend (Ctrl+C in window 1, then npm run dev)" -ForegroundColor White
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$continue = Read-Host "Continue? (Y/n)"
if ($continue -eq "n" -or $continue -eq "N") {
    Write-Host "Cancelled" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "Starting services..." -ForegroundColor Green
Write-Host ""

# Start Backend
Write-Host "1. Starting Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host 'Backend Dev Server' -ForegroundColor Green; Write-Host 'http://localhost:3001' -ForegroundColor Cyan; Write-Host ''; npm run dev"

Start-Sleep -Seconds 2

# Start Frontend
Write-Host "2. Starting Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; Write-Host 'Frontend Dev Server' -ForegroundColor Green; Write-Host 'http://localhost:5173' -ForegroundColor Cyan; Write-Host ''; npm run dev"

Start-Sleep -Seconds 3

# Start Proxy
Write-Host "3. Starting Proxy Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host 'Proxy Server' -ForegroundColor Magenta; Write-Host 'http://localhost:8080' -ForegroundColor Cyan; Write-Host ''; Write-Host 'Routing:' -ForegroundColor Yellow; Write-Host '  / -> Frontend (5173)' -ForegroundColor Gray; Write-Host '  /api -> Backend (3001)' -ForegroundColor Gray; Write-Host ''; node proxy-server.js"

Start-Sleep -Seconds 2

# Start ngrok
Write-Host "4. Starting ngrok..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'ngrok Tunnel' -ForegroundColor Magenta; Write-Host ''; Write-Host '========================================' -ForegroundColor Cyan; Write-Host 'COPY THIS URL:' -ForegroundColor Yellow; Write-Host '========================================' -ForegroundColor Cyan; Write-Host ''; ngrok http 8080; Write-Host ''; Write-Host '========================================' -ForegroundColor Cyan; Write-Host 'Update .env files with this URL' -ForegroundColor Yellow; Write-Host '========================================' -ForegroundColor Cyan"

Write-Host ""
Write-Host "All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Find ngrok URL in last window (https://xxx.ngrok-free.app)" -ForegroundColor White
Write-Host "  2. Update backend\.env:" -ForegroundColor White
Write-Host "     WEBAPP_URL=https://xxx.ngrok-free.app" -ForegroundColor Gray
Write-Host "     CORS_ORIGIN=...,https://xxx.ngrok-free.app" -ForegroundColor Gray
Write-Host "  3. Update frontend\.env:" -ForegroundColor White
Write-Host "     VITE_API_URL=https://xxx.ngrok-free.app/api" -ForegroundColor Gray
Write-Host "  4. Restart Backend (window 1: Ctrl+C, then npm run dev)" -ForegroundColor White
Write-Host "  5. Open bot in Telegram and press Menu Button!" -ForegroundColor White
Write-Host ""
Write-Host "Documentation: WEBAPP_QUICK_START.md" -ForegroundColor Cyan
Write-Host ""

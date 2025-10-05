# Dev Start with Two ngrok Tunnels
# Starts backend, frontend and TWO separate ngrok tunnels

Write-Host "=== Starting Telegram Food Bot with Two Tunnels ===" -ForegroundColor Cyan
Write-Host ""

# Check ngrok
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: ngrok not installed!" -ForegroundColor Red
    Write-Host "Install: winget install ngrok" -ForegroundColor Yellow
    Write-Host "Or download: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK: ngrok installed" -ForegroundColor Green

# Check files
if (-not (Test-Path "backend\package.json")) {
    Write-Host "ERROR: Backend not found!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "frontend\package.json")) {
    Write-Host "ERROR: Frontend not found!" -ForegroundColor Red
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

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  TWO TUNNELS MODE" -ForegroundColor Yellow
Write-Host ""
Write-Host "  4 terminal windows will open:" -ForegroundColor White
Write-Host ""
Write-Host "  1. Backend Dev Server (port 3001)" -ForegroundColor White
Write-Host "  2. Frontend Dev Server (port 5173)" -ForegroundColor White
Write-Host "  3. ngrok for Backend (HTTPS tunnel)" -ForegroundColor White
Write-Host "  4. ngrok for Frontend (HTTPS tunnel)" -ForegroundColor White
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "AFTER LAUNCH:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Copy HTTPS URL from Frontend ngrok window" -ForegroundColor White
Write-Host "   Example: https://abc123.ngrok-free.app" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Copy HTTPS URL from Backend ngrok window" -ForegroundColor White
Write-Host "   Example: https://xyz789.ngrok-free.app" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Update .env files:" -ForegroundColor White
Write-Host ""
Write-Host "   backend\.env:" -ForegroundColor Yellow
Write-Host "   WEBAPP_URL=https://FRONTEND_URL" -ForegroundColor Gray
Write-Host "   CORS_ORIGIN=http://localhost:5173,https://FRONTEND_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "   frontend\.env:" -ForegroundColor Yellow
Write-Host "   VITE_API_URL=https://BACKEND_URL/api" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Restart Backend (Ctrl+C in window 1, then npm run dev)" -ForegroundColor White
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
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host 'Backend Dev Server' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 2

# Start Frontend
Write-Host "2. Starting Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; Write-Host 'Frontend Dev Server' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 3

# Start ngrok for Backend
Write-Host "3. Starting ngrok for Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'ngrok Backend Tunnel' -ForegroundColor Magenta; Write-Host ''; Write-Host 'Copy HTTPS URL and update backend\.env:' -ForegroundColor Yellow; Write-Host 'WEBAPP_URL and CORS_ORIGIN' -ForegroundColor Yellow; Write-Host ''; ngrok http 3001"

Start-Sleep -Seconds 2

# Start ngrok for Frontend
Write-Host "4. Starting ngrok for Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'ngrok Frontend Tunnel' -ForegroundColor Magenta; Write-Host ''; Write-Host 'Copy HTTPS URL and update:' -ForegroundColor Yellow; Write-Host '1. backend\.env -> WEBAPP_URL' -ForegroundColor Yellow; Write-Host '2. backend\.env -> CORS_ORIGIN' -ForegroundColor Yellow; Write-Host '3. frontend\.env -> VITE_API_URL' -ForegroundColor Yellow; Write-Host ''; ngrok http 5173"

Write-Host ""
Write-Host "All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Find ngrok URLs in windows 3 and 4" -ForegroundColor White
Write-Host "  2. Update .env files (see WEBAPP_SETUP.md)" -ForegroundColor White
Write-Host "  3. Restart Backend" -ForegroundColor White
Write-Host "  4. Open bot in Telegram" -ForegroundColor White
Write-Host ""
Write-Host "Documentation: WEBAPP_QUICK_START.md" -ForegroundColor Cyan
Write-Host ""

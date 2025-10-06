# ========================================
# Restart Proxy Server
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Restart Proxy Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Stopping proxy server..." -ForegroundColor Yellow

# Find and kill node process running proxy-server.js
Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "proxy-server" -or
    $_.MainWindowTitle -match "proxy"
} | Stop-Process -Force

Start-Sleep -Seconds 2

Write-Host "Starting proxy server..." -ForegroundColor Yellow
Write-Host ""

$projectRoot = Get-Location

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot'; Write-Host ''; Write-Host '========================================' -ForegroundColor Magenta; Write-Host '  PROXY SERVER (RESTARTED)' -ForegroundColor Magenta; Write-Host '========================================' -ForegroundColor Magenta; Write-Host ''; node proxy-server.js"
)

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Proxy restarted!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Test proxy
Write-Host "Testing proxy connection..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $test = Invoke-WebRequest -Uri "http://localhost:8080/api/health" -Method Get -TimeoutSec 5 -UseBasicParsing
    Write-Host "  Status: OK ($($test.StatusCode))" -ForegroundColor Green
    Write-Host ""
    Write-Host "SUCCESS! Proxy is working" -ForegroundColor Green
} catch {
    Write-Host "  Status: FAILED" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "WARNING: Check proxy window for errors" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Proxy routes:" -ForegroundColor Cyan
Write-Host "  http://localhost:8080       -> Frontend (5173)" -ForegroundColor Gray
Write-Host "  http://localhost:8080/api   -> Backend (3001)" -ForegroundColor Gray
Write-Host ""

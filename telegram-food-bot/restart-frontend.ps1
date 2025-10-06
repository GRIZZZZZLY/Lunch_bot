# ========================================
# Restart Frontend Dev Server
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Restart Frontend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Stopping all node processes (frontend)..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -match "frontend" -or 
    $_.Path -match "frontend"
} | Stop-Process -Force

Start-Sleep -Seconds 2

Write-Host "Current frontend .env variables:" -ForegroundColor Yellow
Get-Content "frontend\.env" | Where-Object { $_ -match '^VITE_' } | ForEach-Object {
    Write-Host "  $_" -ForegroundColor Gray
}
Write-Host ""

Write-Host "Starting frontend dev server..." -ForegroundColor Yellow
Write-Host ""

$projectRoot = Get-Location

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot\frontend'; Write-Host ''; Write-Host '========================================' -ForegroundColor Green; Write-Host '  FRONTEND DEV SERVER (RESTARTED)' -ForegroundColor Green; Write-Host '========================================' -ForegroundColor Green; Write-Host ''; Write-Host 'Port: 5173' -ForegroundColor Cyan; Write-Host 'URL:  http://localhost:5173' -ForegroundColor Cyan; Write-Host ''; npm run dev"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Frontend restarted!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Check that VITE_USE_MOCK_API=false is shown above" -ForegroundColor Yellow
Write-Host ""

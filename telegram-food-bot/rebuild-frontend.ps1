# ========================================
# Rebuild Frontend Only
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Rebuild Frontend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Push-Location frontend

# Clean
Write-Host "Cleaning old build..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}

# Rebuild
Write-Host "Building frontend..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Frontend rebuilt!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Show size
$distSize = (Get-ChildItem -Path "frontend\dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Bundle size: $($distSize.ToString('0.00')) MB" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Find frontend window (static server)" -ForegroundColor White
Write-Host "  2. Press Ctrl+C to stop" -ForegroundColor White
Write-Host "  3. Run: npx serve -s dist -p 5173" -ForegroundColor White
Write-Host ""

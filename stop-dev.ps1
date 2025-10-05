# ========================================
# Stop ALL Dev Services
# Kills node and ngrok processes
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  Stopping ALL Dev Services" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

# Stop all node processes
Write-Host "Stopping Node.js processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "Stopped $($nodeProcesses.Count) Node.js process(es)" -ForegroundColor Green
} else {
    Write-Host "No Node.js processes found" -ForegroundColor Gray
}

# Also kill any process on port 3001 specifically
Write-Host "Checking port 3001..." -ForegroundColor Yellow
$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($port3001) {
    $port3001 | ForEach-Object {
        $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $proc.Id -Force
            Write-Host "Freed port 3001 (killed PID $($proc.Id))" -ForegroundColor Green
        }
    }
}

# Stop all ngrok processes
Write-Host "Stopping ngrok processes..." -ForegroundColor Yellow
$ngrokProcesses = Get-Process -Name ngrok -ErrorAction SilentlyContinue
if ($ngrokProcesses) {
    $ngrokProcesses | Stop-Process -Force
    Write-Host "Stopped $($ngrokProcesses.Count) ngrok process(es)" -ForegroundColor Green
} else {
    Write-Host "No ngrok processes found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ALL SERVICES STOPPED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "You can now restart with: .\start-dev.ps1" -ForegroundColor Cyan
Write-Host ""

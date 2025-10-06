# ========================================
# Check Running Services
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Service Status Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if processes are running
Write-Host "Checking processes..." -ForegroundColor Yellow
Write-Host ""

$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "Node.js processes found:" -ForegroundColor Green
    $nodeProcesses | ForEach-Object {
        Write-Host "  PID: $($_.Id) - $($_.MainWindowTitle)" -ForegroundColor White
    }
} else {
    Write-Host "No Node.js processes running" -ForegroundColor Red
}

Write-Host ""

# Check ports
Write-Host "Checking ports..." -ForegroundColor Yellow
Write-Host ""

$ports = @{
    "3001" = "Backend"
    "5173" = "Frontend"
    "8080" = "Proxy"
}

foreach ($port in $ports.Keys) {
    $connections = netstat -ano | Select-String ":$port.*LISTENING"
    if ($connections) {
        Write-Host "  Port $port ($($ports[$port])): " -NoNewline -ForegroundColor Cyan
        Write-Host "RUNNING" -ForegroundColor Green
    } else {
        Write-Host "  Port $port ($($ports[$port])): " -NoNewline -ForegroundColor Cyan
        Write-Host "NOT RUNNING" -ForegroundColor Red
    }
}

Write-Host ""

# Check ngrok
Write-Host "Checking ngrok..." -ForegroundColor Yellow
$ngrokProcess = Get-Process ngrok -ErrorAction SilentlyContinue
if ($ngrokProcess) {
    Write-Host "  ngrok: " -NoNewline -ForegroundColor Cyan
    Write-Host "RUNNING (PID: $($ngrokProcess.Id))" -ForegroundColor Green
    
    # Try to get ngrok URL from API
    try {
        $ngrokApi = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2
        $publicUrl = $ngrokApi.tunnels[0].public_url
        Write-Host "  URL: $publicUrl" -ForegroundColor White
    } catch {
        Write-Host "  Could not fetch ngrok URL from API" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ngrok: " -NoNewline -ForegroundColor Cyan
    Write-Host "NOT RUNNING" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Summary
$backendRunning = netstat -ano | Select-String ":3001.*LISTENING"
$frontendRunning = netstat -ano | Select-String ":5173.*LISTENING"
$proxyRunning = netstat -ano | Select-String ":8080.*LISTENING"

if ($backendRunning -and $frontendRunning -and $proxyRunning) {
    Write-Host "STATUS: All services running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can:" -ForegroundColor Cyan
    Write-Host "  - Open http://localhost:5173 in browser" -ForegroundColor White
    Write-Host "  - Test API: .\test-api-connection.ps1" -ForegroundColor White
} else {
    Write-Host "STATUS: Some services are missing!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To start services:" -ForegroundColor Yellow
    Write-Host "  .\start-production.ps1" -ForegroundColor White
}

Write-Host ""

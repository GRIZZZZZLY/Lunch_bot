# ========================================
# Kill process on port 8080
# ========================================

Write-Host ""
Write-Host "Finding process on port 8080..." -ForegroundColor Yellow

$connections = netstat -ano | Select-String ":8080"

if ($connections) {
    Write-Host "Found processes:" -ForegroundColor Cyan
    $connections | ForEach-Object {
        Write-Host "  $_" -ForegroundColor Gray
    }
    Write-Host ""
    
    # Extract PIDs
    $pids = $connections | ForEach-Object {
        $line = $_.ToString().Trim()
        $parts = $line -split '\s+'
        $parts[-1]
    } | Select-Object -Unique | Where-Object { $_ -match '^\d+$' }
    
    foreach ($pid in $pids) {
        try {
            $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "Killing process $pid ($($process.Name))..." -ForegroundColor Yellow
                Stop-Process -Id $pid -Force
                Write-Host "  OK" -ForegroundColor Green
            }
        } catch {
            Write-Host "  Failed to kill $pid" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "Port 8080 should now be free" -ForegroundColor Green
} else {
    Write-Host "No process found on port 8080" -ForegroundColor Green
}

Write-Host ""

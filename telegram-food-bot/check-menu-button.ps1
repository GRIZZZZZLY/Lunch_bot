# ========================================
# Check Telegram Bot Menu Button
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Check Menu Button Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get bot token from .env
$envContent = Get-Content "backend\.env" | Where-Object { $_ -match '^BOT_TOKEN=' }
$token = ($envContent -split '=')[1]

if (-not $token) {
    Write-Host "ERROR: Bot token not found in backend/.env" -ForegroundColor Red
    exit 1
}

Write-Host "Bot token: ${token}" -ForegroundColor Gray
Write-Host ""

# Check current menu button
Write-Host "[1/3] Getting current menu button..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getChatMenuButton" -Method Get
    
    if ($response.ok) {
        Write-Host "  Status: SUCCESS" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Current Menu Button:" -ForegroundColor Cyan
        
        $button = $response.result
        if ($button.type -eq "web_app") {
            Write-Host "    Type:     web_app" -ForegroundColor White
            Write-Host "    Text:     $($button.text)" -ForegroundColor White
            Write-Host "    URL:      $($button.web_app.url)" -ForegroundColor White
        } elseif ($button.type -eq "commands") {
            Write-Host "    Type:     commands (default)" -ForegroundColor White
        } else {
            Write-Host "    Type:     $($button.type)" -ForegroundColor White
        }
    } else {
        Write-Host "  Status: FAILED" -ForegroundColor Red
        Write-Host "  Error: $($response.description)" -ForegroundColor Red
    }
} catch {
    Write-Host "  Status: FAILED" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host ""

# Check WEBAPP_URL from .env
Write-Host "[2/3] Checking WEBAPP_URL in backend/.env..." -ForegroundColor Yellow
$webappEnv = Get-Content "backend\.env" | Where-Object { $_ -match '^WEBAPP_URL=' }
$webappUrl = ($webappEnv -split '=')[1]

if ($webappUrl) {
    Write-Host "  WEBAPP_URL: $webappUrl" -ForegroundColor White
    
    if ($webappUrl.StartsWith("https://")) {
        Write-Host "  HTTPS:      OK" -ForegroundColor Green
    } else {
        Write-Host "  HTTPS:      FAILED (must use https://)" -ForegroundColor Red
    }
} else {
    Write-Host "  WEBAPP_URL: NOT SET" -ForegroundColor Red
}

Write-Host ""

# Check if URL is accessible
Write-Host "[3/3] Testing WEBAPP_URL accessibility..." -ForegroundColor Yellow
if ($webappUrl) {
    try {
        $testResponse = Invoke-WebRequest -Uri $webappUrl -Method Head -TimeoutSec 5 -UseBasicParsing
        Write-Host "  Status:     OK ($($testResponse.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "  Status:     FAILED" -ForegroundColor Red
        Write-Host "  Error:      $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($button.type -eq "web_app" -and $button.web_app.url -eq $webappUrl) {
    Write-Host "OK Menu Button matches WEBAPP_URL" -ForegroundColor Green
} else {
    Write-Host "WARNING Menu Button does NOT match WEBAPP_URL!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Expected: $webappUrl" -ForegroundColor White
    Write-Host "Actual:   $($button.web_app.url)" -ForegroundColor White
    Write-Host ""
    Write-Host "Solution: Restart backend to update Menu Button" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. If URLs don't match - restart backend" -ForegroundColor Gray
Write-Host "  2. On smartphone - close and reopen Telegram" -ForegroundColor Gray
Write-Host "  3. Test Menu button in bot" -ForegroundColor Gray
Write-Host ""

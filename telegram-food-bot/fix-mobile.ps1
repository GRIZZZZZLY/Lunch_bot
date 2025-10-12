# ========================================
# Quick Fix for Mobile Telegram Issue
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fix Mobile Telegram Mini App" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Read .env
$envPath = ".\backend\.env"
if (-not (Test-Path $envPath)) {
    Write-Host "ERROR: $envPath not found!" -ForegroundColor Red
    exit 1
}

$env = Get-Content $envPath -Raw
$BOT_TOKEN = if ($env -match 'BOT_TOKEN=(.+)') { $matches[1].Trim() } else { $null }
$WEBAPP_URL = if ($env -match 'WEBAPP_URL=(.+)') { $matches[1].Trim() } else { $null }

if (-not $BOT_TOKEN -or -not $WEBAPP_URL) {
    Write-Host "ERROR: BOT_TOKEN or WEBAPP_URL not found in .env!" -ForegroundColor Red
    exit 1
}

Write-Host "Bot Token: $BOT_TOKEN" -ForegroundColor Gray
Write-Host "WebApp URL: $WEBAPP_URL" -ForegroundColor Gray
Write-Host ""

# Check if URL is accessible
Write-Host "🔍 Checking if URL is accessible..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$WEBAPP_URL" -Method Head -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ URL is accessible (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ WARNING: URL is not accessible!" -ForegroundColor Red
    Write-Host "   This might be why mobile app doesn't work." -ForegroundColor Yellow
    Write-Host "   Make sure ngrok is running!" -ForegroundColor Yellow
}

Write-Host ""

# Update Menu Button
Write-Host "🔄 Updating Telegram Menu Button..." -ForegroundColor Yellow

$body = @{
    menu_button = @{
        type = "web_app"
        text = "📋 Мои группы"
        web_app = @{
            url = $WEBAPP_URL
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $apiUrl = "https://api.telegram.org/bot$BOT_TOKEN/setChatMenuButton"
    $result = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $body -ContentType "application/json"
    
    if ($result.ok) {
        Write-Host "✅ Menu Button updated successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  Next Steps for Mobile:" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "1. On your mobile phone:" -ForegroundColor White
        Write-Host "   - COMPLETELY CLOSE Telegram app" -ForegroundColor Cyan
        Write-Host "   - (Don't just minimize - close it)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "2. Open Telegram again" -ForegroundColor White
        Write-Host ""
        Write-Host "3. Find @$($BOT_TOKEN.Split(':')[0]) bot" -ForegroundColor White
        Write-Host ""
        Write-Host "4. Press Menu button" -ForegroundColor White
        Write-Host ""
        Write-Host "5. If you see 'You are about to visit...':" -ForegroundColor Yellow
        Write-Host "   - Press 'Visit Site'" -ForegroundColor Cyan
        Write-Host "   - Telegram will remember this domain" -ForegroundColor Gray
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "💡 Still not working?" -ForegroundColor Yellow
        Write-Host "   Read: MOBILE_TROUBLESHOOTING.md" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "❌ Failed to update Menu Button" -ForegroundColor Red
        Write-Host "Error: $($result.description)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error calling Telegram API:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Quick script to update Telegram Menu Button with current ngrok URL

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Update Telegram Menu Button" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get current ngrok URL from backend/.env
$ngrokUrl = ""
if (Test-Path "backend\.env") {
    $envContent = Get-Content "backend\.env" -Raw
    if ($envContent -match 'WEBAPP_URL=([^\r\n]+)') {
        $ngrokUrl = $matches[1].Trim()
    }
}

if (-not $ngrokUrl) {
    Write-Host "ERROR: WEBAPP_URL not found in backend/.env" -ForegroundColor Red
    exit 1
}

Write-Host "Current ngrok URL: $ngrokUrl" -ForegroundColor Green
Write-Host ""

# Get BOT_TOKEN from backend/.env
$botToken = ""
if (Test-Path "backend\.env") {
    $envContent = Get-Content "backend\.env" -Raw
    if ($envContent -match 'BOT_TOKEN=([^\r\n]+)') {
        $botToken = $matches[1].Trim()
    }
}

if (-not $botToken) {
    Write-Host "ERROR: BOT_TOKEN not found in backend/.env" -ForegroundColor Red
    exit 1
}

Write-Host "Updating Menu Button..." -ForegroundColor Yellow

# Prepare menu button data
$menuButton = @{
    type = "web_app"
    text = "Выбрать обед"
    web_app = @{
        url = $ngrokUrl
    }
} | ConvertTo-Json -Compress

# Update menu button
try {
    $result = Invoke-RestMethod `
        -Uri "https://api.telegram.org/bot$botToken/setChatMenuButton" `
        -Method POST `
        -Headers @{ "Content-Type" = "application/json" } `
        -Body $menuButton `
        -ErrorAction Stop
    
    if ($result.ok) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  SUCCESS!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Menu Button updated to:" -ForegroundColor Cyan
        Write-Host "  URL: $ngrokUrl" -ForegroundColor White
        Write-Host ""
        Write-Host "Now test in Telegram:" -ForegroundColor Yellow
        Write-Host "  1. Open @rocket_lunch_bot" -ForegroundColor White
        Write-Host "  2. Click Menu button (bottom left)" -ForegroundColor White
        Write-Host "  3. WebApp should open!" -ForegroundColor White
    } else {
        Write-Host "ERROR: $($result.description)" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

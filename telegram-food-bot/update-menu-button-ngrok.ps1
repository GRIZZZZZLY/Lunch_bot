# ========================================
# Update Telegram Menu Button with ngrok URL
# ========================================

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  UPDATE MENU BUTTON" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Read bot token from .env
$envPath = "backend\.env"
if (-not (Test-Path $envPath)) {
    Write-Host "ERROR: backend\.env not found!" -ForegroundColor Red
    exit 1
}

$botToken = Get-Content $envPath | Where-Object { $_ -match '^BOT_TOKEN=' } | ForEach-Object { $_.Split('=')[1] }
$webappUrl = Get-Content $envPath | Where-Object { $_ -match '^WEBAPP_URL=' } | ForEach-Object { $_.Split('=')[1] }

if (-not $botToken) {
    Write-Host "ERROR: BOT_TOKEN not found in .env!" -ForegroundColor Red
    exit 1
}

if (-not $webappUrl) {
    Write-Host "ERROR: WEBAPP_URL not found in .env!" -ForegroundColor Red
    exit 1
}

Write-Host "Bot Token: $($botToken.Substring(0, 15))..." -ForegroundColor Gray
Write-Host "WebApp URL: $webappUrl" -ForegroundColor Gray
Write-Host ""

# Set menu button
Write-Host "Setting menu button..." -ForegroundColor Yellow

$url = "https://api.telegram.org/bot$botToken/setChatMenuButton"
$body = @{
    menu_button = @{
        type = "web_app"
        text = "Открыть меню"
        web_app = @{
            url = $webappUrl
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json"
    
    if ($response.ok) {
        Write-Host "OK Menu button updated successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Menu button now opens: $webappUrl" -ForegroundColor Cyan
    } else {
        Write-Host "ERROR: Failed to update menu button" -ForegroundColor Red
        Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: Request failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""

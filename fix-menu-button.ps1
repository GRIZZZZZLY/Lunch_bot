# ========================================
# Force Update Telegram Bot Menu Button
# ========================================

param(
    [string]$NgrokUrl
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fix Menu Button" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get bot token from .env
$envContent = Get-Content "backend\.env" | Where-Object { $_ -match '^BOT_TOKEN=' }
$token = ($envContent -split '=')[1]

if (-not $token) {
    Write-Host "ERROR: Bot token not found in backend/.env" -ForegroundColor Red
    exit 1
}

# Get WEBAPP_URL from parameter or .env
if (-not $NgrokUrl) {
    $webappEnv = Get-Content "backend\.env" | Where-Object { $_ -match '^WEBAPP_URL=' }
    $NgrokUrl = ($webappEnv -split '=')[1]
}

if (-not $NgrokUrl) {
    Write-Host "ERROR: WEBAPP_URL not provided and not found in .env" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host '  .\fix-menu-button.ps1 "https://your-url.ngrok-free.app"' -ForegroundColor Gray
    Write-Host "  OR set WEBAPP_URL in backend/.env" -ForegroundColor Gray
    exit 1
}

# Remove trailing slash
$NgrokUrl = $NgrokUrl.TrimEnd('/')

# Validate HTTPS
if (-not $NgrokUrl.StartsWith("https://")) {
    Write-Host "ERROR: URL must use HTTPS (Telegram requirement)" -ForegroundColor Red
    Write-Host "Got: $NgrokUrl" -ForegroundColor Red
    exit 1
}

Write-Host "Bot Token:  $token" -ForegroundColor Gray
Write-Host "WebApp URL: $NgrokUrl" -ForegroundColor Green
Write-Host ""

# Update Menu Button
Write-Host "Updating Menu Button..." -ForegroundColor Yellow

$body = @{
    menu_button = @{
        type = "web_app"
        text = "Menu"
        web_app = @{
            url = $NgrokUrl
        }
    }
} | ConvertTo-Json -Depth 10 -Compress

try {
    $response = Invoke-RestMethod `
        -Method Post `
        -Uri "https://api.telegram.org/bot$token/setChatMenuButton" `
        -Body $body `
        -ContentType "application/json; charset=utf-8"
    
    if ($response.ok) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  SUCCESS!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Menu Button updated:" -ForegroundColor Cyan
        Write-Host "  Text: Menu" -ForegroundColor White
        Write-Host "  URL:  $NgrokUrl" -ForegroundColor White
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. On smartphone - CLOSE Telegram completely" -ForegroundColor Yellow
        Write-Host "  2. Open Telegram again" -ForegroundColor Yellow
        Write-Host "  3. Find @rocket_lunch_bot" -ForegroundColor Yellow
        Write-Host "  4. Press 'Menu' button" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "If still not working:" -ForegroundColor Cyan
        Write-Host '  - Open browser on smartphone' -ForegroundColor Gray
        Write-Host "  - Go to: $NgrokUrl" -ForegroundColor Gray
        Write-Host "  - Click 'Visit Site' if ngrok warning appears" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "FAILED: $($response.description)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    exit 1
}

# Verify the change
Write-Host "Verifying..." -ForegroundColor Yellow
Start-Sleep -Seconds 1

try {
    $verify = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getChatMenuButton" -Method Get
    
    if ($verify.ok -and $verify.result.web_app.url -eq $NgrokUrl) {
        Write-Host "VERIFIED: Menu Button is set correctly" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Verification failed" -ForegroundColor Yellow
        Write-Host "Current URL: $($verify.result.web_app.url)" -ForegroundColor Gray
    }
} catch {
    Write-Host "WARNING: Could not verify (but update may have succeeded)" -ForegroundColor Yellow
}

Write-Host ""

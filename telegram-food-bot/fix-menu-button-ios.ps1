# ========================================
# Fix Menu Button with iOS Cache Busting
# ========================================
# Adds timestamp parameter to force iOS to reload WebApp

param(
    [string]$NgrokUrl
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fix Menu Button (iOS Cache Buster)" -ForegroundColor Cyan
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
    Write-Host '  .\fix-menu-button-ios.ps1 "https://your-url.ngrok-free.app"' -ForegroundColor Gray
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

# ⭐ ADD TIMESTAMP TO BUST iOS CACHE
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
if ($NgrokUrl -match '\?') {
    $CacheBustedUrl = "${NgrokUrl}&v=${timestamp}"
} else {
    $CacheBustedUrl = "${NgrokUrl}?v=${timestamp}"
}

Write-Host "Bot Token:       $token" -ForegroundColor Gray
Write-Host "Original URL:    $NgrokUrl" -ForegroundColor Gray
Write-Host "Cache-Busted URL: $CacheBustedUrl" -ForegroundColor Green
Write-Host "Timestamp:       $timestamp" -ForegroundColor Cyan
Write-Host ""

# Update Menu Button
Write-Host "Updating Menu Button with cache-busting parameter..." -ForegroundColor Yellow

$body = @{
    menu_button = @{
        type = "web_app"
        text = "Menu"
        web_app = @{
            url = $CacheBustedUrl
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
        Write-Host "Menu Button updated with cache-buster:" -ForegroundColor Cyan
        Write-Host "  Text: Menu" -ForegroundColor White
        Write-Host "  URL:  $CacheBustedUrl" -ForegroundColor White
        Write-Host ""
        Write-Host "iOS Cache Fix Applied!" -ForegroundColor Green
        Write-Host "  - URL contains ?v=$timestamp parameter" -ForegroundColor Gray
        Write-Host "  - This forces iOS to reload WebApp" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Next steps for iPhone:" -ForegroundColor Cyan
        Write-Host "  1. CLOSE Telegram completely (swipe up from bottom)" -ForegroundColor Yellow
        Write-Host "  2. Wait 10 seconds" -ForegroundColor Yellow
        Write-Host "  3. Open Telegram" -ForegroundColor Yellow
        Write-Host "  4. @rocket_lunch_bot -> Press 'Menu' button" -ForegroundColor Yellow
        Write-Host "  5. If see 'Visit Site' -> click it" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "If STILL not working:" -ForegroundColor Cyan
        Write-Host "  Option 1: Clear Telegram cache" -ForegroundColor Gray
        Write-Host "    Settings -> Data and Storage -> Clear Cache" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "  Option 2: Run this script again (new timestamp)" -ForegroundColor Gray
        Write-Host "    .\fix-menu-button-ios.ps1" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "  Option 3: Reinstall Telegram (100% works)" -ForegroundColor Gray
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
    
    if ($verify.ok -and $verify.result.web_app.url -eq $CacheBustedUrl) {
        Write-Host "VERIFIED: Menu Button is set correctly with cache-buster" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Verification failed" -ForegroundColor Yellow
        Write-Host "Expected: $CacheBustedUrl" -ForegroundColor Gray
        Write-Host "Current:  $($verify.result.web_app.url)" -ForegroundColor Gray
    }
} catch {
    Write-Host "WARNING: Could not verify (but update may have succeeded)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "TIP: Run this script again if iOS still shows old version!" -ForegroundColor Cyan
Write-Host "     Each run creates a NEW timestamp to force cache refresh." -ForegroundColor Gray
Write-Host ""

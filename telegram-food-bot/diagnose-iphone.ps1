# ========================================
# Complete iPhone WebApp Diagnostics
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  iPhone WebApp Complete Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check ngrok URL
Write-Host "[1/8] Checking ngrok URL..." -ForegroundColor Yellow
$envContent = Get-Content "backend\.env" | Where-Object { $_ -match '^WEBAPP_URL=' }
$webappUrl = ($envContent -split '=')[1]
Write-Host "  Current: $webappUrl" -ForegroundColor White

if (-not $webappUrl) {
    Write-Host "  ERROR: WEBAPP_URL not set!" -ForegroundColor Red
} else {
    try {
        $response = Invoke-WebRequest -Uri "$webappUrl/health" -UseBasicParsing -TimeoutSec 10
        Write-Host "  Status: ACCESSIBLE (ngrok is working)" -ForegroundColor Green
    } catch {
        Write-Host "  Status: NOT ACCESSIBLE" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
    }
}

Write-Host ""

# 2. Check Menu Button
Write-Host "[2/8] Checking Menu Button..." -ForegroundColor Yellow
$tokenEnv = Get-Content "backend\.env" | Where-Object { $_ -match '^BOT_TOKEN=' }
$token = ($tokenEnv -split '=')[1]

try {
    $menuButton = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getChatMenuButton"
    if ($menuButton.ok) {
        $buttonUrl = $menuButton.result.web_app.url
        Write-Host "  Type: $($menuButton.result.type)" -ForegroundColor White
        Write-Host "  URL:  $buttonUrl" -ForegroundColor White
        
        if ($buttonUrl -ne $webappUrl) {
            Write-Host "  WARNING: Menu Button URL doesn't match WEBAPP_URL!" -ForegroundColor Red
            Write-Host "    Expected: $webappUrl" -ForegroundColor Gray
            Write-Host "    Actual:   $buttonUrl" -ForegroundColor Gray
        } else {
            Write-Host "  Status: OK" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "  ERROR: $_" -ForegroundColor Red
}

Write-Host ""

# 3. Check Proxy
Write-Host "[3/8] Checking Proxy (port 8080)..." -ForegroundColor Yellow
try {
    $proxyHealth = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing
    Write-Host "  Status: RUNNING" -ForegroundColor Green
} catch {
    Write-Host "  Status: NOT RUNNING" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host ""

# 4. Check Backend
Write-Host "[4/8] Checking Backend (port 3001)..." -ForegroundColor Yellow
try {
    $backendHealth = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing
    Write-Host "  Status: RUNNING" -ForegroundColor Green
} catch {
    Write-Host "  Status: NOT RUNNING" -ForegroundColor Red
}

Write-Host ""

# 5. Check Frontend
Write-Host "[5/8] Checking Frontend (port 5173)..." -ForegroundColor Yellow
$frontendProcess = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Id }
if ($frontendProcess) {
    Write-Host "  Status: RUNNING (Node process found)" -ForegroundColor Green
} else {
    Write-Host "  Status: UNKNOWN" -ForegroundColor Yellow
}

Write-Host ""

# 6. Test Full Chain
Write-Host "[6/8] Testing Full Request Chain..." -ForegroundColor Yellow
try {
    $testBody = @{ initData = "" } | ConvertTo-Json
    $authTest = Invoke-WebRequest `
        -Uri "$webappUrl/api/auth/validate" `
        -Method POST `
        -Body $testBody `
        -ContentType "application/json" `
        -UseBasicParsing `
        -TimeoutSec 10
    
    if ($authTest.StatusCode -eq 200) {
        Write-Host "  Status: WORKING" -ForegroundColor Green
        Write-Host "  Response: $($authTest.Content.Substring(0, [Math]::Min(100, $authTest.Content.Length)))..." -ForegroundColor Gray
    }
} catch {
    Write-Host "  Status: FAILED" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host ""

# 7. Check iOS-specific issues
Write-Host "[7/8] Checking iOS-specific issues..." -ForegroundColor Yellow

# Check for ngrok warning page
try {
    $ngrokTest = Invoke-WebRequest -Uri $webappUrl -UseBasicParsing
    if ($ngrokTest.Content -match "ngrok") {
        Write-Host "  WARNING: ngrok warning page detected!" -ForegroundColor Red
        Write-Host "  This requires 'Visit Site' click on first load" -ForegroundColor Yellow
    } else {
        Write-Host "  No ngrok warning (or direct content)" -ForegroundColor Green
    }
} catch {
    Write-Host "  Could not check ngrok warning" -ForegroundColor Gray
}

Write-Host ""

# 8. iOS Cache Check
Write-Host "[8/8] Checking cache-busting..." -ForegroundColor Yellow
if ($buttonUrl -match '\?v=\d+') {
    Write-Host "  Status: Cache-buster parameter PRESENT" -ForegroundColor Green
    $version = [regex]::Match($buttonUrl, '\?v=(\d+)').Groups[1].Value
    $versionDate = [DateTimeOffset]::FromUnixTimeSeconds($version).LocalDateTime
    Write-Host "  Version: $version (set at $versionDate)" -ForegroundColor White
} else {
    Write-Host "  Status: NO cache-buster parameter" -ForegroundColor Yellow
    Write-Host "  Recommendation: Run .\fix-menu-button-ios.ps1" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Diagnosis Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Common iPhone Issues:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. ngrok Warning Page" -ForegroundColor White
Write-Host "   - Free ngrok shows 'Visit Site' button" -ForegroundColor Gray
Write-Host "   - User MUST click it on first load" -ForegroundColor Gray
Write-Host "   Solution: Upgrade ngrok OR use alternative tunnel" -ForegroundColor Cyan
Write-Host ""

Write-Host "2. iOS Aggressive Caching" -ForegroundColor White
Write-Host "   - iOS caches WebApp by URL" -ForegroundColor Gray
Write-Host "   Solution: Run .\fix-menu-button-ios.ps1 multiple times" -ForegroundColor Cyan
Write-Host ""

Write-Host "3. Telegram App Cache" -ForegroundColor White
Write-Host "   - Telegram iOS caches everything" -ForegroundColor Gray
Write-Host "   Solution: Settings -> Data and Storage -> Clear Cache" -ForegroundColor Cyan
Write-Host ""

Write-Host "4. Old Menu Button URL" -ForegroundColor White
Write-Host "   - Menu Button points to old/wrong URL" -ForegroundColor Gray
Write-Host "   Solution: Run .\fix-menu-button-ios.ps1 with correct URL" -ForegroundColor Cyan
Write-Host ""

Write-Host "Alternative Solutions:" -ForegroundColor Yellow
Write-Host "  A. Use Telegram Desktop for development (no iOS issues)" -ForegroundColor Gray
Write-Host "  B. Reinstall Telegram on iPhone (clears all cache)" -ForegroundColor Gray
Write-Host "  C. Use alternative tunnel: localtunnel, Cloudflare Tunnel" -ForegroundColor Gray
Write-Host "  D. Test in Safari on iPhone: $webappUrl" -ForegroundColor Gray
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. If ngrok warning detected -> click 'Visit Site' on iPhone" -ForegroundColor White
Write-Host "  2. Run: .\fix-menu-button-ios.ps1" -ForegroundColor White
Write-Host "  3. Close Telegram COMPLETELY on iPhone" -ForegroundColor White
Write-Host "  4. Wait 15 seconds" -ForegroundColor White
Write-Host "  5. Open Telegram -> @rocket_lunch_bot -> Menu" -ForegroundColor White
Write-Host ""

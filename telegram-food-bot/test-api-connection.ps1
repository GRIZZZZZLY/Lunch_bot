# ========================================
# Test API Connection Chain
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  API Connection Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get ngrok URL from .env
$envContent = Get-Content "backend\.env" | Where-Object { $_ -match '^WEBAPP_URL=' }
$ngrokUrl = ($envContent -split '=')[1]

$frontendEnv = Get-Content "frontend\.env" | Where-Object { $_ -match '^VITE_API_URL=' }
$frontendApiUrl = ($frontendEnv -split '=')[1]

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Backend WEBAPP_URL:  $ngrokUrl" -ForegroundColor White
Write-Host "  Frontend API URL:    $frontendApiUrl" -ForegroundColor White
Write-Host ""

# Test 1: Backend direct
Write-Host "[1/5] Testing backend (localhost:3001)..." -ForegroundColor Yellow
try {
    $backendTest = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method Get -TimeoutSec 5 -UseBasicParsing
    Write-Host "  Status: OK ($($backendTest.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  Status: FAILED" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "CRITICAL: Backend is not running!" -ForegroundColor Red
    Write-Host "Start it with: cd backend && npm run dev" -ForegroundColor Yellow
    exit 1
}

# Test 2: Proxy
Write-Host "[2/5] Testing proxy (localhost:8080)..." -ForegroundColor Yellow
try {
    $proxyTest = Invoke-WebRequest -Uri "http://localhost:8080/api/health" -Method Get -TimeoutSec 5 -UseBasicParsing
    Write-Host "  Status: OK ($($proxyTest.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  Status: FAILED" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "CRITICAL: Proxy is not running!" -ForegroundColor Red
    Write-Host "Start it with: node proxy-server.js" -ForegroundColor Yellow
    exit 1
}

# Test 3: ngrok URL
Write-Host "[3/5] Testing ngrok URL ($ngrokUrl)..." -ForegroundColor Yellow
try {
    $ngrokTest = Invoke-WebRequest -Uri "$ngrokUrl" -Method Get -TimeoutSec 10 -UseBasicParsing
    Write-Host "  Status: OK ($($ngrokTest.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  Status: FAILED" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "CRITICAL: ngrok URL is not accessible!" -ForegroundColor Red
    Write-Host "Possible reasons:" -ForegroundColor Yellow
    Write-Host "  1. ngrok is not running" -ForegroundColor Gray
    Write-Host "  2. ngrok URL has changed" -ForegroundColor Gray
    Write-Host "  3. ngrok tunnel expired" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Check ngrok window for current URL" -ForegroundColor Yellow
    exit 1
}

# Test 4: ngrok API endpoint
Write-Host "[4/5] Testing ngrok API endpoint ($ngrokUrl/api/health)..." -ForegroundColor Yellow
try {
    $ngrokApiTest = Invoke-WebRequest -Uri "$ngrokUrl/api/health" -Method Get -TimeoutSec 10 -UseBasicParsing
    Write-Host "  Status: OK ($($ngrokApiTest.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  Status: FAILED" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "WARNING: ngrok can't reach /api endpoints" -ForegroundColor Yellow
    Write-Host "This means proxy routing might be broken" -ForegroundColor Yellow
}

# Test 5: Auth endpoint with mock data
Write-Host "[5/5] Testing auth endpoint..." -ForegroundColor Yellow
try {
    $authBody = @{
        initData = "mock_test_data"
    } | ConvertTo-Json
    
    $authTest = Invoke-WebRequest `
        -Uri "$ngrokUrl/api/auth/validate" `
        -Method Post `
        -Body $authBody `
        -ContentType "application/json" `
        -TimeoutSec 10 `
        -UseBasicParsing
    
    Write-Host "  Status: OK ($($authTest.StatusCode))" -ForegroundColor Green
    Write-Host "  Response: $($authTest.Content)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "  Status: $statusCode" -ForegroundColor Yellow
    
    if ($statusCode -eq 401 -or $statusCode -eq 500) {
        Write-Host "  This is OK - endpoint is reachable (auth failed as expected)" -ForegroundColor Green
    } else {
        Write-Host "  Error: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Connection chain:" -ForegroundColor Yellow
Write-Host "  Frontend -> ngrok -> proxy -> backend" -ForegroundColor White
Write-Host ""
Write-Host "If all tests passed but smartphone still fails:" -ForegroundColor Cyan
Write-Host "  1. Open browser on smartphone" -ForegroundColor Gray
Write-Host "  2. Go to: $ngrokUrl" -ForegroundColor Gray
Write-Host "  3. Click 'Visit Site' if ngrok warning appears" -ForegroundColor Gray
Write-Host "  4. You should see the webapp" -ForegroundColor Gray
Write-Host "  5. Then try Telegram again" -ForegroundColor Gray
Write-Host ""
Write-Host "If tests failed:" -ForegroundColor Cyan
Write-Host "  Check which service is not running and start it" -ForegroundColor Gray
Write-Host ""

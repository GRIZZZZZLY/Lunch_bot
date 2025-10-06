# ========================================
# Debug Authentication Issues
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Authentication Debug" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check backend .env
Write-Host "[1/5] Checking backend .env..." -ForegroundColor Yellow
Write-Host ""

$backendEnv = Get-Content "backend\.env" -ErrorAction SilentlyContinue

if ($backendEnv) {
    Write-Host "SKIP_TELEGRAM_VALIDATION:" -ForegroundColor Cyan
    $skip = $backendEnv | Where-Object { $_ -match "^SKIP_TELEGRAM_VALIDATION" }
    if ($skip) {
        Write-Host "  $skip" -ForegroundColor Green
    } else {
        Write-Host "  NOT SET!" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "NODE_ENV:" -ForegroundColor Cyan
    $nodeEnv = $backendEnv | Where-Object { $_ -match "^NODE_ENV" }
    if ($nodeEnv) {
        Write-Host "  $nodeEnv" -ForegroundColor Green
    } else {
        Write-Host "  NOT SET!" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "TEST_USER_ID:" -ForegroundColor Cyan
    $testUser = $backendEnv | Where-Object { $_ -match "^TEST_USER_ID" }
    if ($testUser) {
        Write-Host "  $testUser" -ForegroundColor Green
    } else {
        Write-Host "  NOT SET!" -ForegroundColor Red
    }
} else {
    Write-Host "ERROR: backend/.env not found!" -ForegroundColor Red
}

Write-Host ""

# 2. Check frontend .env
Write-Host "[2/5] Checking frontend .env..." -ForegroundColor Yellow
Write-Host ""

$frontendEnv = Get-Content "frontend\.env" -ErrorAction SilentlyContinue

if ($frontendEnv) {
    Write-Host "VITE_USE_MOCK_API:" -ForegroundColor Cyan
    $mockApi = $frontendEnv | Where-Object { $_ -match "^VITE_USE_MOCK_API" }
    if ($mockApi) {
        Write-Host "  $mockApi" -ForegroundColor $(if ($mockApi -match "false") { "Green" } else { "Yellow" })
    } else {
        Write-Host "  NOT SET" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "VITE_API_URL:" -ForegroundColor Cyan
    $apiUrl = $frontendEnv | Where-Object { $_ -match "^VITE_API_URL" }
    if ($apiUrl) {
        Write-Host "  $apiUrl" -ForegroundColor Green
    } else {
        Write-Host "  NOT SET!" -ForegroundColor Red
    }
}

Write-Host ""

# 3. Test backend health
Write-Host "[3/5] Testing backend..." -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -ErrorAction Stop
    Write-Host "  Backend is running!" -ForegroundColor Green
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor White
} catch {
    Write-Host "  Backend NOT running!" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host ""

# 4. Test auth endpoint
Write-Host "[4/5] Testing auth endpoint..." -ForegroundColor Yellow
Write-Host ""

try {
    $body = @{ initData = "" } | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/validate" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    Write-Host "  Auth endpoint works!" -ForegroundColor Green
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor White
    Write-Host "  Response:" -ForegroundColor Cyan
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3 | Write-Host
} catch {
    Write-Host "  Auth endpoint failed!" -ForegroundColor Red
    Write-Host "  Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host ""

# 5. Check running processes
Write-Host "[5/5] Checking running services..." -ForegroundColor Yellow
Write-Host ""

$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Node.js processes running:" -ForegroundColor Cyan
    $nodeProcesses | ForEach-Object {
        Write-Host "  PID: $($_.Id) - Started: $($_.StartTime)" -ForegroundColor White
    }
} else {
    Write-Host "  No Node.js processes found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "If backend is NOT running:" -ForegroundColor Yellow
Write-Host "  1. Find backend window" -ForegroundColor White
Write-Host "  2. Check for errors" -ForegroundColor White
Write-Host "  3. Restart: cd backend && npm run dev" -ForegroundColor White
Write-Host ""

Write-Host "If auth endpoint FAILS:" -ForegroundColor Yellow
Write-Host "  1. Check backend logs" -ForegroundColor White
Write-Host "  2. Look for validation errors" -ForegroundColor White
Write-Host "  3. Make sure SKIP_TELEGRAM_VALIDATION=true" -ForegroundColor White
Write-Host ""

Write-Host "To see live logs:" -ForegroundColor Yellow
Write-Host "  - Backend: Check the backend window" -ForegroundColor White
Write-Host "  - Frontend: F12 in browser -> Console tab" -ForegroundColor White
Write-Host ""

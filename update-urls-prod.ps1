# ========================================
# Production URL Updater
# Автоматическое обновление ngrok URL
# для production окружения
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Production URL Updater" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "This script will:" -ForegroundColor Cyan
Write-Host "  1. Update backend/.env (WEBAPP_URL)" -ForegroundColor White
Write-Host "  2. Update frontend-new/.env.production (VITE_API_URL)" -ForegroundColor White
Write-Host "  3. Rebuild frontend (npm run build)" -ForegroundColor White
Write-Host "  4. Restart backend server" -ForegroundColor White
Write-Host ""

# Функция для получения ngrok URL
function Get-NgrokUrl {
    $url = Read-Host "Paste ngrok HTTPS URL (e.g., https://xxx.ngrok-free.app)"
    return $url.Trim()
}

# Функция для валидации URL
function Test-NgrokUrl {
    param([string]$url)
    
    if ($url -notmatch '^https://.*\.ngrok') {
        Write-Host "ERROR: Invalid URL format!" -ForegroundColor Red
        Write-Host "Must start with https:// and contain .ngrok" -ForegroundColor Red
        return $false
    }
    
    # Удаляем trailing slash если есть
    if ($url.EndsWith('/')) {
        $url = $url.Substring(0, $url.Length - 1)
    }
    
    return $true
}

# Функция для обновления .env файла
function Update-EnvFile {
    param(
        [string]$filePath,
        [string]$key,
        [string]$value
    )
    
    if (-not (Test-Path $filePath)) {
        Write-Host "WARNING: $filePath not found, creating..." -ForegroundColor Yellow
        New-Item -Path $filePath -ItemType File -Force | Out-Null
    }
    
    $content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
    
    if ($content -match "(?m)^$key=.*$") {
        # Обновляем существующее значение
        $content = $content -replace "(?m)^$key=.*$", "$key=$value"
    } else {
        # Добавляем новое значение
        if ($content) {
            $content += "`n$key=$value"
        } else {
            $content = "$key=$value"
        }
    }
    
    Set-Content -Path $filePath -Value $content -NoNewline
    Write-Host "OK: Updated $filePath" -ForegroundColor Green
}

# Функция для поиска и остановки процесса backend
function Stop-BackendProcess {
    Write-Host ""
    Write-Host "Looking for backend process..." -ForegroundColor Yellow
    
    # Ищем процесс node с backend
    $backendProcesses = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*backend*dev*" -or 
        $_.CommandLine -like "*backend*start*"
    }
    
    if ($backendProcesses) {
        Write-Host "Found backend process(es):" -ForegroundColor Yellow
        foreach ($proc in $backendProcesses) {
            Write-Host "  PID: $($proc.Id) - $($proc.CommandLine)" -ForegroundColor Gray
        }
        
        $confirm = Read-Host "Restart backend? (Y/n)"
        if ($confirm -ne 'n' -and $confirm -ne 'N') {
            foreach ($proc in $backendProcesses) {
                Stop-Process -Id $proc.Id -Force
                Write-Host "OK: Stopped PID $($proc.Id)" -ForegroundColor Green
            }
            return $true
        }
    } else {
        Write-Host "No backend process found (will need manual restart)" -ForegroundColor Yellow
    }
    
    return $false
}

# Главная логика
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 1: Get ngrok URL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ngrokUrl = Get-NgrokUrl

if (-not (Test-NgrokUrl $ngrokUrl)) {
    Write-Host ""
    Write-Host "Aborting..." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Удаляем trailing slash
if ($ngrokUrl.EndsWith('/')) {
    $ngrokUrl = $ngrokUrl.Substring(0, $ngrokUrl.Length - 1)
}

Write-Host ""
Write-Host "OK: URL validated: $ngrokUrl" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 2: Update .env files" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Обновляем backend/.env
Write-Host "Updating backend/.env..." -ForegroundColor Yellow
Update-EnvFile -filePath "backend\.env" -key "WEBAPP_URL" -value $ngrokUrl

# Обновляем frontend-new/.env.production
Write-Host "Updating frontend-new/.env.production..." -ForegroundColor Yellow
$apiUrl = "$ngrokUrl/api"
Update-EnvFile -filePath "frontend-new\.env.production" -key "VITE_API_URL" -value $apiUrl

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 3: Rebuild Frontend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Building frontend with new URL..." -ForegroundColor Yellow
Write-Host "This may take 10-20 seconds..." -ForegroundColor Gray
Write-Host ""

Set-Location frontend-new
$buildOutput = npm run build 2>&1
$buildResult = $LASTEXITCODE
Set-Location ..

if ($buildResult -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red
    Write-Host $buildOutput -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "OK: Frontend rebuilt successfully!" -ForegroundColor Green

# Show build size
if (Test-Path "frontend-new\dist") {
    $distSize = (Get-ChildItem -Path "frontend-new\dist" -Recurse | Measure-Object -Property Length -Sum).Sum
    $distSizeMB = [math]::Round($distSize / 1MB, 2)
    Write-Host "Build size: $distSizeMB MB" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 4: Restart Backend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$backendStopped = Stop-BackendProcess

if ($backendStopped) {
    Write-Host ""
    Write-Host "Starting new backend process..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "cd '$PWD\backend'; `
         Write-Host ''; `
         Write-Host '========================================' -ForegroundColor Green; `
         Write-Host '  BACKEND RESTARTED' -ForegroundColor Green; `
         Write-Host '========================================' -ForegroundColor Green; `
         Write-Host ''; `
         Write-Host 'New WEBAPP_URL: $ngrokUrl' -ForegroundColor Cyan; `
         Write-Host ''; `
         npm run dev"
    )
    
    Write-Host "OK: Backend restarted in new window" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "MANUAL ACTION REQUIRED:" -ForegroundColor Yellow
    Write-Host "  1. Close the backend terminal window" -ForegroundColor White
    Write-Host "  2. Restart it manually or run: cd backend && npm run dev" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  CONFIGURATION COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  ngrok URL:    $ngrokUrl" -ForegroundColor White
Write-Host "  API URL:      $apiUrl" -ForegroundColor White
Write-Host "  Frontend:     Rebuilt" -ForegroundColor White
Write-Host "  Backend:      " -NoNewline
if ($backendStopped) {
    Write-Host "Restarted" -ForegroundColor Green
} else {
    Write-Host "Needs manual restart" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Update bot with: @BotFather -> /setmenubutton" -ForegroundColor White
Write-Host "     URL: $ngrokUrl" -ForegroundColor Gray
Write-Host "  2. Open @rocket_lunch_bot in Telegram" -ForegroundColor White
Write-Host "  3. Press 'Menu' button" -ForegroundColor White
Write-Host "  4. WebApp should open!" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Logs will show:" -ForegroundColor Yellow
Write-Host "  [useAuth] API URL: $apiUrl" -ForegroundColor Gray
Write-Host ""

$null = Read-Host 'Press Enter to close this window'

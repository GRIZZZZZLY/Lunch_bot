# ========================================
# Update ngrok URLs in .env files
# ========================================

param(
    [string]$NgrokUrl = "",
    [switch]$Auto
)

# Function to update backend .env file
function Update-BackendEnv {
    param(
        [string]$FilePath,
        [string]$NgrokUrl
    )
    
    if (Test-Path $FilePath) {
        $content = Get-Content $FilePath
        
        # Update WEBAPP_URL (matches any URL: http:// or https://)
        $content = $content -replace '^(WEBAPP_URL=)https?://.*', "`${1}$NgrokUrl"
        
        # Update CORS_ORIGIN - replace existing ngrok URLs
        $content = $content -replace '^(CORS_ORIGIN=.*)https://[a-zA-Z0-9\-]+\.ngrok-free\.app(.*)$', "`${1}$NgrokUrl`$2"
        
        # If no ngrok URL in CORS_ORIGIN, add it
        $corsLine = $content | Where-Object { $_ -match '^CORS_ORIGIN=' }
        if ($corsLine -and $corsLine -notmatch [regex]::Escape($NgrokUrl)) {
            $content = $content -replace '^(CORS_ORIGIN=.*)$', "`${1},$NgrokUrl"
        }
        
        $content | Set-Content $FilePath
        return $true
    }
    return $false
}

# Function to update frontend .env file
function Update-FrontendEnv {
    param(
        [string]$FilePath,
        [string]$NgrokUrl
    )
    
    if (Test-Path $FilePath) {
        $content = Get-Content $FilePath -Raw
        $apiUrl = "$NgrokUrl/api"
        
        # Update VITE_API_URL
        $content = $content -replace '(VITE_API_URL=)https://[^\s]+', "`$1$apiUrl"
        
        $content | Set-Content $FilePath -NoNewline
        return $true
    }
    return $false
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Update ngrok URLs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ask for URL if not provided
if (-not $NgrokUrl) {
    Write-Host "Paste your ngrok URL from the ngrok window:" -ForegroundColor Yellow
    Write-Host "Example: https://abc123.ngrok-free.app" -ForegroundColor Gray
    Write-Host ""
    $NgrokUrl = Read-Host "ngrok URL"
}

# Validate URL
if (-not $NgrokUrl) {
    Write-Host "ERROR: No URL provided!" -ForegroundColor Red
    exit 1
}

# Remove trailing slash if present
$NgrokUrl = $NgrokUrl.TrimEnd('/')

# Validate format (accept both .app and .dev domains)
if ($NgrokUrl -notmatch '^https://[a-zA-Z0-9\-\.]+\.ngrok-free\.(app|dev)$') {
    Write-Host "WARNING: URL format doesn't match ngrok pattern" -ForegroundColor Yellow
    Write-Host "Expected format: https://xxxxx.ngrok-free.app or https://xxxxx.ngrok-free.dev" -ForegroundColor Yellow
    Write-Host "Provided: $NgrokUrl" -ForegroundColor Yellow
    Write-Host ""
    if (-not $Auto) {
        $continue = Read-Host "Continue anyway? (y/N)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            Write-Host "Cancelled" -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host ""
Write-Host "Using ngrok URL: $NgrokUrl" -ForegroundColor Green
Write-Host ""

# Backup files
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "backups\env_$timestamp"

Write-Host "Creating backups..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$backupFiles = @(
    "backend\.env",
    "backend\.env.development",
    "frontend\.env",
    "frontend\.env.development"
)

foreach ($file in $backupFiles) {
    if (Test-Path $file) {
        $fileName = $file -replace '\\', '_'
        Copy-Item $file "$backupDir\$fileName.backup"
        Write-Host "  Backed up: $file" -ForegroundColor Gray
    }
}

Write-Host "Backups saved to: $backupDir" -ForegroundColor Green
Write-Host ""

# Update Backend .env files
Write-Host "Updating backend .env files..." -ForegroundColor Yellow

$updatedCount = 0
if (Update-BackendEnv "backend\.env" $NgrokUrl) {
    Write-Host "  [OK] Updated backend\.env" -ForegroundColor Green
    $updatedCount++
}

if (Update-BackendEnv "backend\.env.development" $NgrokUrl) {
    Write-Host "  [OK] Updated backend\.env.development" -ForegroundColor Green
    $updatedCount++
}

if ($updatedCount -eq 0) {
    Write-Host "  WARNING: No backend .env files found!" -ForegroundColor Red
}

Write-Host ""

# Update Frontend .env files
Write-Host "Updating frontend .env files..." -ForegroundColor Yellow

$updatedCount = 0
$apiUrl = "$NgrokUrl/api"

if (Update-FrontendEnv "frontend\.env" $NgrokUrl) {
    Write-Host "  [OK] Updated frontend\.env -> VITE_API_URL=$apiUrl" -ForegroundColor Green
    $updatedCount++
}

if (Update-FrontendEnv "frontend\.env.development" $NgrokUrl) {
    Write-Host "  [OK] Updated frontend\.env.development -> VITE_API_URL=$apiUrl" -ForegroundColor Green
    $updatedCount++
}

if ($updatedCount -eq 0) {
    Write-Host "  WARNING: No frontend .env files found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  URLs UPDATED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Show summary
Write-Host "Summary of changes:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend files:" -ForegroundColor Yellow
Write-Host "  WEBAPP_URL=$NgrokUrl" -ForegroundColor Gray
Write-Host "  CORS_ORIGIN=http://localhost:5173,...,$NgrokUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "Frontend files:" -ForegroundColor Yellow
Write-Host "  VITE_API_URL=$NgrokUrl/api" -ForegroundColor Gray
Write-Host ""

# Ask to restart backend
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  IMPORTANT: Restart Backend!" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Backend must be restarted for changes to take effect." -ForegroundColor White
Write-Host ""

# Offer to restart backend automatically
$restart = if ($Auto) { "n" } else { Read-Host "Restart backend automatically? (Y/n)" }
if ($restart -ne "n" -and $restart -ne "N") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Restarting Backend..." -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Step 1: Find and kill backend processes on port 3001
    Write-Host "[1/3] Stopping old backend process..." -ForegroundColor Yellow
    
    $connections = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
    if ($connections) {
        $processIds = $connections | ForEach-Object { $_.OwningProcess } | Select-Object -Unique
        
        foreach ($processId in $processIds) {
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "  Stopping process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Gray
                
                # Try to find parent PowerShell process
                $parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue).ParentProcessId
                
                # Stop the node process
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                
                # Try to stop parent PowerShell window
                if ($parentPid) {
                    $parentProcess = Get-Process -Id $parentPid -ErrorAction SilentlyContinue
                    if ($parentProcess -and $parentProcess.ProcessName -eq "powershell") {
                        Write-Host "  Closing old terminal window (PID: $parentPid)" -ForegroundColor Gray
                        Stop-Process -Id $parentPid -Force -ErrorAction SilentlyContinue
                    }
                }
            }
        }
        Write-Host "  [OK] Old backend stopped" -ForegroundColor Green
    } else {
        Write-Host "  No backend process found on port 3001" -ForegroundColor Gray
    }
    
    Start-Sleep -Seconds 1
    
    # Step 2: Start new backend in new terminal
    Write-Host ""
    Write-Host "[2/3] Starting new backend terminal..." -ForegroundColor Yellow
    
    $projectRoot = Get-Location
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "cd '$projectRoot\backend'; `
         Write-Host ''; `
         Write-Host '========================================' -ForegroundColor Green; `
         Write-Host '  BACKEND DEV SERVER (RESTARTED)' -ForegroundColor Green; `
         Write-Host '========================================' -ForegroundColor Green; `
         Write-Host ''; `
         Write-Host 'Port: 3001' -ForegroundColor Cyan; `
         Write-Host 'URL:  http://localhost:3001' -ForegroundColor Cyan; `
         Write-Host ''; `
         Write-Host 'ngrok URL updated: $NgrokUrl' -ForegroundColor Yellow; `
         Write-Host ''; `
         npm run dev"
    )
    
    Write-Host "  [OK] New backend terminal opened" -ForegroundColor Green
    
    Start-Sleep -Seconds 2
    
    # Step 3: Verify backend is starting
    Write-Host ""
    Write-Host "[3/3] Verifying backend restart..." -ForegroundColor Yellow
    Write-Host "  Waiting for backend to start..." -ForegroundColor Gray
    
    $maxAttempts = 10
    $attempt = 0
    $backendStarted = $false
    
    while ($attempt -lt $maxAttempts -and -not $backendStarted) {
        Start-Sleep -Seconds 1
        $attempt++
        
        $connection = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
        if ($connection) {
            $backendStarted = $true
            Write-Host "  [OK] Backend is running on port 3001" -ForegroundColor Green
        }
    }
    
    if (-not $backendStarted) {
        Write-Host "  WARNING: Could not verify backend start (this is normal, it may still be starting)" -ForegroundColor Yellow
        Write-Host "  Check the new terminal window for any errors" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  BACKEND RESTARTED!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuring Telegram Bot..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get BOT_TOKEN and BOT_MODE from backend/.env
$botToken = ""
$botMode = "polling"
if (Test-Path "backend\.env") {
    $envContent = Get-Content "backend\.env" -Raw
    if ($envContent -match 'BOT_TOKEN=([^\r\n]+)') {
        $botToken = $matches[1]
    }
    if ($envContent -match 'BOT_MODE=([^\r\n]+)') {
        $botMode = $matches[1].Trim()
    }
}

if ($botToken) {
    Write-Host "Bot mode: $botMode" -ForegroundColor Cyan
    
    if ($botMode -eq "webhook") {
        # Webhook mode - set webhook URL
        Write-Host "Setting webhook for Telegram bot..." -ForegroundColor Yellow
        $webhookUrl = "$NgrokUrl/api/webhook"
        
        try {
            $result = Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/setWebhook?url=$webhookUrl" -Method POST -ErrorAction Stop
            
            if ($result.ok) {
                Write-Host "  [OK] Webhook set successfully!" -ForegroundColor Green
                Write-Host "  URL: $webhookUrl" -ForegroundColor Gray
            } else {
                Write-Host "  WARNING: Failed to set webhook" -ForegroundColor Yellow
                Write-Host "  $($result.description)" -ForegroundColor Gray
            }
        } catch {
            Write-Host "  WARNING: Could not set webhook automatically" -ForegroundColor Yellow
            Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
        }
    } else {
        # Polling mode - delete webhook
        Write-Host "Deleting webhook (polling mode)..." -ForegroundColor Yellow
        
        try {
            $result = Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/deleteWebhook" -Method POST -ErrorAction Stop
            
            if ($result.ok) {
                Write-Host "  [OK] Webhook deleted successfully!" -ForegroundColor Green
                Write-Host "  Bot will use polling mode" -ForegroundColor Gray
            } else {
                Write-Host "  WARNING: Failed to delete webhook" -ForegroundColor Yellow
                Write-Host "  $($result.description)" -ForegroundColor Gray
            }
        } catch {
            Write-Host "  WARNING: Could not delete webhook automatically" -ForegroundColor Yellow
            Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "WARNING: BOT_TOKEN not found in backend/.env" -ForegroundColor Yellow
    Write-Host "Skipping webhook/polling setup" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Updating Menu Button..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Update Telegram Menu Button
if ($botToken) {
    Write-Host "Setting Menu Button URL..." -ForegroundColor Yellow
    
    # Prepare menu button data
    $menuButton = @{
        type = "web_app"
        text = "Выбрать обед"
        web_app = @{
            url = $NgrokUrl
        }
    } | ConvertTo-Json -Compress
    
    try {
        $result = Invoke-RestMethod `
            -Uri "https://api.telegram.org/bot$botToken/setChatMenuButton" `
            -Method POST `
            -Headers @{ "Content-Type" = "application/json" } `
            -Body $menuButton `
            -ErrorAction Stop
        
        if ($result.ok) {
            Write-Host "  [OK] Menu Button updated!" -ForegroundColor Green
            Write-Host "  URL: $NgrokUrl" -ForegroundColor Gray
        } else {
            Write-Host "  WARNING: Failed to update Menu Button" -ForegroundColor Yellow
            Write-Host "  $($result.description)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  WARNING: Could not update Menu Button" -ForegroundColor Yellow
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  You can update it manually:" -ForegroundColor Cyan
        Write-Host "  .\update-menu-button-quick.ps1" -ForegroundColor Gray
    }
} else {
    Write-Host "WARNING: BOT_TOKEN not found, skipping Menu Button update" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  All Done! Test in Telegram!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Open @rocket_lunch_bot in Telegram" -ForegroundColor White
Write-Host "2. Press 'Menu' button (left side)" -ForegroundColor White
Write-Host "3. WebApp should open!" -ForegroundColor White
Write-Host ""

# PowerShell script to update ngrok URL in all config files
# Usage: .\update-ngrok-url.ps1 -NewUrl "https://your-new-url.ngrok-free.app"

param (
    [Parameter(Mandatory=$true)]
    [string]$NewUrl
)

# Remove trailing slash if present
$NewUrl = $NewUrl.TrimEnd('/')

Write-Host "Updating ngrok URL to: $NewUrl" -ForegroundColor Green

# Get current URL from frontend .env
$frontendEnvPath = ".\frontend\.env"
$currentUrl = ""

if (Test-Path $frontendEnvPath) {
    $content = Get-Content $frontendEnvPath
    foreach ($line in $content) {
        if ($line -match "VITE_API_URL=(.+)/api") {
            $currentUrl = $matches[1]
            break
        }
    }
}

if ($currentUrl) {
    Write-Host "Current URL: $currentUrl" -ForegroundColor Yellow
} else {
    Write-Host "Could not detect current URL" -ForegroundColor Yellow
}

# Update frontend .env
Write-Host "`nUpdating frontend\.env..." -ForegroundColor Cyan
if (Test-Path $frontendEnvPath) {
    $content = Get-Content $frontendEnvPath -Raw
    $content = $content -replace "VITE_API_URL=https://[^/]+\.ngrok-free\.app/api", "VITE_API_URL=$NewUrl/api"
    $content | Set-Content $frontendEnvPath -NoNewline
    Write-Host "✓ Updated frontend\.env" -ForegroundColor Green
}

# Update frontend .env.production
$frontendEnvProdPath = ".\frontend\.env.production"
Write-Host "Updating frontend\.env.production..." -ForegroundColor Cyan
if (Test-Path $frontendEnvProdPath) {
    $content = Get-Content $frontendEnvProdPath -Raw
    $content = $content -replace "VITE_API_URL=https://[^/]+\.ngrok-free\.app/api", "VITE_API_URL=$NewUrl/api"
    $content | Set-Content $frontendEnvProdPath -NoNewline
    Write-Host "✓ Updated frontend\.env.production" -ForegroundColor Green
}

# Update backend .env
$backendEnvPath = ".\backend\.env"
Write-Host "Updating backend\.env..." -ForegroundColor Cyan
if (Test-Path $backendEnvPath) {
    $content = Get-Content $backendEnvPath -Raw
    
    # Update BOT_WEBHOOK_URL
    $content = $content -replace "BOT_WEBHOOK_URL=https://[^/]+\.ngrok-free\.app/webhook", "BOT_WEBHOOK_URL=$NewUrl/webhook"
    
    # Update WEBAPP_URL
    $content = $content -replace "WEBAPP_URL=https://[^/\r\n]+\.ngrok-free\.app", "WEBAPP_URL=$NewUrl"
    
    # Update CORS_ORIGIN
    $content = $content -replace "https://[^,\s]+\.ngrok-free\.app", "$NewUrl"
    
    $content | Set-Content $backendEnvPath -NoNewline
    Write-Host "✓ Updated backend\.env" -ForegroundColor Green
}

Write-Host "`n✅ All configuration files updated successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Restart backend: cd backend; npm run dev" -ForegroundColor White
Write-Host "2. Restart frontend: cd frontend; npm run dev" -ForegroundColor White
Write-Host "3. Update Mini App URL in BotFather to: $NewUrl" -ForegroundColor White
Write-Host "4. Set webhook: curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook -d url=$NewUrl/webhook" -ForegroundColor White

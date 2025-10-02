# PowerShell script to setup Telegram webhook
# Usage: .\setup-webhook.ps1

param(
    [string]$CustomUrl = ""
)

$BOT_TOKEN = "8298516078:AAF3QAaoVURt634PcNtwMKiExF2nILnziGk"

# Get URL from .env if not provided
if ([string]::IsNullOrEmpty($CustomUrl)) {
    $backendEnvPath = ".\backend\.env"
    if (Test-Path $backendEnvPath) {
        $content = Get-Content $backendEnvPath
        foreach ($line in $content) {
            if ($line -match "BOT_WEBHOOK_URL=(.+)") {
                $CustomUrl = $matches[1]
                break
            }
        }
    }
}

if ([string]::IsNullOrEmpty($CustomUrl)) {
    Write-Host "Error: Could not find webhook URL" -ForegroundColor Red
    Write-Host "Usage: .\setup-webhook.ps1 -CustomUrl 'https://your-domain.ngrok-free.app/webhook'" -ForegroundColor Yellow
    exit 1
}

Write-Host "Setting up Telegram webhook..." -ForegroundColor Cyan
Write-Host "Bot Token: $BOT_TOKEN" -ForegroundColor Yellow
Write-Host "Webhook URL: $CustomUrl" -ForegroundColor Yellow

# Set webhook
Write-Host "`nSetting webhook..." -ForegroundColor Green
$setWebhookUrl = "https://api.telegram.org/bot$BOT_TOKEN/setWebhook"
$body = @{
    url = $CustomUrl
    allowed_updates = @("message", "callback_query", "inline_query")
    drop_pending_updates = $true
}

try {
    $response = Invoke-RestMethod -Uri $setWebhookUrl -Method Post -Body ($body | ConvertTo-Json) -ContentType "application/json"
    
    if ($response.ok) {
        Write-Host "✓ Webhook set successfully!" -ForegroundColor Green
        Write-Host "Description: $($response.description)" -ForegroundColor White
    } else {
        Write-Host "✗ Failed to set webhook" -ForegroundColor Red
        Write-Host "Error: $($response.description)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Error setting webhook: $($_.Exception.Message)" -ForegroundColor Red
}

# Get webhook info
Write-Host "`nGetting webhook info..." -ForegroundColor Cyan
$getWebhookUrl = "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"

try {
    $info = Invoke-RestMethod -Uri $getWebhookUrl -Method Get
    
    Write-Host "`nWebhook Info:" -ForegroundColor Green
    Write-Host "URL: $($info.result.url)" -ForegroundColor White
    Write-Host "Has Custom Certificate: $($info.result.has_custom_certificate)" -ForegroundColor White
    Write-Host "Pending Update Count: $($info.result.pending_update_count)" -ForegroundColor White
    
    if ($info.result.last_error_date) {
        $lastErrorDate = [DateTimeOffset]::FromUnixTimeSeconds($info.result.last_error_date).LocalDateTime
        Write-Host "Last Error Date: $lastErrorDate" -ForegroundColor Yellow
        Write-Host "Last Error Message: $($info.result.last_error_message)" -ForegroundColor Yellow
    } else {
        Write-Host "No errors!" -ForegroundColor Green
    }
    
    if ($info.result.allowed_updates) {
        Write-Host "Allowed Updates: $($info.result.allowed_updates -join ', ')" -ForegroundColor White
    }
} catch {
    Write-Host "✗ Error getting webhook info: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ Webhook setup complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Make sure backend is running on port 3001" -ForegroundColor White
Write-Host "2. Test the bot by sending a message in Telegram" -ForegroundColor White

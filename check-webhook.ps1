# PowerShell script to check Telegram webhook status
# Usage: .\check-webhook.ps1

$BOT_TOKEN = $env:BOT_TOKEN
if ([string]::IsNullOrWhiteSpace($BOT_TOKEN)) {
    throw "Set BOT_TOKEN in the process environment before running this script."
}

Write-Host "Checking Telegram webhook status..." -ForegroundColor Cyan

$getWebhookUrl = "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"

try {
    $info = Invoke-RestMethod -Uri $getWebhookUrl -Method Get
    
    if ($info.ok) {
        Write-Host "✓ Webhook Info Retrieved Successfully" -ForegroundColor Green
        Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        
        # URL
        Write-Host "`nWebhook URL:" -ForegroundColor Green
        if ($info.result.url) {
            Write-Host "  $($info.result.url)" -ForegroundColor White
        } else {
            Write-Host "  Not set (using long polling)" -ForegroundColor Yellow
        }
        
        # Status
        Write-Host "`nStatus:" -ForegroundColor Green
        Write-Host "  Has Custom Certificate: $($info.result.has_custom_certificate)" -ForegroundColor White
        Write-Host "  Pending Update Count: $($info.result.pending_update_count)" -ForegroundColor White
        Write-Host "  Max Connections: $($info.result.max_connections)" -ForegroundColor White
        
        # Errors
        if ($info.result.last_error_date) {
            $lastErrorDate = [DateTimeOffset]::FromUnixTimeSeconds($info.result.last_error_date).LocalDateTime
            Write-Host "`nLast Error:" -ForegroundColor Red
            Write-Host "  Date: $lastErrorDate" -ForegroundColor Yellow
            Write-Host "  Message: $($info.result.last_error_message)" -ForegroundColor Yellow
        } else {
            Write-Host "`nNo Errors! ✓" -ForegroundColor Green
        }
        
        # Allowed Updates
        if ($info.result.allowed_updates) {
            Write-Host "`nAllowed Updates:" -ForegroundColor Green
            foreach ($update in $info.result.allowed_updates) {
                Write-Host "  - $update" -ForegroundColor White
            }
        }
        
        # Last synchronization
        if ($info.result.last_synchronization_error_date) {
            $lastSyncDate = [DateTimeOffset]::FromUnixTimeSeconds($info.result.last_synchronization_error_date).LocalDateTime
            Write-Host "`nLast Synchronization Error:" -ForegroundColor Yellow
            Write-Host "  Date: $lastSyncDate" -ForegroundColor White
        }
        
        Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        
        # Health check
        if ($info.result.url) {
            Write-Host "`nTesting webhook URL..." -ForegroundColor Cyan
            $webhookUrl = $info.result.url -replace '/webhook$', '/health'
            
            try {
                $health = Invoke-RestMethod -Uri $webhookUrl -Method Get -TimeoutSec 5
                Write-Host "✓ Backend is reachable!" -ForegroundColor Green
                Write-Host "  Status: $($health.status)" -ForegroundColor White
            } catch {
                Write-Host "✗ Backend is not reachable" -ForegroundColor Red
                Write-Host "  Make sure your backend is running and ngrok tunnel is active" -ForegroundColor Yellow
            }
        }
        
    } else {
        Write-Host "✗ Failed to get webhook info" -ForegroundColor Red
        Write-Host "Error: $($info.description)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nPossible causes:" -ForegroundColor Yellow
    Write-Host "  - Invalid bot token" -ForegroundColor White
    Write-Host "  - No internet connection" -ForegroundColor White
    Write-Host "  - Telegram API is down" -ForegroundColor White
}

Write-Host ""

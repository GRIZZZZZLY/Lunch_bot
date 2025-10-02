# PowerShell script to delete Telegram webhook (switch to long polling)
# Usage: .\delete-webhook.ps1

$BOT_TOKEN = "REDACTED-BOT-TOKEN"

Write-Host "Deleting Telegram webhook..." -ForegroundColor Cyan
Write-Host "Bot Token: $BOT_TOKEN`n" -ForegroundColor Yellow

$deleteWebhookUrl = "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook"
$body = @{
    drop_pending_updates = $true
}

try {
    $response = Invoke-RestMethod -Uri $deleteWebhookUrl -Method Post -Body ($body | ConvertTo-Json) -ContentType "application/json"
    
    if ($response.ok) {
        Write-Host "✓ Webhook deleted successfully!" -ForegroundColor Green
        Write-Host "Description: $($response.description)" -ForegroundColor White
        Write-Host "`nBot is now using long polling mode." -ForegroundColor Yellow
        Write-Host "This is useful for local development without ngrok." -ForegroundColor Yellow
    } else {
        Write-Host "✗ Failed to delete webhook" -ForegroundColor Red
        Write-Host "Error: $($response.description)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Verify deletion
Write-Host "`nVerifying webhook status..." -ForegroundColor Cyan
$getWebhookUrl = "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"

try {
    $info = Invoke-RestMethod -Uri $getWebhookUrl -Method Get
    
    if ($info.result.url) {
        Write-Host "⚠ Webhook still exists: $($info.result.url)" -ForegroundColor Yellow
    } else {
        Write-Host "✓ Webhook successfully removed" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Could not verify webhook status" -ForegroundColor Red
}

Write-Host ""

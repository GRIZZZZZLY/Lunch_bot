$BOT_TOKEN = "8298516078:AAF3QAaoVURt634PcNtwMKiExF2nILnziGk"
$WEBHOOK_URL = "https://2072f129141b.ngrok-free.app/webhook"

Write-Host "Setting webhook for bot..." -ForegroundColor Cyan
Write-Host "URL: $WEBHOOK_URL" -ForegroundColor Yellow

$body = @{
    url = $WEBHOOK_URL
    drop_pending_updates = $true
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" -Method Post -Body $body -ContentType "application/json"

if ($response.ok) {
    Write-Host "SUCCESS! Webhook set successfully!" -ForegroundColor Green
    Write-Host $response.description -ForegroundColor White
} else {
    Write-Host "FAILED! Error setting webhook" -ForegroundColor Red
    Write-Host $response.description -ForegroundColor Red
}

Write-Host "`nChecking webhook info..." -ForegroundColor Cyan
$info = Invoke-RestMethod -Uri "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo" -Method Get

Write-Host "Current webhook URL: $($info.result.url)" -ForegroundColor White
Write-Host "Pending updates: $($info.result.pending_update_count)" -ForegroundColor White

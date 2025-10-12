# ========================================
# Force Delete Telegram Webhook
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Delete Telegram Webhook" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Read BOT_TOKEN from .env
$envPath = ".\backend\.env"
if (-not (Test-Path $envPath)) {
    Write-Host "ERROR: $envPath not found!" -ForegroundColor Red
    exit 1
}

$env = Get-Content $envPath -Raw
$BOT_TOKEN = if ($env -match 'BOT_TOKEN=(.+)') { $matches[1].Trim() } else { $null }

if (-not $BOT_TOKEN) {
    Write-Host "ERROR: BOT_TOKEN not found in .env!" -ForegroundColor Red
    exit 1
}

Write-Host "Bot Token: $($BOT_TOKEN.Substring(0, 20))..." -ForegroundColor Gray
Write-Host ""

# 1. Check current webhook
Write-Host "🔍 Checking current webhook..." -ForegroundColor Yellow
try {
    $webhookInfo = Invoke-RestMethod -Uri "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"
    
    if ($webhookInfo.ok) {
        $url = $webhookInfo.result.url
        $pendingCount = $webhookInfo.result.pending_update_count
        
        Write-Host "Current webhook:" -ForegroundColor Cyan
        if ($url) {
            Write-Host "  URL: $url" -ForegroundColor Yellow
            Write-Host "  Pending updates: $pendingCount" -ForegroundColor Gray
        } else {
            Write-Host "  No webhook set" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "❌ Error checking webhook: $_" -ForegroundColor Red
}

Write-Host ""

# 2. Delete webhook
Write-Host "🗑️  Deleting webhook..." -ForegroundColor Yellow

try {
    $deleteResult = Invoke-RestMethod `
        -Uri "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook" `
        -Method Post `
        -Body (@{ drop_pending_updates = $true } | ConvertTo-Json) `
        -ContentType "application/json"
    
    if ($deleteResult.ok) {
        Write-Host "✅ Webhook deleted successfully!" -ForegroundColor Green
        Write-Host "   Description: $($deleteResult.description)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Failed to delete webhook" -ForegroundColor Red
        Write-Host "   Error: $($deleteResult.description)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error deleting webhook: $_" -ForegroundColor Red
}

Write-Host ""

# 3. Verify webhook is deleted
Write-Host "🔍 Verifying webhook is deleted..." -ForegroundColor Yellow
Start-Sleep -Seconds 1

try {
    $verifyInfo = Invoke-RestMethod -Uri "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"
    
    if ($verifyInfo.ok) {
        $url = $verifyInfo.result.url
        
        if (-not $url) {
            Write-Host "✅ Confirmed: No webhook set" -ForegroundColor Green
            Write-Host "   You can now use polling mode!" -ForegroundColor Cyan
        } else {
            Write-Host "⚠️  WARNING: Webhook still set!" -ForegroundColor Yellow
            Write-Host "   URL: $url" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Error verifying: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Next Steps:" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Close Backend window (stop the bot)" -ForegroundColor White
Write-Host "2. Restart Backend:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "OR" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Close ALL start-dev.ps1 windows" -ForegroundColor White
Write-Host "2. Run: .\start-dev.ps1" -ForegroundColor White
Write-Host ""

Write-Host "Press any key to close..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

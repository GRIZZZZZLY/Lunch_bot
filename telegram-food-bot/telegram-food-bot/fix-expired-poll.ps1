# Скрипт для завершения истекших голосований

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fix Expired Poll" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$DbPath = "$PSScriptRoot\backend\prisma\dev.db"

if (-not (Test-Path $DbPath)) {
    Write-Host "❌ База данных не найдена: $DbPath" -ForegroundColor Red
    exit 1
}

Write-Host "📊 Checking database for expired polls..." -ForegroundColor Yellow
Write-Host ""

# SQL для поиска истекших голосований
$CheckSQL = @"
SELECT 
    id,
    group_id,
    status,
    datetime(started_at) as started,
    datetime(ended_at) as ended,
    datetime('now') as now,
    CASE 
        WHEN datetime(ended_at) < datetime('now') THEN 'EXPIRED'
        ELSE 'ACTIVE'
    END as real_status
FROM polls 
WHERE status = 'ACTIVE'
  AND ended_at IS NOT NULL
  AND datetime(ended_at) < datetime('now');
"@

# Выполняем проверку
$ExpiredPolls = sqlite3 $DbPath $CheckSQL

if ([string]::IsNullOrEmpty($ExpiredPolls)) {
    Write-Host "✅ No expired polls found!" -ForegroundColor Green
    Write-Host ""
    exit 0
}

Write-Host "⚠️  Found expired polls:" -ForegroundColor Yellow
Write-Host ""
Write-Host $ExpiredPolls
Write-Host ""

Write-Host "Do you want to close these polls? (Y/N): " -NoNewline -ForegroundColor Yellow
$Confirm = Read-Host

if ($Confirm -ne 'Y' -and $Confirm -ne 'y') {
    Write-Host "❌ Operation cancelled" -ForegroundColor Red
    exit 0
}

# SQL для завершения истекших голосований
$UpdateSQL = @"
UPDATE polls 
SET status = 'COMPLETED'
WHERE status = 'ACTIVE'
  AND ended_at IS NOT NULL
  AND datetime(ended_at) < datetime('now');
"@

Write-Host ""
Write-Host "🔄 Closing expired polls..." -ForegroundColor Cyan

sqlite3 $DbPath $UpdateSQL

$UpdatedCount = sqlite3 $DbPath "SELECT changes();"

Write-Host "✅ Closed $UpdatedCount expired poll(s)" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

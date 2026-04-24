param(
  [string]$BackupDir = "backups",
  [int]$KeepLast = 7,
  [switch]$Compress
)

$ErrorActionPreference = "Stop"

$containerName = "foodbot-postgres"
$dbUser = "foodbot"
$dbName = "foodbot_db"

if ($KeepLast -lt 1) {
  Write-Host "❌ KeepLast должен быть >= 1" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$fileName = "foodbot_backup_$timestamp.sql"
$filePath = Join-Path $BackupDir $fileName

Write-Host "💾 Создаю backup: $fileName" -ForegroundColor Cyan

docker exec $containerName pg_dump -U $dbUser $dbName > $filePath

if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Ошибка создания backup" -ForegroundColor Red
  exit 1
}

$sizeMb = [math]::Round((Get-Item $filePath).Length / 1MB, 2)
Write-Host "✅ Backup создан: $fileName" -ForegroundColor Green
Write-Host "📦 Размер: $sizeMb MB" -ForegroundColor Cyan

if ($Compress) {
  $zipPath = "$filePath.zip"
  Compress-Archive -Path $filePath -DestinationPath $zipPath -Force
  Remove-Item $filePath
  Write-Host "🗜️  Сжатие: $(Split-Path $zipPath -Leaf)" -ForegroundColor Cyan
}

$backups = Get-ChildItem $BackupDir -Filter "foodbot_backup_*.sql*" |
  Sort-Object LastWriteTime -Descending

if ($backups.Count -gt $KeepLast) {
  $toDelete = $backups | Select-Object -Skip $KeepLast
  foreach ($item in $toDelete) {
    Remove-Item $item.FullName
    Write-Host "🗑️  Удалён старый backup: $($item.Name)" -ForegroundColor Yellow
  }
}

Write-Host "✅ Готово" -ForegroundColor Green

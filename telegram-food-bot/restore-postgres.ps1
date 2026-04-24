param(
  [string]$BackupFile,
  [string]$BackupDir = "backups",
  [switch]$NoBackup,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$containerName = "foodbot-postgres"
$dbUser = "foodbot"
$dbName = "foodbot_db"

function Get-BackupList {
  if (-not (Test-Path $BackupDir)) {
    Write-Host "❌ Папка $BackupDir не найдена" -ForegroundColor Red
    exit 1
  }

  $items = Get-ChildItem $BackupDir -Filter "foodbot_backup_*.sql*" |
    Sort-Object LastWriteTime -Descending

  if ($items.Count -eq 0) {
    Write-Host "❌ Backup файлы не найдены" -ForegroundColor Red
    exit 1
  }

  return $items
}

function Select-BackupFile {
  $items = Get-BackupList
  Write-Host "`n📋 Доступные backup файлы:" -ForegroundColor Cyan

  for ($i = 0; $i -lt $items.Count; $i++) {
    $item = $items[$i]
    $sizeMb = [math]::Round($item.Length / 1MB, 2)
    $date = $item.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
    Write-Host "  [$i] $($item.Name)" -ForegroundColor White
    Write-Host "      Размер: $sizeMb MB | Дата: $date" -ForegroundColor Gray
  }

  $choice = Read-Host "Выберите номер backup (или 'q' для отмены)"
  if ($choice -eq 'q') {
    Write-Host "Отменено" -ForegroundColor Yellow
    exit 0
  }

  if ($choice -notmatch '^\d+$' -or [int]$choice -ge $items.Count) {
    Write-Host "❌ Неверный выбор" -ForegroundColor Red
    exit 1
  }

  return $items[[int]$choice].FullName
}

if (-not $BackupFile) {
  $BackupFile = Select-BackupFile
}

if (-not (Test-Path $BackupFile)) {
  Write-Host "❌ Файл не найден: $BackupFile" -ForegroundColor Red
  exit 1
}

Write-Host "`n⚠️  ВНИМАНИЕ: восстановление удалит текущие данные" -ForegroundColor Yellow
Write-Host "Файл: $BackupFile`n" -ForegroundColor White

if (-not $Force) {
  $confirm = Read-Host "Продолжить? (yes/no)"
  if ($confirm -ne "yes") {
    Write-Host "Отменено" -ForegroundColor Yellow
    exit 0
  }
}

if (-not $NoBackup) {
  Write-Host "`n💾 Создаю backup текущей БД..." -ForegroundColor Cyan
  .\backup-postgres.ps1
}

$workFile = $BackupFile
$tempDir = $null

if ($BackupFile.EndsWith(".zip")) {
  $tempDir = Join-Path $env:TEMP ("foodbot-restore-" + [guid]::NewGuid().ToString())
  New-Item -ItemType Directory -Path $tempDir | Out-Null
  Expand-Archive -Path $BackupFile -DestinationPath $tempDir -Force
  $workFile = (Get-ChildItem $tempDir -Filter "*.sql" | Select-Object -First 1).FullName
}

Write-Host "`n🔄 Восстановление..." -ForegroundColor Cyan

docker exec $containerName psql -U $dbUser -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$dbName' AND pid <> pg_backend_pid();" | Out-Null
docker exec $containerName psql -U $dbUser -c "DROP DATABASE IF EXISTS $dbName;" | Out-Null
docker exec $containerName psql -U $dbUser -c "CREATE DATABASE $dbName;" | Out-Null

Get-Content $workFile | docker exec -i $containerName psql -U $dbUser -d $dbName

if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Ошибка восстановления" -ForegroundColor Red
  exit 1
}

if ($tempDir) {
  Remove-Item $tempDir -Recurse -Force
}

$count = docker exec $containerName psql -U $dbUser -d $dbName -t -c "SELECT COUNT(*) FROM users;"
Write-Host "✅ Восстановление завершено" -ForegroundColor Green
Write-Host "👥 Пользователей в БД: $($count.Trim())" -ForegroundColor Cyan

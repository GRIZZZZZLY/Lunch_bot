param(
  [string]$BackupDir = "backups",
  [int]$KeepLast = 7,
  [switch]$Compress,
  [string]$ContainerName = "foodbot-postgres",
  [string]$DatabaseUser = "foodbot",
  [string]$DatabaseName = "foodbot_db"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-SafeName([string]$Value, [string]$Label) {
  if ($Value -notmatch '^[A-Za-z_][A-Za-z0-9_.-]{0,62}$') {
    throw "$Label содержит недопустимые символы"
  }
}

Assert-SafeName $ContainerName "Имя контейнера"
Assert-SafeName $DatabaseUser "Имя пользователя базы"
Assert-SafeName $DatabaseName "Имя базы"

if ($KeepLast -lt 1 -or $KeepLast -gt 365) {
  throw "KeepLast должен быть в диапазоне 1..365"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "docker не найден"
}

$backupRoot = [System.IO.Path]::GetFullPath(
  (Join-Path (Get-Location) $BackupDir)
)
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$fileName = "foodbot_backup_$timestamp.dump"
$filePath = Join-Path $backupRoot $fileName
$containerFile = "/tmp/rocket-lunch-backup-$([guid]::NewGuid().ToString('N')).dump"

Write-Host "Создаётся резервная копия: $fileName" -ForegroundColor Cyan

try {
  & docker inspect $ContainerName *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Контейнер $ContainerName недоступен"
  }

  & docker exec $ContainerName pg_dump `
    --username $DatabaseUser `
    --dbname $DatabaseName `
    --format custom `
    --compress 6 `
    --no-owner `
    --no-acl `
    --file $containerFile
  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump завершился с ошибкой"
  }

  & docker exec $ContainerName pg_restore --list $containerFile *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Созданный дамп не прошёл проверку pg_restore"
  }

  & docker cp "${ContainerName}:${containerFile}" $filePath
  if ($LASTEXITCODE -ne 0) {
    throw "Не удалось скопировать дамп из контейнера"
  }
}
finally {
  & docker exec $ContainerName rm -f -- $containerFile *> $null
}

$backupFile = Get-Item -LiteralPath $filePath
if ($backupFile.Length -le 0) {
  throw "Создан пустой файл резервной копии"
}

$hash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash
Set-Content -LiteralPath "$filePath.sha256" -Value "$hash  $fileName" -Encoding ascii

if ($Compress) {
  Write-Host "Формат custom уже использует встроенное сжатие; дополнительный ZIP не нужен." -ForegroundColor DarkYellow
}

$rootPrefix = $backupRoot.TrimEnd(
  [System.IO.Path]::DirectorySeparatorChar,
  [System.IO.Path]::AltDirectorySeparatorChar
) + [System.IO.Path]::DirectorySeparatorChar

$backups = @(
  Get-ChildItem -LiteralPath $backupRoot -Filter "foodbot_backup_*.dump" -File |
    Sort-Object LastWriteTime -Descending
)

if ($backups.Count -gt $KeepLast) {
  foreach ($item in ($backups | Select-Object -Skip $KeepLast)) {
    $resolved = [System.IO.Path]::GetFullPath($item.FullName)
    if (-not $resolved.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Отказ от удаления файла вне каталога резервных копий: $resolved"
    }

    Remove-Item -LiteralPath $resolved -Force
    $hashFile = "$resolved.sha256"
    if (Test-Path -LiteralPath $hashFile) {
      Remove-Item -LiteralPath $hashFile -Force
    }
    Write-Host "Удалена старая резервная копия: $($item.Name)" -ForegroundColor Yellow
  }
}

$sizeMb = [math]::Round($backupFile.Length / 1MB, 2)
Write-Host "Резервная копия готова: $filePath ($sizeMb МБ)" -ForegroundColor Green
Write-Host "SHA-256: $hash" -ForegroundColor Cyan

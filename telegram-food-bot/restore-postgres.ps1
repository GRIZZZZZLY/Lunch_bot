param(
  [string]$BackupFile,
  [string]$BackupDir = "backups",
  [switch]$NoBackup,
  [switch]$Force,
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

function Get-BackupList([string]$Root) {
  if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
    throw "Каталог резервных копий не найден: $Root"
  }

  $items = @(
    Get-ChildItem -LiteralPath $Root -Filter "foodbot_backup_*.dump" -File |
      Sort-Object LastWriteTime -Descending
  )
  if ($items.Count -eq 0) {
    throw "Резервные копии не найдены"
  }
  return $items
}

Assert-SafeName $ContainerName "Имя контейнера"
Assert-SafeName $DatabaseUser "Имя пользователя базы"
Assert-SafeName $DatabaseName "Имя базы"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "docker не найден"
}

$backupRoot = [System.IO.Path]::GetFullPath(
  (Join-Path (Get-Location) $BackupDir)
)

if (-not $BackupFile) {
  $items = @(Get-BackupList $backupRoot)
  Write-Host "Доступные резервные копии:" -ForegroundColor Cyan
  for ($index = 0; $index -lt $items.Count; $index++) {
    Write-Host "[$index] $($items[$index].Name)"
  }

  $choice = Read-Host "Введите номер или q для отмены"
  if ($choice -eq "q") {
    return
  }
  if ($choice -notmatch '^\d+$' -or [int]$choice -ge $items.Count) {
    throw "Неверный выбор"
  }
  $BackupFile = $items[[int]$choice].FullName
}

$resolvedBackup = [System.IO.Path]::GetFullPath(
  (Join-Path (Get-Location) $BackupFile)
)
if (-not (Test-Path -LiteralPath $resolvedBackup -PathType Leaf)) {
  throw "Файл не найден: $resolvedBackup"
}
if ([System.IO.Path]::GetExtension($resolvedBackup) -ne ".dump") {
  throw "Поддерживается только проверяемый формат .dump"
}

$hashFile = "$resolvedBackup.sha256"
if (Test-Path -LiteralPath $hashFile) {
  $expectedHash = ((Get-Content -LiteralPath $hashFile -Raw).Trim() -split '\s+')[0]
  $actualHash = (Get-FileHash -LiteralPath $resolvedBackup -Algorithm SHA256).Hash
  if ($expectedHash -ne $actualHash) {
    throw "Контрольная сумма резервной копии не совпала"
  }
} else {
  Write-Warning "Файл контрольной суммы отсутствует; целостность будет проверена pg_restore."
}

if (-not $Force) {
  Write-Host "ВНИМАНИЕ: текущая база $DatabaseName будет заменена." -ForegroundColor Yellow
  $confirmation = Read-Host "Для продолжения введите точное имя базы"
  if ($confirmation -ne $DatabaseName) {
    Write-Host "Восстановление отменено." -ForegroundColor Yellow
    return
  }
}

$containerFile = "/tmp/rocket-lunch-restore-$([guid]::NewGuid().ToString('N')).dump"
$validationDatabase = "restore_check_$([guid]::NewGuid().ToString('N').Substring(0, 16))"
Assert-SafeName $validationDatabase "Имя проверочной базы"

try {
  & docker inspect $ContainerName *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Контейнер $ContainerName недоступен"
  }

  & docker cp $resolvedBackup "${ContainerName}:${containerFile}"
  if ($LASTEXITCODE -ne 0) {
    throw "Не удалось скопировать дамп в контейнер"
  }

  & docker exec $ContainerName pg_restore --list $containerFile *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Дамп повреждён или имеет неподдерживаемый формат"
  }

  # Полная пробная загрузка выполняется до изменения рабочей базы.
  & docker exec $ContainerName createdb `
    --username $DatabaseUser `
    $validationDatabase
  if ($LASTEXITCODE -ne 0) {
    throw "Не удалось создать проверочную базу"
  }

  & docker exec $ContainerName pg_restore `
    --username $DatabaseUser `
    --dbname $validationDatabase `
    --exit-on-error `
    --no-owner `
    --no-acl `
    $containerFile
  if ($LASTEXITCODE -ne 0) {
    throw "Пробное восстановление завершилось с ошибкой"
  }

  if (-not $NoBackup) {
    & (Join-Path $PSScriptRoot "backup-postgres.ps1") `
      -BackupDir $BackupDir `
      -ContainerName $ContainerName `
      -DatabaseUser $DatabaseUser `
      -DatabaseName $DatabaseName
    if ($LASTEXITCODE -ne 0) {
      throw "Не удалось сохранить страховочную копию текущей базы"
    }
  } else {
    Write-Warning "Страховочная копия текущей базы отключена параметром NoBackup."
  }

  & docker exec $ContainerName psql `
    --username $DatabaseUser `
    --dbname postgres `
    --set ON_ERROR_STOP=1 `
    --command "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DatabaseName' AND pid <> pg_backend_pid();"
  if ($LASTEXITCODE -ne 0) {
    throw "Не удалось завершить соединения с целевой базой"
  }

  & docker exec $ContainerName dropdb `
    --username $DatabaseUser `
    --if-exists `
    $DatabaseName
  if ($LASTEXITCODE -ne 0) {
    throw "Не удалось удалить целевую базу"
  }

  & docker exec $ContainerName createdb `
    --username $DatabaseUser `
    $DatabaseName
  if ($LASTEXITCODE -ne 0) {
    throw "Не удалось создать целевую базу"
  }

  & docker exec $ContainerName pg_restore `
    --username $DatabaseUser `
    --dbname $DatabaseName `
    --exit-on-error `
    --no-owner `
    --no-acl `
    $containerFile
  if ($LASTEXITCODE -ne 0) {
    throw "Восстановление целевой базы завершилось с ошибкой"
  }

  & docker exec $ContainerName psql `
    --username $DatabaseUser `
    --dbname $DatabaseName `
    --tuples-only `
    --command "SELECT COUNT(*) FROM users;"
  if ($LASTEXITCODE -ne 0) {
    throw "Проверка восстановленной базы завершилась с ошибкой"
  }

  Write-Host "Восстановление завершено и проверено." -ForegroundColor Green
}
finally {
  & docker exec $ContainerName dropdb `
    --username $DatabaseUser `
    --if-exists `
    $validationDatabase *> $null
  & docker exec $ContainerName rm -f -- $containerFile *> $null
}

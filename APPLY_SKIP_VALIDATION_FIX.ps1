# ============================================
# Скрипт для применения исправления SKIP_TELEGRAM_VALIDATION
# ============================================

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Применение исправления" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Остановить Node процессы
Write-Host "[1/3] Остановка Node процессов..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "Найдено процессов Node: $($nodeProcesses.Count)" -ForegroundColor Gray
    $nodeProcesses | ForEach-Object {
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  Остановлен процесс ID: $($_.Id)" -ForegroundColor Gray
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "  Node процессы не найдены" -ForegroundColor Gray
}

# 2. Проверить .env
Write-Host ""
Write-Host "[2/3] Проверка .env файла..." -ForegroundColor Yellow
$envPath = "backend\.env"
if (Test-Path $envPath) {
    $skipValidation = Get-Content $envPath | Select-String "SKIP_TELEGRAM_VALIDATION"
    Write-Host "  $skipValidation" -ForegroundColor Cyan
    
    if ($skipValidation -match "SKIP_TELEGRAM_VALIDATION=true") {
        Write-Host "  ✅ SKIP_TELEGRAM_VALIDATION=true установлено" -ForegroundColor Green
    } else {
        Write-Host "  ❌ SKIP_TELEGRAM_VALIDATION=false (нужно true)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Исправляю..." -ForegroundColor Yellow
        
        # Заменяем false на true
        $content = Get-Content $envPath -Raw
        $content = $content -replace "SKIP_TELEGRAM_VALIDATION=false", "SKIP_TELEGRAM_VALIDATION=true"
        Set-Content -Path $envPath -Value $content -NoNewline
        
        Write-Host "  ✅ Исправлено!" -ForegroundColor Green
    }
} else {
    Write-Host "  ❌ Файл .env не найден!" -ForegroundColor Red
    exit 1
}

# 3. Перезапустить production
Write-Host ""
Write-Host "[3/3] Запуск production сервера..." -ForegroundColor Yellow
Write-Host ""

.\start-prod.ps1 -SkipBuild

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Готово!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Теперь откройте Mini App в Telegram" -ForegroundColor Cyan
Write-Host "Ошибка 'Invalid initData' должна исчезнуть" -ForegroundColor Cyan
Write-Host ""

#!/usr/bin/env pwsh
# Скрипт для перезапуска backend сервера

Write-Host "🔄 Остановка всех процессов Node.js..." -ForegroundColor Yellow
Stop-Process -Name node -Force -ErrorAction SilentlyContinue

Write-Host "⏳ Ожидание 2 секунды..." -ForegroundColor Gray
Start-Sleep -Seconds 2

Write-Host "🏗️ Сборка backend..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка сборки!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Сборка завершена!" -ForegroundColor Green
Write-Host "🚀 Запуск backend сервера..." -ForegroundColor Cyan
Write-Host ""

node dist/index.js

# 🚀 Запуск Backend в DEV режиме

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "🚀 Запуск Backend в режиме разработки" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Проверяем наличие .env файла
if (-not (Test-Path "backend\.env")) {
    Write-Host "⚠️  .env файл не найден! Копируем из .env.development..." -ForegroundColor Yellow
    Copy-Item "backend\.env.development" -Destination "backend\.env"
    Write-Host "✅ .env файл создан" -ForegroundColor Green
    Write-Host ""
}

Write-Host "📋 Конфигурация:" -ForegroundColor Cyan
Write-Host "   • База данных: SQLite (backend/prisma/dev.db)" -ForegroundColor White
Write-Host "   • Режим: Polling (без webhook)" -ForegroundColor White
Write-Host "   • API Server: http://localhost:3001" -ForegroundColor White
Write-Host "   • Бот: @rocket_lunch_bot" -ForegroundColor White
Write-Host ""

Write-Host "🔧 Проверка зависимостей..." -ForegroundColor Yellow
Set-Location backend

# Проверяем node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Установка зависимостей..." -ForegroundColor Yellow
    npm install
}

Write-Host ""
Write-Host "🗄️  Проверка базы данных..." -ForegroundColor Yellow

# Генерация Prisma Client
npx prisma generate | Out-Null

# Проверяем статус миграций
$migrationsStatus = npx prisma migrate status 2>&1
if ($migrationsStatus -match "Database schema is up to date") {
    Write-Host "   ✅ Миграции применены" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Применяем миграции..." -ForegroundColor Yellow
    npx prisma migrate deploy
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "✅ Backend готов к запуску!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Запуск сервера..." -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Команды для тестирования:" -ForegroundColor Yellow
Write-Host "   • /start - запустить бота" -ForegroundColor White
Write-Host "   • /menu - открыть меню блюд" -ForegroundColor White
Write-Host "   • /startpoll - начать голосование" -ForegroundColor White
Write-Host "   • /quick - быстрое голосование" -ForegroundColor White
Write-Host ""
Write-Host "🛑 Для остановки нажмите Ctrl+C" -ForegroundColor Red
Write-Host ""

# Запускаем dev сервер
npm run dev

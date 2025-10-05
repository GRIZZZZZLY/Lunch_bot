# 🎨 Запуск Frontend в DEV режиме

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "🎨 Запуск Frontend в режиме разработки" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Конфигурация:" -ForegroundColor Cyan
Write-Host "   • Dev Server: http://localhost:5173" -ForegroundColor White
Write-Host "   • API Backend: http://localhost:3001/api" -ForegroundColor White
Write-Host "   • Mock API: ОТКЛЮЧЕН" -ForegroundColor White
Write-Host ""

Write-Host "🔧 Проверка зависимостей..." -ForegroundColor Yellow
Set-Location frontend

# Проверяем node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Установка зависимостей..." -ForegroundColor Yellow
    npm install
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "✅ Frontend готов к запуску!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Запуск dev сервера..." -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Откроется в браузере: http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  ВАЖНО: Для работы с Telegram WebApp нужен HTTPS!" -ForegroundColor Yellow
Write-Host "   Используйте ngrok или другой туннель для тестирования" -ForegroundColor Yellow
Write-Host ""
Write-Host "🛑 Для остановки нажмите Ctrl+C" -ForegroundColor Red
Write-Host ""

# Запускаем dev сервер
npm run dev

# 🚀 Dev Start with ngrok
# Запускает backend, frontend и ngrok туннели

Write-Host "🚀 Starting Telegram Food Bot with ngrok..." -ForegroundColor Cyan
Write-Host ""

# Проверка ngrok
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ngrok не установлен!" -ForegroundColor Red
    Write-Host "Установите: winget install ngrok" -ForegroundColor Yellow
    Write-Host "Или скачайте с: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ ngrok установлен" -ForegroundColor Green

# Проверка что backend и frontend существуют
if (-not (Test-Path "backend\package.json")) {
    Write-Host "❌ Backend не найден!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "frontend\package.json")) {
    Write-Host "❌ Frontend не найден!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Backend и Frontend найдены" -ForegroundColor Green
Write-Host ""

# Проверка node_modules
Write-Host "Проверка зависимостей..." -ForegroundColor Cyan

if (-not (Test-Path "backend\node_modules")) {
    Write-Host "📦 Установка зависимостей backend..." -ForegroundColor Yellow
    Set-Location backend
    npm install
    Set-Location ..
}

if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "📦 Установка зависимостей frontend..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    Set-Location ..
}

Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host "="*70 -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 ВАЖНО: Откроются 4 окна терминала:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1️⃣  Backend Dev Server (порт 3001)" -ForegroundColor White
Write-Host "  2️⃣  Frontend Dev Server (порт 5173)" -ForegroundColor White
Write-Host "  3️⃣  ngrok для Backend (HTTPS туннель)" -ForegroundColor White
Write-Host "  4️⃣  ngrok для Frontend (HTTPS туннель)" -ForegroundColor White
Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host "="*70 -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 ПОСЛЕ ЗАПУСКА:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Скопируйте HTTPS URL из окна ngrok Frontend" -ForegroundColor White
Write-Host "   Пример: https://abc123.ngrok-free.app" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Скопируйте HTTPS URL из окна ngrok Backend" -ForegroundColor White
Write-Host "   Пример: https://xyz789.ngrok-free.app" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Обновите .env файлы:" -ForegroundColor White
Write-Host ""
Write-Host "   backend\.env:" -ForegroundColor Yellow
Write-Host "   WEBAPP_URL=https://FRONTEND_URL" -ForegroundColor Gray
Write-Host "   CORS_ORIGIN=http://localhost:5173,https://FRONTEND_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "   frontend\.env:" -ForegroundColor Yellow
Write-Host "   VITE_API_URL=https://BACKEND_URL/api" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Перезапустите Backend (Ctrl+C в окне 1, затем npm run dev)" -ForegroundColor White
Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host "="*70 -ForegroundColor Cyan
Write-Host ""

$continue = Read-Host "Продолжить? (Y/n)"
if ($continue -eq "n" -or $continue -eq "N") {
    Write-Host "❌ Отменено" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🚀 Запуск сервисов..." -ForegroundColor Green
Write-Host ""

# Запуск Backend
Write-Host "1️⃣  Запуск Backend..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host '🔧 Backend Dev Server' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 2

# Запуск Frontend
Write-Host "2️⃣  Запуск Frontend..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; Write-Host '⚛️  Frontend Dev Server' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 3

# Запуск ngrok для Backend
Write-Host "3️⃣  Запуск ngrok для Backend..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Write-Host '🌐 ngrok Backend Tunnel' -ForegroundColor Magenta; Write-Host ''; Write-Host 'Скопируйте HTTPS URL и обновите backend\.env:' -ForegroundColor Yellow; Write-Host 'WEBAPP_URL и CORS_ORIGIN' -ForegroundColor Yellow; Write-Host ''; ngrok http 3001"

Start-Sleep -Seconds 2

# Запуск ngrok для Frontend
Write-Host "4️⃣  Запуск ngrok для Frontend..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Write-Host '🌐 ngrok Frontend Tunnel' -ForegroundColor Magenta; Write-Host ''; Write-Host 'Скопируйте HTTPS URL и обновите:' -ForegroundColor Yellow; Write-Host '1. backend\.env -> WEBAPP_URL' -ForegroundColor Yellow; Write-Host '2. backend\.env -> CORS_ORIGIN' -ForegroundColor Yellow; Write-Host '3. frontend\.env -> VITE_API_URL' -ForegroundColor Yellow; Write-Host ''; ngrok http 5173"

Write-Host ""
Write-Host "✅ Все сервисы запущены!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Следующие шаги:" -ForegroundColor Yellow
Write-Host "  1. Найдите ngrok URLs в открывшихся окнах" -ForegroundColor White
Write-Host "  2. Обновите .env файлы (см. WEBAPP_SETUP.md)" -ForegroundColor White
Write-Host "  3. Перезапустите Backend" -ForegroundColor White
Write-Host "  4. Откройте бота в Telegram" -ForegroundColor White
Write-Host ""
Write-Host "📖 Подробная инструкция: WEBAPP_SETUP.md" -ForegroundColor Cyan
Write-Host ""

# Dev Start with Proxy + Single ngrok
# Starts backend, frontend, proxy and ONE ngrok tunnel (easier!)

Write-Host "Starting Telegram Food Bot with Proxy..." -ForegroundColor Cyan
Write-Host ""

# Проверка ngrok
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ngrok не установлен!" -ForegroundColor Red
    Write-Host "Установите: winget install ngrok" -ForegroundColor Yellow
    Write-Host "Или скачайте с: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ ngrok установлен" -ForegroundColor Green

# Проверка node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js не установлен!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js установлен" -ForegroundColor Green

# Проверка что backend и frontend существуют
if (-not (Test-Path "backend\package.json")) {
    Write-Host "❌ Backend не найден!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "frontend\package.json")) {
    Write-Host "❌ Frontend не найден!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "proxy-server.js")) {
    Write-Host "❌ proxy-server.js не найден!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Все файлы найдены" -ForegroundColor Green
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

# Проверка http-proxy для proxy-server
Write-Host "Проверка http-proxy..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules\http-proxy")) {
    Write-Host "📦 Установка http-proxy..." -ForegroundColor Yellow
    npm install http-proxy
}

Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host "="*70 -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 ВАРИАНТ С PROXY (РЕКОМЕНДУЕТСЯ)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Откроются 4 окна терминала:" -ForegroundColor White
Write-Host ""
Write-Host "  1️⃣  Backend Dev Server (порт 3001)" -ForegroundColor White
Write-Host "  2️⃣  Frontend Dev Server (порт 5173)" -ForegroundColor White
Write-Host "  3️⃣  Proxy Server (порт 8080) - роутинг" -ForegroundColor White
Write-Host "  4️⃣  ngrok (ОДИН туннель для всего!)" -ForegroundColor White
Write-Host ""
Write-Host "  ✅ Проще: только ОДИН URL для настройки!" -ForegroundColor Green
Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host "="*70 -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 ПОСЛЕ ЗАПУСКА:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Скопируйте HTTPS URL из окна ngrok" -ForegroundColor White
Write-Host "   Пример: https://abc123.ngrok-free.app" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Обновите .env файлы ОДНИМ URL:" -ForegroundColor White
Write-Host ""
Write-Host "   backend\.env:" -ForegroundColor Yellow
Write-Host "   WEBAPP_URL=https://YOUR_NGROK_URL" -ForegroundColor Gray
Write-Host "   CORS_ORIGIN=http://localhost:5173,https://YOUR_NGROK_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "   frontend\.env:" -ForegroundColor Yellow
Write-Host "   VITE_API_URL=https://YOUR_NGROK_URL/api" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Перезапустите Backend (Ctrl+C в окне 1, затем npm run dev)" -ForegroundColor White
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
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host '🔧 Backend Dev Server' -ForegroundColor Green; Write-Host 'http://localhost:3001' -ForegroundColor Cyan; Write-Host ''; npm run dev"

Start-Sleep -Seconds 2

# Запуск Frontend
Write-Host "2️⃣  Запуск Frontend..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; Write-Host '⚛️  Frontend Dev Server' -ForegroundColor Green; Write-Host 'http://localhost:5173' -ForegroundColor Cyan; Write-Host ''; npm run dev"

Start-Sleep -Seconds 3

# Запуск Proxy
Write-Host "3️⃣  Запуск Proxy Server..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host '🔀 Proxy Server' -ForegroundColor Magenta; Write-Host 'http://localhost:8080' -ForegroundColor Cyan; Write-Host ''; Write-Host 'Роутинг:' -ForegroundColor Yellow; Write-Host '  / → Frontend (5173)' -ForegroundColor Gray; Write-Host '  /api → Backend (3001)' -ForegroundColor Gray; Write-Host ''; node proxy-server.js"

Start-Sleep -Seconds 2

# Запуск ngrok для Proxy
Write-Host "4️⃣  Запуск ngrok..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Write-Host '🌐 ngrok Tunnel' -ForegroundColor Magenta; Write-Host ''; Write-Host '════════════════════════════════════════' -ForegroundColor Cyan; Write-Host '📋 СКОПИРУЙТЕ ЭТОТ URL:' -ForegroundColor Yellow; Write-Host '════════════════════════════════════════' -ForegroundColor Cyan; Write-Host ''; ngrok http 8080; Write-Host ''; Write-Host '════════════════════════════════════════' -ForegroundColor Cyan; Write-Host 'Обновите .env файлы этим URL' -ForegroundColor Yellow; Write-Host '════════════════════════════════════════' -ForegroundColor Cyan"

Write-Host ""
Write-Host "✅ Все сервисы запущены!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Следующие шаги:" -ForegroundColor Yellow
Write-Host "  1. Найдите ngrok URL в последнем окне (https://xxx.ngrok-free.app)" -ForegroundColor White
Write-Host "  2. Обновите backend\.env:" -ForegroundColor White
Write-Host "     WEBAPP_URL=https://xxx.ngrok-free.app" -ForegroundColor Gray
Write-Host "     CORS_ORIGIN=...,https://xxx.ngrok-free.app" -ForegroundColor Gray
Write-Host "  3. Обновите frontend\.env:" -ForegroundColor White
Write-Host "     VITE_API_URL=https://xxx.ngrok-free.app/api" -ForegroundColor Gray
Write-Host "  4. Перезапустите Backend (окно 1: Ctrl+C, потом npm run dev)" -ForegroundColor White
Write-Host "  5. Откройте бота в Telegram и нажмите Menu Button!" -ForegroundColor White
Write-Host ""
Write-Host "📖 Подробная инструкция: WEBAPP_SETUP.md" -ForegroundColor Cyan
Write-Host ""

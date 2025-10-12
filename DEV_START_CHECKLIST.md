# ✅ Чеклист перед запуском start-dev.ps1

## 🎯 Быстрая проверка (2 минуты)

### ✅ 1. Telegram API - Прокси настроен?

**Проверка:** Telegram API доступен?

```powershell
# Быстрый тест
curl https://api.telegram.org/
```

**Если ошибка (ETIMEDOUT):**
```powershell
# Откройте backend/.env.development
# Настройте прокси:
USE_PROXY=true
PROXY_URL=http://your-proxy:8080
```

**Или просто включите VPN** (проще всего!)

📖 Полная инструкция: `TELEGRAM_API_FIX.md`

---

### ✅ 2. Зависимости установлены?

```powershell
cd telegram-food-bot

# Проверка
Test-Path backend\node_modules
Test-Path frontend\node_modules
Test-Path node_modules\http-proxy
```

**Если что-то False:**
```powershell
# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..

# Proxy
npm install http-proxy
```

---

### ✅ 3. Backend скомпилирован?

```powershell
# Проверка
Test-Path backend\dist\index.js
```

**Если False:**
```powershell
cd backend
npm run build
cd ..
```

---

### ✅ 4. ngrok установлен?

```powershell
# Проверка
ngrok version
```

**Если ошибка:**
```powershell
# Установка
winget install ngrok

# Или без ngrok:
.\start-dev.ps1 -NoNgrok
```

---

## 🚀 Готовы? Запускайте!

Всё зелёное? ✅ Тогда:

```powershell
cd E:\BOT_V2\Lunch_bot_V2\telegram-food-bot
.\start-dev.ps1
```

---

## 📋 Что должно произойти

### Откроются 5 окон:

1. **Backend (port 3001)** - Должен показать:
   ```
   ✅ Webhook удален
   🤖 Бот инициализирован
   🚀 Бот запущен в polling режиме
   ```

2. **Frontend (port 5173)** - Должен показать:
   ```
   VITE v4.5.x ready in xxx ms
   ➜ Local:   http://localhost:5173/
   ```

3. **Proxy (port 8080)** - Должен показать:
   ```
   Proxy server running on port 8080
   ```

4. **ngrok** - Покажет HTTPS URL:
   ```
   Forwarding https://something.ngrok-free.app -> http://localhost:8080
   ```

5. **URL Updater** - Спросит URL:
   ```
   Paste ngrok URL:
   ```

---

## ⚙️ Процесс настройки

### Шаг 1: Скопируйте ngrok URL
Из окна 4 (ngrok) скопируйте HTTPS URL:
```
https://something.ngrok-free.app
```

### Шаг 2: Вставьте в URL Updater
В окне 5 (URL Updater) вставьте URL и нажмите Enter

### Шаг 3: Подождите автоматическую настройку
URL Updater автоматически:
- ✅ Обновит backend/.env
- ✅ Обновит frontend/.env
- ✅ Перезапустит backend

### Шаг 4: Откройте бота в Telegram
- Откройте @rocket_lunch_bot
- Нажмите кнопку "Menu"
- WebApp должен открыться! 🎉

---

## 🚨 Частые проблемы

### Backend: "ETIMEDOUT 149.154.167.220:443"

**Причина:** Telegram API заблокирован

**Решение:**
1. Включите VPN
2. Или настройте прокси в `backend/.env.development`:
   ```bash
   USE_PROXY=true
   PROXY_URL=http://your-proxy:8080
   ```
3. Перезапустите backend (закройте окно и запустите start-dev.ps1 снова)

📖 См. `TELEGRAM_API_FIX.md`

---

### Frontend: Port 5173 уже занят

**Причина:** Другой процесс использует порт

**Решение:**
```powershell
# Найти процесс
netstat -ano | findstr :5173

# Убить процесс (PID из предыдущей команды)
taskkill /PID <PID> /F
```

---

### Proxy: "EADDRINUSE: address already in use :::8080"

**Причина:** Порт 8080 занят

**Решение:**
```powershell
# Найти процесс
netstat -ano | findstr :8080

# Убить процесс
taskkill /PID <PID> /F
```

---

### ngrok: "command not found"

**Причина:** ngrok не установлен

**Решение:**
```powershell
# Установка
winget install ngrok

# Или запуск без ngrok (только локально)
.\start-dev.ps1 -NoNgrok
```

---

### WebApp: "Invalid Telegram hash"

**Причина:** `SKIP_TELEGRAM_VALIDATION=false` в .env

**Решение:**
Откройте `backend/.env` и измените:
```bash
SKIP_TELEGRAM_VALIDATION=true
```

Перезапустите backend.

---

### WebApp не открывается в Telegram

**Причина:** URL не обновлен

**Решение:**
1. Убедитесь, что вы выполнили шаги в URL Updater (окно 5)
2. Проверьте `backend/.env`:
   ```bash
   WEBAPP_URL=https://your-ngrok-url.ngrok-free.app
   ```
3. Перезапустите backend

---

## 💡 Советы

### Автоматический перезапуск
- Backend перезапускается автоматически при изменении `.ts` файлов (nodemon)
- Frontend перезапускается автоматически (HMR)
- Proxy нужно перезапускать вручную при изменениях

### Логи
- Backend логи в окне 1
- Frontend логи в окне 2
- Ошибки сети в окне 3 (Proxy)

### Остановка
Закройте все 5 окон (или нажмите Ctrl+C в каждом)

---

## 📚 Дополнительная документация

- **Быстрый старт:** `QUICK_START.md`
- **Прокси для Telegram API:** `TELEGRAM_API_FIX.md`
- **Сравнение скриптов:** `START_SCRIPTS_GUIDE.md`
- **Troubleshooting:** `MOBILE_TROUBLESHOOTING.md`

---

## 🎉 Всё работает?

После успешного запуска вы увидите:
- ✅ Backend: `🚀 Бот запущен в polling режиме`
- ✅ Frontend: `➜ Local: http://localhost:5173/`
- ✅ Proxy: `Proxy server running on port 8080`
- ✅ ngrok: `Forwarding https://...`
- ✅ Telegram: WebApp открывается при нажатии "Menu"

**Готовы к разработке! 🚀**

---

## ⚡ Быстрые команды

```powershell
# Запуск с проверками
.\start-dev.ps1

# Запуск без проверок (быстрее)
.\start-dev.ps1 -SkipChecks

# Запуск без ngrok (только локально)
.\start-dev.ps1 -NoNgrok

# Полная пересборка
cd backend
npm run build
cd ../frontend
npm run build
cd ..
.\start-dev.ps1
```

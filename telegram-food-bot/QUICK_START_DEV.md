# 🚀 Быстрый старт Dev окружения

## Проблема: "Проект не открывается"

Если вы запустили только `npm run dev` в backend - это только сервер API.
Для работы нужны **frontend + backend + proxy + ngrok**.

---

## ✅ Решение 1: Автоматический запуск (РЕКОМЕНДУЕТСЯ)

### Один скрипт запускает всё:

```powershell
# Откройте PowerShell в папке telegram-food-bot
cd E:\Lunch_bot\telegram-food-bot

# Запустите dev окружение:
.\start-dev.ps1
```

**Что произойдет:**
- Откроется 5 окон терминала
- Backend запустится на http://localhost:3001
- **Frontend откроется автоматически** на http://localhost:5173 👈
- Proxy на http://localhost:8080
- ngrok создаст HTTPS туннель
- URL Updater покажет инструкции

---

## ✅ Решение 2: Ручной запуск (если скрипт не работает)

### Шаг 1: Backend (уже работает у вас)
```powershell
cd telegram-food-bot\backend
npm run dev
# Должно быть: "🚀 Бот запущен в polling режиме"
```

### Шаг 2: Frontend (откройте новое окно PowerShell)
```powershell
cd telegram-food-bot\frontend
npm run dev
# Должно быть: "Local: http://localhost:5173"
```

### Шаг 3: Откройте в браузере
```
http://localhost:5173
```

---

## 🌐 Как открыть приложение:

### В браузере (локально):
- Frontend: http://localhost:5173 ← **Откройте этот URL!**
- Backend API: http://localhost:3001
- Proxy: http://localhost:8080

### В Telegram (через Mini App):
1. Запустите ngrok: `ngrok http 5173`
2. Скопируйте HTTPS URL (например: https://abc123.ngrok-free.app)
3. Обновите webhook бота (используйте URL Updater из start-dev.ps1)
4. Откройте @rocket_lunch_bot в Telegram
5. Нажмите "Menu" → откроется Mini App

---

## ❌ Распространённые проблемы:

### 1. "Cannot GET /" или белый экран
**Причина:** Frontend не запущен
**Решение:** Запустите `npm run dev` в `telegram-food-bot/frontend`

### 2. "ERR_CONNECTION_REFUSED" на :5173
**Причина:** Frontend не стартовал или порт занят
**Решение:** 
- Проверьте логи frontend
- Освободите порт 5173 или измените в vite.config.ts

### 3. Backend работает, но API не отвечает
**Причина:** CORS или неправильный URL
**Решение:** 
- Проверьте VITE_API_URL в frontend/.env
- Должно быть: `VITE_API_URL=http://localhost:3001`

### 4. Telegram API ECONNRESET
**Причина:** Telegram API заблокирован
**Решение:** 
- Включите VPN
- См. [TELEGRAM_API_FIX.md](TELEGRAM_API_FIX.md)

---

## 🔍 Проверка что всё работает:

### Backend работает если видите:
```
✅ Бот инициализирован
✅ Webhook удален
✅ Menu button установлена
🚀 Бот запущен в polling режиме
```

### Frontend работает если:
```
VITE v6.4.0  ready in 500 ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Приложение открылось если:
- В браузере видите интерфейс приложения
- Нет ошибок в консоли (F12)
- API запросы успешны (Network tab в DevTools)

---

## 📚 Дополнительная информация:

- Полная документация: [CLAUDE.md](../CLAUDE.md)
- Режимы работы: [MODES-COMPARISON.md](MODES-COMPARISON.md)
- Тестирование: [TESTING_INSTRUCTIONS.md](../TESTING_INSTRUCTIONS.md)
- VPS деплой: [START_HERE.md](../START_HERE.md)

---

## 💡 Pro Tips:

1. **Используйте start-dev.ps1** - это самый простой способ
2. **Следите за логами** во всех окнах
3. **Проверяйте ngrok URL** - он меняется при перезапуске
4. **Включите VPN** если Telegram API заблокирован
5. **Очищайте кэш браузера** если видите старую версию

---

**Нужна помощь?** Проверьте [TELEGRAM_API_FIX.md](TELEGRAM_API_FIX.md)

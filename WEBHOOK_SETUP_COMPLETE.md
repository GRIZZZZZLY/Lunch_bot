# ✅ Webhook успешно настроен!

## 📊 Текущее состояние

✅ **Webhook установлен**
- URL: `https://2072f129141b.ngrok-free.app/webhook`
- Статус: Активен
- Pending Updates: 0

## 🎯 Что настроено:

### 1. Frontend
- ✅ API URL: `https://2072f129141b.ngrok-free.app/api`
- ✅ Vite allowedHosts настроен для ngrok
- ✅ CORS настроен

### 2. Backend  
- ✅ Webhook URL установлен
- ✅ CORS разрешает запросы с ngrok и Telegram
- ✅ Telegram webhook активен

### 3. Скрипты для управления
- ✅ `set-webhook-now.ps1` - быстрая установка webhook
- ✅ `check-webhook.ps1` - проверка статуса webhook
- ✅ `delete-webhook.ps1` - удаление webhook
- ✅ `update-ngrok-url.ps1` - обновление URL во всех файлах

---

## 🚀 Запуск проекта

### 1. Запустите Backend:
```bash
cd C:\BOT_V2\telegram-food-bot\backend
npm run dev
```
Должен запуститься на `http://localhost:3001`

### 2. Запустите Frontend:
```bash
cd C:\BOT_V2\telegram-food-bot\frontend
npm run dev
```
Должен запуститься на `http://localhost:5173`

### 3. Убедитесь, что ngrok запущен:
```bash
ngrok http 3001
```
**Важно:** Если URL изменится, запустите:
```powershell
.\update-ngrok-url.ps1 -NewUrl "https://НОВЫЙ-URL.ngrok-free.app"
.\set-webhook-now.ps1
```

---

## 🧪 Тестирование

### 1. Проверьте health endpoint:
```bash
curl http://localhost:3001/health
curl https://2072f129141b.ngrok-free.app/health
```

### 2. Проверьте webhook статус:
```powershell
.\check-webhook.ps1
```

### 3. Откройте бота в Telegram:
- Найдите: `@rocket_lunch_bot`
- Отправьте: `/start`
- Проверьте логи backend - должны прийти webhook события

### 4. Откройте Mini App:
- В боте нажмите на кнопку Menu
- Или отправьте команду боту
- Должен открыться Mini App с вашим интерфейсом

---

## 🔧 Управление Webhook

### Проверить статус:
```powershell
.\check-webhook.ps1
```
Показывает:
- Текущий URL webhook
- Количество ожидающих обновлений
- Последние ошибки (если есть)
- Статус подключения к backend

### Переустановить webhook:
```powershell
.\set-webhook-now.ps1
```
Автоматически:
- Читает URL из `backend/.env`
- Устанавливает webhook
- Проверяет статус

### Удалить webhook (для разработки без ngrok):
```powershell
.\delete-webhook.ps1
```
Переключает бота в режим long polling.
Полезно для локальной разработки.

---

## 🐛 Решение проблем

### Webhook не получает события

1. **Проверьте backend:**
   ```bash
   curl http://localhost:3001/health
   # Должен вернуть: {"status":"ok",...}
   ```

2. **Проверьте ngrok:**
   ```bash
   curl https://2072f129141b.ngrok-free.app/health
   # Должен вернуть тот же ответ
   ```

3. **Проверьте webhook:**
   ```powershell
   .\check-webhook.ps1
   ```
   Если есть ошибки - переустановите:
   ```powershell
   .\set-webhook-now.ps1
   ```

### Mini App не открывается

1. **Проверьте URL в BotFather:**
   - Откройте @BotFather
   - `/mybots` → @rocket_lunch_bot → Bot Settings → Menu Button
   - URL должен быть: `https://2072f129141b.ngrok-free.app`

2. **Проверьте frontend:**
   ```bash
   curl http://localhost:5173
   # Должен вернуть HTML страницу
   ```

3. **Проверьте .env файлы:**
   ```bash
   # frontend/.env
   VITE_API_URL=https://2072f129141b.ngrok-free.app/api
   
   # backend/.env
   CORS_ORIGIN=http://localhost:5173,https://2072f129141b.ngrok-free.app,https://web.telegram.org
   ```

### CORS ошибки

1. **Перезапустите backend** после изменения `.env`
2. **Проверьте CORS_ORIGIN** в `backend/.env` - должен содержать ваш ngrok URL
3. **Очистите кеш браузера** или Telegram

### ngrok URL изменился

1. **Обновите конфигурацию:**
   ```powershell
   .\update-ngrok-url.ps1 -NewUrl "https://НОВЫЙ-URL.ngrok-free.app"
   ```

2. **Переустановите webhook:**
   ```powershell
   .\set-webhook-now.ps1
   ```

3. **Обновите URL в BotFather** (Menu Button)

4. **Перезапустите сервисы**

---

## 📋 Чеклист перед деплоем

- [ ] Backend запущен и отвечает на `/health`
- [ ] Frontend запущен и доступен
- [ ] ngrok туннель активен
- [ ] Webhook установлен (`.\check-webhook.ps1` без ошибок)
- [ ] URL в BotFather обновлён
- [ ] Тестовое сообщение боту проходит
- [ ] Mini App открывается
- [ ] API запросы из Mini App работают

---

## 🎓 Полезные команды

### Проверка backend:
```bash
# Локально
curl http://localhost:3001/health
curl http://localhost:3001/api/menu

# Через ngrok
curl https://2072f129141b.ngrok-free.app/health
curl https://2072f129141b.ngrok-free.app/api/menu
```

### Проверка frontend:
```bash
# Локально
curl http://localhost:5173

# Через ngrok
curl https://2072f129141b.ngrok-free.app
```

### Логи Docker:
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Перезапуск с очисткой:
```bash
# Backend
cd backend
rm -rf node_modules/.cache dist
npm run dev

# Frontend  
cd frontend
rm -rf node_modules/.vite dist
npm run dev
```

---

## 📞 Следующие шаги

1. **Протестируйте все функции:**
   - Отправка сообщений боту
   - Открытие Mini App
   - CRUD операции с меню
   - Создание голосований

2. **Настройте постоянный URL** (см. `NGROK_SETUP.md`):
   - ngrok Personal план ($8/мес)
   - Или собственный VPS

3. **Настройте CI/CD** для автоматического деплоя

4. **Добавьте мониторинг** для отслеживания ошибок

---

## 🎉 Готово!

Ваш Telegram Food Bot готов к использованию!

- Бот: [@rocket_lunch_bot](https://t.me/rocket_lunch_bot)
- Mini App: `https://2072f129141b.ngrok-free.app`
- API: `https://2072f129141b.ngrok-free.app/api`
- Webhook: ✅ Активен

**Документация:**
- `QUICK_START.md` - быстрый старт
- `NGROK_SETUP.md` - настройка постоянного URL
- `README.md` - общая информация о проекте

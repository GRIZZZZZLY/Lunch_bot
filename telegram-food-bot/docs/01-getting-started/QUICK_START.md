# 🚀 Быстрый старт

## Текущая конфигурация
- **ngrok URL**: `https://2072f129141b.ngrok-free.app`
- **Backend**: `http://localhost:3001`
- **Frontend**: `http://localhost:5173`

## 📝 Когда ngrok URL меняется:

### Вариант 1: Ручное обновление (самый простой)

#### 1. Обновите frontend/.env:
```env
VITE_API_URL=https://НОВЫЙ-URL.ngrok-free.app/api
```

#### 2. Обновите backend/.env:
```env
BOT_WEBHOOK_URL=https://НОВЫЙ-URL.ngrok-free.app/webhook
CORS_ORIGIN=http://localhost:5173,https://НОВЫЙ-URL.ngrok-free.app,https://web.telegram.org
```

#### 3. Обновите frontend/.env.production:
```env
VITE_API_URL=https://НОВЫЙ-URL.ngrok-free.app/api
```

### Вариант 2: PowerShell скрипт (автоматический)

```powershell
# В корневой папке проекта
.\update-ngrok-url.ps1 -NewUrl "https://НОВЫЙ-URL.ngrok-free.app"
```

---

## ▶️ Запуск проекта

### Backend:
```bash
cd telegram-food-bot/backend
npm run dev
```

### Frontend:
```bash
cd telegram-food-bot/frontend
npm run dev
```

### Или через Docker:
```bash
cd telegram-food-bot
docker-compose up -d
```

---

## ⚙️ Настройка в BotFather

1. Откройте [@BotFather](https://t.me/BotFather)
2. Отправьте `/mybots`
3. Выберите вашего бота: **@rocket_lunch_bot**
4. Нажмите **Bot Settings** → **Menu Button**
5. Укажите URL: `https://2072f129141b.ngrok-free.app`

---

## 🔗 Установка Webhook

### Автоматически (PowerShell):
```powershell
.\set-webhook-now.ps1
```

### Или проверить статус:
```powershell
.\check-webhook.ps1
```

### Или удалить webhook (для разработки без ngrok):
```powershell
.\delete-webhook.ps1
```

### Вручную (curl):
```bash
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://2072f129141b.ngrok-free.app/webhook"
```

---

## 🛠️ Решение проблем

### "Хост не разрешён" (Host not allowed)
✅ **Исправлено!** В `vite.config.ts` добавлены `allowedHosts` для всех ngrok доменов.

### CORS ошибки
✅ **Исправлено!** Backend настроен на прием запросов с ngrok и Telegram.

### Frontend не подключается к API
1. Проверьте, что backend запущен: `http://localhost:3001/health`
2. Проверьте `VITE_API_URL` в `frontend/.env`
3. Перезапустите frontend после изменения `.env`

### Webhook не работает
1. Убедитесь, что backend запущен
2. Проверьте, что ngrok туннель активен
3. Установите webhook заново (команда выше)

---

## 📋 Чеклист перед тестированием

- [ ] Backend запущен (`http://localhost:3001/health` отвечает)
- [ ] Frontend запущен (`http://localhost:5173` открывается)
- [ ] ngrok туннель активен
- [ ] URL обновлён во всех `.env` файлах
- [ ] URL обновлён в BotFather (Menu Button)
- [ ] Webhook установлен
- [ ] Проверен `getWebhookInfo` - нет ошибок

---

## 🔄 При каждом перезапуске ngrok:

1. Получите новый URL: `ngrok http 3001`
2. Запустите скрипт: `.\update-ngrok-url.ps1 -NewUrl "https://НОВЫЙ-URL.ngrok-free.app"`
3. Перезапустите backend и frontend
4. Обновите URL в BotFather
5. Установите webhook заново

---

## 💡 Полезные команды

### Проверка статуса API:
```bash
curl http://localhost:3001/health
```

### Проверка статуса ngrok:
```bash
curl https://2072f129141b.ngrok-free.app/health
```

### Перезапуск с очисткой кеша (Frontend):
```bash
cd frontend
rm -rf node_modules/.vite
npm run dev
```

### Перезапуск Docker:
```bash
docker-compose down
docker-compose up -d --build
```

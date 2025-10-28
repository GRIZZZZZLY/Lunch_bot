# ✅ Production Build Готов к Деплою!

**Дата:** 2025-10-28  
**Проект:** Telegram Food Bot

---

## 📦 Что Собрано

### Backend Build
- ✅ **Размер:** 1.08 MB
- ✅ **Файлов:** 342
- ✅ **Расположение:** `backend/dist/`
- ✅ **Entry point:** `backend/dist/index.js`
- ✅ **TypeScript:** Скомпилирован с `tsconfig.production.json`

### Frontend Build  
- ✅ **Размер:** 1.45 MB
- ✅ **Файлов:** 26
- ✅ **Расположение:** `frontend/dist/`
- ✅ **Entry point:** `frontend/dist/index.html`
- ✅ **Vite:** Production build с оптимизацией

### Configuration
- ✅ **`.env.production`** создан в `backend/`
- ⚠️ **ВАЖНО:** Замените в `.env.production`:
  - `BOT_WEBHOOK_URL=https://your-domain.com/webhook`
  - `WEBAPP_URL=https://your-domain.com`
  - `CORS_ORIGIN=https://your-domain.com`

---

## 🎯 Следующие Шаги

### Шаг 1: Обновите .env.production

```bash
# Откройте файл
notepad E:\Lunch_bot\telegram-food-bot\backend\.env.production

# Замените:
# - your-domain.com на ваш реальный домен
# - или IP адрес VPS если домена нет
```

### Шаг 2: Архивируйте для загрузки на VPS

```powershell
cd E:\Lunch_bot

# Создайте архив (исключая ненужные файлы)
tar -czf telegram-food-bot-production.tar.gz `
  --exclude="telegram-food-bot/node_modules" `
  --exclude="telegram-food-bot/backend/node_modules" `
  --exclude="telegram-food-bot/frontend/node_modules" `
  --exclude="telegram-food-bot/backend/src" `
  --exclude="telegram-food-bot/frontend/src" `
  --exclude="telegram-food-bot/backend/logs" `
  --exclude="telegram-food-bot/backend/prisma/dev.db" `
  --exclude="telegram-food-bot/.git" `
  --exclude="telegram-food-bot/*.md" `
  --exclude="telegram-food-bot/*.ps1" `
  --exclude="telegram-food-bot/*.png" `
  --exclude="telegram-food-bot/*.jpg" `
  telegram-food-bot
```

### Шаг 3: Загрузите на VPS

```powershell
# Скопируйте архив на сервер
scp telegram-food-bot-production.tar.gz igor@vm-v2-mini:~/

# Подключитесь к серверу
ssh igor@vm-v2-mini

# Распакуйте
cd ~
tar -xzf telegram-food-bot-production.tar.gz
```

### Шаг 4: Установите зависимости на VPS

```bash
cd ~/telegram-food-bot/backend

# Установите только production зависимости
npm ci --production

# Сгенерируйте Prisma Client
npm run db:generate

# Создайте БД
npm run db:push

# Заполните меню
npm run db:seed

# Сделайте себя админом
npm run make-admin
```

### Шаг 5: Запустите с PM2

```bash
cd ~/telegram-food-bot

# Создайте ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'food-bot-backend',
      script: './backend/dist/index.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
    },
  ],
};
EOF

# Запустите
pm2 start ecosystem.config.js

# Автозапуск при перезагрузке
pm2 startup
pm2 save
```

---

## 📋 Проверочный Чеклист

### Локальная Машина
- [x] Backend build создан (`backend/dist/`)
- [x] Frontend build создан (`frontend/dist/`)
- [x] `.env.production` создан
- [ ] Домен указан в `.env.production`
- [ ] Архив создан
- [ ] Архив загружен на VPS

### На VPS
- [ ] Node.js 22.x установлен
- [ ] PM2 установлен
- [ ] Nginx установлен
- [ ] Проект распакован
- [ ] Зависимости установлены
- [ ] БД создана и заполнена
- [ ] PM2 запущен
- [ ] Nginx настроен
- [ ] SSL сертификат установлен
- [ ] Webhook установлен

### Проверка Работы
- [ ] Backend отвечает на `curl http://localhost:3001/health`
- [ ] Frontend открывается через домен
- [ ] Бот отвечает в Telegram
- [ ] Mini App открывается
- [ ] Голосование работает

---

## 🔍 Структура Архива

```
telegram-food-bot/
├── backend/
│   ├── dist/               # ✅ Собранный backend (342 файла, 1.08 MB)
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .env.production     # ✅ Production конфиг
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   ├── dist/               # ✅ Собранный frontend (26 файлов, 1.45 MB)
│   │   ├── index.html
│   │   └── assets/
│   │       ├── css/
│   │       └── js/
│   └── package.json
│
└── ecosystem.config.js     # Будет создан на VPS
```

---

## ⚠️ Важные Напоминания

### 🔴 Критично

1. **В `.env.production` замените `your-domain.com`** на реальный домен
2. **`SKIP_TELEGRAM_VALIDATION=false`** - ВСЕГДА в продакшене!
3. **`NODE_ENV=production`** - обязательно
4. **Webhook URL** должен быть HTTPS (не HTTP)

### 🟡 Рекомендуется

1. Настройте Nginx для reverse proxy
2. Установите SSL сертификат через Let's Encrypt
3. Настройте firewall (UFW)
4. Настройте автоматические бэкапы БД
5. Настройте мониторинг через PM2 Plus

### 🟢 Опционально

1. Настройте CI/CD через GitHub Actions
2. Используйте Docker для изоляции
3. Настройте CDN для статики
4. Настройте логирование в Sentry

---

## 📞 Поддержка

Если возникнут проблемы:

1. **Проверьте логи PM2:** `pm2 logs food-bot-backend`
2. **Проверьте Nginx:** `sudo nginx -t`
3. **Проверьте webhook:** `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
4. **Проверьте порт:** `netstat -tulpn | grep 3001`

---

**Готово к деплою! 🚀**

Следуйте инструкциям в `VPS_DEPLOYMENT_GUIDE.md`

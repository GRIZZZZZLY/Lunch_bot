# ✅ Production Deployment Checklist

Быстрый чек-лист для развертывания в production.

---

## 📋 Перед началом

```bash
□ Код протестирован локально
□ TypeScript компилируется без ошибок
□ .env файлы подготовлены
□ Домен куплен и настроен DNS
□ VPS сервер арендован
□ SSH доступ к серверу настроен
```

---

## 🖥️ Настройка сервера

```bash
□ Обновлена система: apt update && apt upgrade
□ Создан пользователь deployer (не root!)
□ Установлен Node.js 20.x
□ Установлен PM2: npm install -g pm2
□ Установлен Nginx
□ Установлен PostgreSQL (если используется)
□ Настроен файрвол (UFW)
```

---

## 🔐 Безопасность

```bash
□ NODE_ENV=production
□ SKIP_TELEGRAM_VALIDATION=false
□ JWT_SECRET сгенерирован (128+ символов)
□ Файлы .env имеют права 600
□ SSH доступ только по ключу (не пароль)
□ Firewall настроен (порты 22, 80, 443)
□ Установлен fail2ban (опционально)
```

---

## 🗄️ База данных

```bash
□ База данных создана
□ DATABASE_URL настроен в .env
□ Prisma миграции выполнены: npx prisma migrate deploy
□ Тестовое подключение работает
□ Настроены автоматические бэкапы
```

---

## 🔧 Код и зависимости

```bash
□ Код клонирован на сервер
□ Backend зависимости установлены: npm ci --production
□ Frontend зависимости установлены: npm ci
□ Backend собран: npm run build
□ Frontend собран: npm run build
□ dist папки созданы
```

---

## 🌐 Nginx и SSL

```bash
□ Конфигурация Nginx создана
□ Симлинк в sites-enabled создан
□ nginx -t проходит без ошибок
□ SSL сертификат получен: certbot --nginx
□ Настроен редирект HTTP → HTTPS
□ Настроен proxy_pass для API
□ Настроен webhook эндпоинт
```

---

## 🚀 Запуск приложения

```bash
□ ecosystem.config.js создан
□ .env.production скопирован в .env
□ Приложение запущено: pm2 start ecosystem.config.js
□ pm2 save выполнен
□ pm2 startup настроен
□ pm2 status показывает "online"
```

---

## 📡 Telegram настройка

```bash
□ BOT_TOKEN установлен в .env
□ BOT_WEBHOOK_URL настроен правильно
□ Webhook установлен: node set-webhook.js
□ Webhook проверен: node check-webhook.js
□ Menu Button обновлен: node update-menu-button.js
□ Бот отвечает на команды
```

---

## 🧪 Тестирование

```bash
□ Frontend открывается: https://your-domain.com
□ API отвечает: curl https://your-domain.com/api/health
□ SSL валиден: curl -I https://your-domain.com
□ /start команда работает в боте
□ Mini App открывается через Menu Button
□ Авторизация через Telegram работает
□ Создание голосования работает
□ Голосование в группе работает
□ Уведомления приходят
```

---

## 📊 Мониторинг

```bash
□ PM2 мониторинг настроен
□ Логи пишутся корректно
□ Ротация логов настроена
□ Бэкапы БД работают (cron)
□ Проверен доступ к логам
```

---

## ✅ Финальная проверка

### Выполнить все команды:

```bash
# 1. Проверка статуса
pm2 status
sudo systemctl status nginx

# 2. Проверка логов (без ошибок)
pm2 logs rocket-lunch-bot --lines 20
sudo tail -20 /var/log/nginx/rocket-lunch-bot.error.log

# 3. Проверка webhook
cd ~/telegram-food-bot/backend
node check-webhook.js

# 4. Проверка API
curl https://your-domain.com/api/health

# 5. Проверка SSL
curl -I https://your-domain.com
```

### Проверка через Telegram:

```
1. □ Отправить /start боту
2. □ Бот ответил приветствием
3. □ Нажать на Menu Button
4. □ Mini App открылся
5. □ Авторизация прошла
6. □ Создать тестовое голосование в группе
7. □ Проголосовать
8. □ Проверить что голос засчитан
9. □ Завершить голосование
10. □ Проверить результаты
```

---

## 🔄 Обновления в будущем

Создайте скрипт `~/deploy.sh`:

```bash
#!/bin/bash
cd ~/telegram-food-bot
git pull origin main
cd backend && npm ci --production && npm run build
cd ../frontend && npm ci && npm run build
pm2 restart rocket-lunch-bot
sudo systemctl reload nginx
echo "✅ Deployment completed!"
```

Запуск обновления:
```bash
~/deploy.sh
```

---

## ❌ Если что-то не работает

### Бот не отвечает:
```bash
pm2 logs rocket-lunch-bot
pm2 restart rocket-lunch-bot
```

### 502 Bad Gateway:
```bash
pm2 status  # Должен быть online
sudo systemctl status nginx
```

### Webhook не работает:
```bash
node check-webhook.js
node set-webhook.js
sudo tail -f /var/log/nginx/rocket-lunch-bot.error.log
```

### Mini App не открывается:
```bash
# Проверить WEBAPP_URL
grep WEBAPP_URL ~/telegram-food-bot/backend/.env
# Должен быть: https://your-domain.com

# Обновить Menu Button
node update-menu-button.js
```

---

## 📞 Важные команды

```bash
# Логи в реальном времени
pm2 logs rocket-lunch-bot

# Статус всех сервисов
pm2 status
sudo systemctl status nginx

# Перезапуск
pm2 restart rocket-lunch-bot
sudo systemctl restart nginx

# Проверка webhook
cd ~/telegram-food-bot/backend && node check-webhook.js

# Бэкап БД
~/backup-db.sh
```

---

## 🎯 Критически важные настройки

**В production ОБЯЗАТЕЛЬНО:**

```bash
NODE_ENV=production
SKIP_TELEGRAM_VALIDATION=false
JWT_SECRET=длинный_случайный_ключ
CORS_ORIGIN=https://your-domain.com
BOT_MODE=webhook
BOT_WEBHOOK_URL=https://your-domain.com/api/webhook
```

**НИКОГДА в production:**

```bash
SKIP_TELEGRAM_VALIDATION=true  ❌
NODE_ENV=development  ❌
VITE_USE_MOCK_API=true  ❌
```

---

## 🎉 Готово!

Если все пункты отмечены ✅ - ваш бот успешно развернут в production!

**Следующие шаги:**
- Мониторьте логи первые 24 часа
- Проверяйте использование ресурсов
- Делайте регулярные бэкапы
- Обновляйте зависимости раз в месяц

**Удачи! 🚀**

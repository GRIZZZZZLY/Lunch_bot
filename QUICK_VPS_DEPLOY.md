# ⚡ Быстрый Деплой на VPS - Шпаргалка

**Домен:** `rocket-lunch.duckdns.org`

---

## 🚀 Экспресс-деплой (5 минут)

### 1️⃣ На локальной машине

```bash
# Убедитесь, что все изменения закоммичены
cd E:\Lunch_bot\telegram-food-bot
git status

# Запушьте изменения (если есть)
git add .
git commit -m "Подготовка к деплою"
git push origin feature/new_version
```

### 2️⃣ На VPS - Первый деплой

```bash
# Подключитесь к VPS
ssh root@YOUR_VPS_IP

# Установите зависимости (только первый раз)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx
npm install -g pm2

# Клонируйте репозиторий
cd /root
git clone YOUR_REPO_URL telegram-food-bot
cd telegram-food-bot

# ⚠️ ВАЖНО: Переключитесь на ветку feature/new_version
git checkout feature/new_version

# Получите SSL сертификат
systemctl stop nginx
certbot certonly --standalone -d rocket-lunch.duckdns.org
systemctl start nginx

# Запустите деплой
chmod +x deploy-vps.sh
./deploy-vps.sh

# Настройте Nginx
cp nginx-vps.conf /etc/nginx/sites-available/rocket-lunch-bot
ln -s /etc/nginx/sites-available/rocket-lunch-bot /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Установите webhook
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -d "url=https://rocket-lunch.duckdns.org/webhook"

# Установите Menu Button
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{"menu_button":{"type":"web_app","text":"🍴 Открыть меню","web_app":{"url":"https://rocket-lunch.duckdns.org"}}}'
```

---

## 🔄 Обновление приложения

```bash
# На VPS
ssh root@YOUR_VPS_IP
cd /root/telegram-food-bot

# Получите последние изменения из feature/new_version
git pull origin feature/new_version

# Запустите деплой
./deploy-vps.sh

# Готово! PM2 автоматически перезапустит приложение
```

---

## 🛠️ Основные команды

```bash
# Статус
pm2 status

# Логи
pm2 logs rocket-lunch-bot

# Перезапуск
pm2 restart rocket-lunch-bot

# Остановка
pm2 stop rocket-lunch-bot

# Запуск
pm2 start rocket-lunch-bot

# Мониторинг
pm2 monit
```

---

## 🔍 Проверка работы

```bash
# Проверка сайта
curl -I https://rocket-lunch.duckdns.org

# Проверка API
curl https://rocket-lunch.duckdns.org/api/health

# Проверка webhook
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo"

# Должен вернуть: "url": "https://rocket-lunch.duckdns.org/webhook"
```

---

## ❌ Если что-то сломалось

```bash
# Перезапуск всего
pm2 restart rocket-lunch-bot
systemctl restart nginx

# Проверка логов
pm2 logs rocket-lunch-bot --err
tail -f /var/log/nginx/rocket-lunch-bot.error.log

# Проверка статуса
pm2 status
systemctl status nginx
nginx -t
```

---

## 📋 Файлы конфигурации

- `backend/.env.production` - Backend environment
- `frontend/.env.production` - Frontend environment
- `nginx-vps.conf` - Nginx конфигурация
- `deploy-vps.sh` - Deployment скрипт
- `rocket-lunch-bot.service` - Systemd service (опционально)

---

## 🎯 Важные URL

- **Webhook:** `https://rocket-lunch.duckdns.org/webhook`
- **Mini App:** `https://rocket-lunch.duckdns.org`
- **API:** `https://rocket-lunch.duckdns.org/api`
- **Health Check:** `https://rocket-lunch.duckdns.org/health`

---

## ⚠️ Критически важно

1. ✅ **SKIP_TELEGRAM_VALIDATION=false** в production .env
2. ✅ SSL сертификат должен быть валидным
3. ✅ Webhook должен быть установлен
4. ✅ Menu Button должна быть настроена
5. ✅ Порты 80 и 443 должны быть открыты
6. ✅ DuckDNS домен должен указывать на IP VPS

---

## 📞 Telegram API команды

```bash
# Установить webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://rocket-lunch.duckdns.org/webhook"

# Проверить webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Удалить webhook (для тестирования)
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"

# Установить Menu Button
curl -X POST "https://api.telegram.org/bot<TOKEN>/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{"menu_button":{"type":"web_app","text":"🍴 Открыть меню","web_app":{"url":"https://rocket-lunch.duckdns.org"}}}'

# Получить Menu Button
curl "https://api.telegram.org/bot<TOKEN>/getChatMenuButton"
```

---

## 🎉 Готово!

Теперь ваш бот доступен по адресу: **https://rocket-lunch.duckdns.org**

Для полной документации см.: `VPS_DEPLOYMENT_GUIDE_NEW.md`

# Настройка постоянного URL для Telegram Mini App

## Проблема с ngrok
Бесплатная версия ngrok меняет URL при каждом перезапуске. Это неудобно для Telegram Mini App, так как приходится каждый раз обновлять настройки бота.

## ✅ Вариант 1: Платная подписка ngrok (Рекомендуется для разработки)

### Преимущества:
- Постоянный URL (например, `your-name.ngrok.io`)
- Простая настройка
- Стабильная работа
- Автоматический HTTPS

### Стоимость:
- **Personal plan**: $8/месяц
- Включает: постоянные домены, больше туннелей

### Настройка:
```bash
# 1. Зарегистрируйтесь на https://ngrok.com/
# 2. Получите authtoken
ngrok config add-authtoken <YOUR_AUTH_TOKEN>

# 3. Зарезервируйте постоянный домен в дашборде ngrok
# 4. Запустите с постоянным доменом
ngrok http 3001 --domain=your-reserved-domain.ngrok-free.app
```

---

## ✅ Вариант 2: Собственный VPS (Рекомендуется для production)

### Преимущества:
- Полный контроль
- Ваш собственный домен
- Без ограничений
- Дешевле в долгосрочной перспективе

### Провайдеры VPS (от дешевых к дорогим):
1. **Contabo** - от €4.50/месяц (очень дешево, хорошее качество)
2. **Hetzner** - от €4.51/месяц (отличное качество, Европа)
3. **DigitalOcean** - от $6/месяц (простая настройка)
4. **Vultr** - от $6/месяц (много локаций)
5. **Linode** - от $5/месяц (стабильный)

### Базовая настройка VPS:

#### 1. Создайте сервер
- OS: Ubuntu 22.04
- RAM: минимум 2GB
- Disk: минимум 20GB

#### 2. Настройте домен
```bash
# В панели управления доменом создайте A-запись:
# Type: A
# Name: @ (или bot)
# Value: <IP вашего VPS>
# TTL: 3600
```

#### 3. Подключитесь к серверу
```bash
ssh root@your-server-ip
```

#### 4. Установите необходимое ПО
```bash
# Обновите систему
apt update && apt upgrade -y

# Установите Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установите Docker Compose
apt install docker-compose -y

# Установите Nginx
apt install nginx -y

# Установите Certbot для SSL
apt install certbot python3-certbot-nginx -y
```

#### 5. Получите SSL сертификат
```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

#### 6. Настройте Nginx
```nginx
# /etc/nginx/sites-available/telegram-bot
server {
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /webhook {
        proxy_pass http://localhost:3001/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
}

server {
    if ($host = yourdomain.com) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 404;
}
```

```bash
# Активируйте конфигурацию
ln -s /etc/nginx/sites-available/telegram-bot /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

#### 7. Разверните приложение
```bash
# Клонируйте репозиторий
git clone <your-repo-url> /var/www/telegram-bot
cd /var/www/telegram-bot

# Обновите .env файлы с вашим доменом
# Используйте скрипт update-ngrok-url.ps1 или вручную

# Запустите через Docker
docker-compose up -d
```

---

## ✅ Вариант 3: Бесплатные альтернативы ngrok

### Serveo (Бесплатно)
```bash
# Простой туннель
ssh -R 80:localhost:3001 serveo.net

# С постоянным субдоменом
ssh -R yourname:80:localhost:3001 serveo.net
```

### LocalTunnel (Бесплатно)
```bash
npm install -g localtunnel

# Запустите туннель
lt --port 3001 --subdomain yourname
```

### Cloudflare Tunnel (Бесплатно)
```bash
# Установите cloudflared
# Windows: скачайте с https://github.com/cloudflare/cloudflared/releases

# Запустите туннель
cloudflared tunnel --url http://localhost:3001
```

**Минусы бесплатных альтернатив:**
- Могут быть нестабильны
- Ограниченная пропускная способность
- Меньше контроля

---

## ✅ Вариант 4: Vercel/Railway/Render (Для frontend + backend)

### Vercel (Для frontend)
- Бесплатный план
- Автоматический HTTPS
- Быстрый деплой

### Railway/Render (Для backend + database)
- Бесплатный план (с ограничениями)
- Автоматический HTTPS
- Встроенная база данных

---

## 📝 Автоматическое обновление URL (для разработки с ngrok)

Используйте скрипт `update-ngrok-url.ps1`:

```powershell
# PowerShell
.\update-ngrok-url.ps1 -NewUrl "https://d736ecbc2258.ngrok-free.app"
```

Скрипт автоматически обновит:
- ✅ `frontend/.env`
- ✅ `frontend/.env.production`
- ✅ `backend/.env`

---

## 🎯 Рекомендации

### Для разработки:
1. **ngrok Personal plan** ($8/мес) - если нужно быстро начать
2. **Cheap VPS** (Contabo €4.50/мес) - если хотите свой домен

### Для production:
1. **VPS** (Hetzner/DigitalOcean) с собственным доменом
2. **Vercel (frontend) + Railway (backend)** - если хотите serverless

---

## 📞 Что делать после смены URL?

1. **Обновите конфигурацию:**
   ```powershell
   .\update-ngrok-url.ps1 -NewUrl "https://NEW-URL.ngrok-free.app"
   ```

2. **Перезапустите сервисы:**
   ```bash
   # Backend
   cd backend
   npm run dev

   # Frontend
   cd frontend
   npm run dev
   ```

3. **Обновите настройки бота:**
   - Откройте @BotFather
   - `/mybots` → выберите бота → Bot Settings → Menu Button
   - Обновите URL Mini App на новый

4. **Установите webhook:**
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -d "url=https://NEW-URL.ngrok-free.app/webhook"
   ```

5. **Проверьте webhook:**
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

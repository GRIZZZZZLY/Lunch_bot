# 🐳 Docker Production Deployment

Альтернативный метод развертывания через Docker Compose.

---

## 🎯 Преимущества Docker деплоя

- ✅ Изолированная среда
- ✅ Легкое обновление
- ✅ Консистентность между окружениями
- ✅ Автоматический перезапуск
- ✅ Простое масштабирование

---

## 📋 Требования

```bash
Docker >= 20.10
Docker Compose >= 2.0
```

### Установка Docker на Ubuntu:

```bash
# Удаление старых версий
sudo apt remove docker docker-engine docker.io containerd runc

# Установка зависимостей
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release

# Добавление GPG ключа Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Добавление репозитория
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker

# Проверка
docker --version
docker compose version
```

---

## 🚀 Быстрый старт

### 1. Клонирование репозитория

```bash
cd ~
git clone https://github.com/your-username/telegram-food-bot.git
cd telegram-food-bot
```

### 2. Создание .env файла

```bash
nano .env.production
```

**Содержимое:**

```bash
# PostgreSQL
POSTGRES_PASSWORD=your_strong_postgres_password

# Telegram Bot
BOT_TOKEN=your_bot_token_from_botfather
BOT_USERNAME=your_bot_username
BOT_WEBHOOK_URL=https://your-domain.com/api/webhook
WEBAPP_URL=https://your-domain.com

# Security
JWT_SECRET=generate_with_openssl_rand_hex_64
ADMIN_USER_IDS=your_telegram_id

# Generated JWT Secret:
# openssl rand -hex 64
```

### 3. Генерация JWT Secret

```bash
openssl rand -hex 64
# Скопируйте результат в .env.production как JWT_SECRET
```

### 4. Сборка Frontend

```bash
cd frontend

# Создать .env для production
cat > .env.production <<EOF
VITE_API_URL=https://your-domain.com/api
VITE_BOT_USERNAME=your_bot_username
VITE_NODE_ENV=production
VITE_USE_MOCK_API=false
EOF

# Установка зависимостей и сборка
npm ci
npm run build

cd ..
```

### 5. Создание Nginx конфигурации

```bash
mkdir -p nginx
nano nginx/nginx.conf
```

**Содержимое `nginx/nginx.conf`:**

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    gzip on;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=100r/s;

    server {
        listen 80;
        server_name localhost;

        # Frontend
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
            
            # Cache static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }

        # Backend API
        location /api {
            limit_req zone=api_limit burst=20 nodelay;
            
            proxy_pass http://backend:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Telegram Webhook (higher rate limit)
        location /api/webhook {
            limit_req zone=webhook_limit burst=50 nodelay;
            
            proxy_pass http://backend:3001/api/webhook;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 6. Запуск контейнеров

```bash
# Запуск в фоновом режиме
docker compose -f docker-compose.production.yml --env-file .env.production up -d

# Просмотр логов
docker compose -f docker-compose.production.yml logs -f

# Проверка статуса
docker compose -f docker-compose.production.yml ps
```

### 7. Применение миграций БД

```bash
# Выполнить миграции Prisma
docker compose -f docker-compose.production.yml exec backend npx prisma migrate deploy

# Проверка подключения к БД
docker compose -f docker-compose.production.yml exec backend npx prisma db pull
```

### 8. Настройка SSL (с Let's Encrypt)

Для production обязательно нужен SSL. Есть два варианта:

#### Вариант A: Nginx вне Docker (рекомендуется)

```bash
# Установить Nginx на хост
sudo apt install nginx certbot python3-certbot-nginx

# Получить SSL сертификат
sudo certbot --nginx -d your-domain.com

# Настроить Nginx как reverse proxy к Docker
sudo nano /etc/nginx/sites-available/rocket-lunch-bot
```

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Вариант B: Certbot в Docker

Добавить сервис certbot в `docker-compose.production.yml`:

```yaml
  certbot:
    image: certbot/certbot
    container_name: certbot
    volumes:
      - ./nginx/ssl:/etc/letsencrypt
      - ./nginx/certbot:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
```

### 9. Установка Telegram Webhook

```bash
# Создать скрипт
nano set-webhook.sh
```

```bash
#!/bin/bash
source .env.production

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${BOT_WEBHOOK_URL}\",
    \"allowed_updates\": [\"message\", \"callback_query\", \"my_chat_member\"],
    \"drop_pending_updates\": true
  }"
```

```bash
chmod +x set-webhook.sh
./set-webhook.sh
```

### 10. Проверка

```bash
# Проверка статуса контейнеров
docker compose -f docker-compose.production.yml ps

# Логи backend
docker compose -f docker-compose.production.yml logs -f backend

# Проверка API
curl http://localhost:3001/api/health

# Проверка webhook info
source .env.production
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

---

## 🔄 Управление контейнерами

### Основные команды:

```bash
# Запуск
docker compose -f docker-compose.production.yml up -d

# Остановка
docker compose -f docker-compose.production.yml down

# Перезапуск
docker compose -f docker-compose.production.yml restart

# Пересборка
docker compose -f docker-compose.production.yml up -d --build

# Просмотр логов
docker compose -f docker-compose.production.yml logs -f

# Просмотр логов конкретного сервиса
docker compose -f docker-compose.production.yml logs -f backend

# Статус контейнеров
docker compose -f docker-compose.production.yml ps

# Вход в контейнер
docker compose -f docker-compose.production.yml exec backend sh
```

### Обновление приложения:

```bash
# Создать скрипт деплоя
nano deploy-docker.sh
```

```bash
#!/bin/bash

echo "🚀 Starting Docker deployment..."

# Pull latest code
git pull origin main

# Rebuild frontend
cd frontend
npm ci
npm run build
cd ..

# Rebuild and restart containers
docker compose -f docker-compose.production.yml up -d --build

# Check status
docker compose -f docker-compose.production.yml ps

echo "✅ Deployment completed!"
echo "📊 Check logs: docker compose -f docker-compose.production.yml logs -f"
```

```bash
chmod +x deploy-docker.sh
```

---

## 💾 Бэкапы

### Автоматический бэкап PostgreSQL:

```bash
# Создать скрипт бэкапа
nano backup-docker-db.sh
```

```bash
#!/bin/bash

BACKUP_DIR="$HOME/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U rocket_lunch_user rocket_lunch_db \
  > "$BACKUP_DIR/db_backup_$DATE.sql"

# Compress
gzip "$BACKUP_DIR/db_backup_$DATE.sql"

# Remove old backups (older than 30 days)
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +30 -delete

echo "✅ Backup completed: db_backup_$DATE.sql.gz"
```

```bash
chmod +x backup-docker-db.sh

# Добавить в crontab
crontab -e
# 0 3 * * * /home/deployer/telegram-food-bot/backup-docker-db.sh
```

### Восстановление из бэкапа:

```bash
# Распаковать
gunzip backups/db_backup_YYYYMMDD_HHMMSS.sql.gz

# Восстановить
docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U rocket_lunch_user rocket_lunch_db \
  < backups/db_backup_YYYYMMDD_HHMMSS.sql
```

---

## 📊 Мониторинг

### Docker Stats:

```bash
# Мониторинг ресурсов в реальном времени
docker stats
```

### Портainer (веб-интерфейс):

```bash
# Добавить в docker-compose.production.yml
  portainer:
    image: portainer/portainer-ce:latest
    container_name: portainer
    restart: unless-stopped
    ports:
      - "9000:9000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data

# Открыть в браузере: http://your-server-ip:9000
```

---

## 🔧 Решение проблем

### Контейнер не запускается:

```bash
# Просмотр логов
docker compose -f docker-compose.production.yml logs backend

# Проверка конфигурации
docker compose -f docker-compose.production.yml config

# Пересборка образа
docker compose -f docker-compose.production.yml build --no-cache backend
```

### База данных недоступна:

```bash
# Проверка подключения к PostgreSQL
docker compose -f docker-compose.production.yml exec postgres \
  psql -U rocket_lunch_user -d rocket_lunch_db -c "\l"

# Проверка логов PostgreSQL
docker compose -f docker-compose.production.yml logs postgres
```

### Очистка:

```bash
# Удалить все остановленные контейнеры
docker container prune

# Удалить неиспользуемые образы
docker image prune -a

# Удалить неиспользуемые volumes (ОСТОРОЖНО!)
docker volume prune

# Полная очистка системы (ОСТОРОЖНО!)
docker system prune -a --volumes
```

---

## ✅ Финальный чек-лист

- [ ] Docker и Docker Compose установлены
- [ ] .env.production настроен
- [ ] Frontend собран
- [ ] JWT_SECRET сгенерирован
- [ ] Nginx конфигурация создана
- [ ] Контейнеры запущены
- [ ] Миграции БД применены
- [ ] SSL настроен
- [ ] Webhook установлен
- [ ] Бот отвечает в Telegram
- [ ] Mini App открывается
- [ ] Бэкапы настроены

---

## 🎉 Готово!

Ваш бот развернут в Docker и готов к использованию!

**Преимущества Docker деплоя:**
- Простое обновление: `./deploy-docker.sh`
- Легкий откат: `git checkout previous_commit && ./deploy-docker.sh`
- Изоляция: каждый сервис в своем контейнере
- Портируемость: работает одинаково везде

**Полезные ссылки:**
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)

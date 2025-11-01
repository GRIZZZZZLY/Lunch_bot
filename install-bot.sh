#!/bin/bash
set -e

echo " УСТАНОВКА ROCKET LUNCH BOT"
echo "=============================="

# Запросить BOT_TOKEN
read -p "Введите BOT_TOKEN от @BotFather: " BOT_TOKEN

DOMAIN="rocket-lunch.duckdns.org"
USER_HOME="/home/igor"

echo ""
echo " Параметры:"
echo "  - Домен: $DOMAIN"
echo ""

# 1. Клонировать репозиторий
echo " Клонирование репозитория..."
cd ~
git clone https://github.com/GRIZZZZZLY/Lunch_bot.git
cd Lunch_bot
git checkout feature/new_version

# 2. Backend - установка
echo ""
echo " Backend: установка зависимостей..."
cd telegram-food-bot/backend
npm install

# 3. Backend - настройка .env
echo ""
echo "  Backend: создание .env..."
cat > .env << ENVEOF
NODE_ENV=production
API_PORT=3001
API_URL=https://$DOMAIN
WEBAPP_URL=https://$DOMAIN
FRONTEND_ORIGIN=https://$DOMAIN

BOT_TOKEN=$BOT_TOKEN
BOT_USERNAME=rocket_lunch_bot
BOT_MODE=polling

JWT_SECRET=$(openssl rand -base64 32)
JWT_ACCESS_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

DATABASE_URL="file:./prisma/dev.db"

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

CORS_ORIGIN=https://$DOMAIN

LOG_LEVEL=info
LOG_FILE=logs/combined.log
LOG_ERROR_FILE=logs/error.log

SESSION_SECRET=$(openssl rand -base64 32)

SKIP_TELEGRAM_VALIDATION=false
ENVEOF

# 4. Backend - инициализация БД
echo ""
echo "  Backend: инициализация базы данных..."
npx prisma generate
npx prisma db push

# 5. Backend - сборка
echo ""
echo " Backend: сборка..."
npm run build

# 6. Frontend - установка
echo ""
echo " Frontend: установка зависимостей..."
cd ../frontend
npm install

# 7. Frontend - настройка .env
echo ""
echo "  Frontend: создание .env.production..."
cat > .env.production << ENVEOF
VITE_API_URL=/api
VITE_BOT_USERNAME=rocket_lunch_bot
VITE_WEBAPP_URL=https://$DOMAIN
ENVEOF

# 8. Frontend - сборка
echo ""
echo " Frontend: сборка..."
npm run build

# 9. PM2 - настройка
echo ""
echo "  PM2: создание ecosystem.config.js..."
cd ~/Lunch_bot/telegram-food-bot

cat > ecosystem.config.js << 'PMEOF'
module.exports = {
  apps: [{
    name: 'rocket-lunch-bot',
    script: './backend/dist/index.js',
    cwd: '/home/igor/Lunch_bot/telegram-food-bot/backend',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      BOT_MODE: 'polling'
    },
    error_file: '/home/igor/Lunch_bot/telegram-food-bot/logs/pm2-error.log',
    out_file: '/home/igor/Lunch_bot/telegram-food-bot/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
PMEOF

# 10. Создание директории логов
mkdir -p ~/Lunch_bot/telegram-food-bot/logs

# 11. PM2 - запуск
echo ""
echo " PM2: запуск приложения..."
pm2 start ecosystem.config.js
pm2 save

# 12. Nginx - настройка
echo ""
echo "  Nginx: создание конфигурации..."

sudo tee /etc/nginx/sites-available/rocket-lunch-bot > /dev/null << 'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name rocket-lunch.duckdns.org;

    client_max_body_size 10M;

    access_log /var/log/nginx/rocket-lunch-bot.access.log;
    error_log /var/log/nginx/rocket-lunch-bot.error.log;

    # API endpoints
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
        access_log off;
    }

    # Frontend static files
    location / {
        root /home/igor/Lunch_bot/telegram-food-bot/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # НЕ кешировать HTML
        location ~* \.html$ {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
    }

    # Deny hidden files
    location ~ /\. {
        deny all;
    }
}
NGINXEOF

# 13. Nginx - активация
sudo ln -sf /etc/nginx/sites-available/rocket-lunch-bot /etc/nginx/sites-enabled/

# 14. Nginx - проверка и перезагрузка
echo ""
echo " Nginx: проверка конфигурации..."
sudo nginx -t

echo ""
echo " Nginx: перезагрузка..."
sudo systemctl reload nginx

# 15. Финальная проверка
echo ""
echo "=============================="
echo " УСТАНОВКА ЗАВЕРШЕНА!"
echo "=============================="
echo ""
echo " Статус:"
echo ""
pm2 list
echo ""
echo "Backend health:"
curl -s http://localhost:3001/health
echo ""
echo ""
echo " Доступ:"
echo "  - Домен: https://$DOMAIN"
echo "  - API Health: https://$DOMAIN/health"
echo "  - Бот: @rocket_lunch_bot"
echo ""
echo " Следующие шаги:"
echo "  1. Настроить SSL:"
echo "     sudo certbot --nginx -d $DOMAIN"
echo ""
echo "  2. Протестировать бота:"
echo "     - Откройте @rocket_lunch_bot"
echo "     - Отправьте /start"
echo "     - Откройте Mini App"
echo ""
echo " Полезные команды:"
echo "  - Логи PM2: pm2 logs rocket-lunch-bot"
echo "  - Логи Nginx: sudo tail -f /var/log/nginx/rocket-lunch-bot.error.log"
echo "  - Перезапуск: pm2 restart rocket-lunch-bot"
echo ""

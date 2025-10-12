#!/bin/bash

# ========================================
# 🚀 Quick Production Deployment Script
# ========================================
# Автоматизированный скрипт для первого деплоя
# ⚠️ Запускать на ЧИСТОМ сервере Ubuntu 22.04
# ========================================

set -e  # Выход при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🚀 Rocket Lunch Bot - Production Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# ========================================
# 1. Сбор информации
# ========================================

echo -e "${YELLOW}📋 Введите настройки:${NC}"
echo ""

read -p "Домен (например: bot.example.com): " DOMAIN
read -p "Telegram Bot Token: " BOT_TOKEN
read -p "Telegram Bot Username: " BOT_USERNAME
read -p "Ваш Telegram ID (админ): " ADMIN_ID
read -p "Email для SSL (Let's Encrypt): " SSL_EMAIL

echo ""
echo -e "${YELLOW}⚙️  Выберите БД:${NC}"
echo "1) SQLite (простая, для малых проектов)"
echo "2) PostgreSQL (рекомендуется для production)"
read -p "Выбор (1/2): " DB_CHOICE

if [ "$DB_CHOICE" = "2" ]; then
    read -sp "Пароль для PostgreSQL: " PG_PASSWORD
    echo ""
    DB_URL="postgresql://rocket_lunch_user:${PG_PASSWORD}@localhost:5432/rocket_lunch_db"
else
    DB_URL="file:./prisma/production.db"
fi

echo ""
echo -e "${GREEN}✅ Настройки собраны${NC}"

# Генерация JWT Secret
JWT_SECRET=$(openssl rand -hex 64)

# ========================================
# 2. Обновление системы
# ========================================

echo ""
echo -e "${YELLOW}📦 Обновление системы...${NC}"
sudo apt update && sudo apt upgrade -y

# ========================================
# 3. Установка зависимостей
# ========================================

echo ""
echo -e "${YELLOW}📦 Установка зависимостей...${NC}"

# Node.js
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Nginx
sudo apt install -y nginx

# Certbot
sudo apt install -y certbot python3-certbot-nginx

# PostgreSQL (если выбран)
if [ "$DB_CHOICE" = "2" ]; then
    sudo apt install -y postgresql postgresql-contrib
fi

# PM2
sudo npm install -g pm2

echo -e "${GREEN}✅ Зависимости установлены${NC}"

# ========================================
# 4. Настройка PostgreSQL (если выбран)
# ========================================

if [ "$DB_CHOICE" = "2" ]; then
    echo ""
    echo -e "${YELLOW}🗄️  Настройка PostgreSQL...${NC}"
    
    sudo -u postgres psql <<EOF
CREATE DATABASE rocket_lunch_db;
CREATE USER rocket_lunch_user WITH ENCRYPTED PASSWORD '${PG_PASSWORD}';
GRANT ALL PRIVILEGES ON DATABASE rocket_lunch_db TO rocket_lunch_user;
EOF
    
    echo -e "${GREEN}✅ PostgreSQL настроен${NC}"
fi

# ========================================
# 5. Клонирование репозитория
# ========================================

echo ""
echo -e "${YELLOW}📥 Клонирование репозитория...${NC}"

if [ ! -d "telegram-food-bot" ]; then
    # Замените на ваш репозиторий
    read -p "URL Git репозитория: " GIT_REPO
    git clone "$GIT_REPO" telegram-food-bot
fi

cd telegram-food-bot

echo -e "${GREEN}✅ Репозиторий клонирован${NC}"

# ========================================
# 6. Настройка Backend
# ========================================

echo ""
echo -e "${YELLOW}🔧 Настройка Backend...${NC}"

cd backend

# Создание .env
cat > .env.production <<EOF
DATABASE_URL="${DB_URL}"

BOT_TOKEN=${BOT_TOKEN}
BOT_USERNAME=${BOT_USERNAME}
BOT_MODE=webhook
BOT_WEBHOOK_URL=https://${DOMAIN}/api/webhook

TELEGRAM_SECRET_KEY=${BOT_TOKEN}
WEBAPP_URL=https://${DOMAIN}

API_PORT=3001
API_HOST=127.0.0.1

NODE_ENV=production

LOG_LEVEL=info
LOG_FORMAT=combined

JWT_SECRET=${JWT_SECRET}
CORS_ORIGIN=https://${DOMAIN}

ADMIN_USER_IDS=${ADMIN_ID}

NOTIFICATION_ENABLED=true
NOTIFICATION_DELAY_MINUTES=5

POLL_DURATION_MINUTES=30
AUTO_ROULETTE_ENABLED=true

SKIP_TELEGRAM_VALIDATION=false
EOF

cp .env.production .env

# Установка зависимостей и сборка
npm ci --production
npm run build

# Prisma миграции
npx prisma migrate deploy

echo -e "${GREEN}✅ Backend настроен${NC}"

# ========================================
# 7. Настройка Frontend
# ========================================

echo ""
echo -e "${YELLOW}🎨 Настройка Frontend...${NC}"

cd ../frontend

# Создание .env
cat > .env.production <<EOF
VITE_API_URL=https://${DOMAIN}/api
VITE_BOT_USERNAME=${BOT_USERNAME}
VITE_NODE_ENV=production
VITE_USE_MOCK_API=false
VITE_APP_VERSION=1.0.0
EOF

# Установка зависимостей и сборка
npm ci
npm run build

echo -e "${GREEN}✅ Frontend настроен${NC}"

# ========================================
# 8. PM2 конфигурация
# ========================================

echo ""
echo -e "${YELLOW}⚙️  Настройка PM2...${NC}"

cd ../backend

cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'rocket-lunch-bot',
    script: './dist/index.js',
    cwd: '$(pwd)',
    instances: 1,
    exec_mode: 'fork',
    env_production: {
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
  }]
};
EOF

echo -e "${GREEN}✅ PM2 конфигурация создана${NC}"

# ========================================
# 9. Nginx конфигурация
# ========================================

echo ""
echo -e "${YELLOW}🌐 Настройка Nginx...${NC}"

sudo tee /etc/nginx/sites-available/rocket-lunch-bot <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    
    location / {
        root $(pwd)/../frontend/dist;
        try_files \$uri \$uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Активация конфига
sudo ln -sf /etc/nginx/sites-available/rocket-lunch-bot /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Проверка и перезапуск
sudo nginx -t
sudo systemctl restart nginx

echo -e "${GREEN}✅ Nginx настроен${NC}"

# ========================================
# 10. SSL сертификат
# ========================================

echo ""
echo -e "${YELLOW}🔐 Получение SSL сертификата...${NC}"

sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m ${SSL_EMAIL}

echo -e "${GREEN}✅ SSL сертификат установлен${NC}"

# ========================================
# 11. Запуск приложения
# ========================================

echo ""
echo -e "${YELLOW}🚀 Запуск приложения...${NC}"

pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup | tail -n 1 | bash

echo -e "${GREEN}✅ Приложение запущено${NC}"

# ========================================
# 12. Установка Webhook
# ========================================

echo ""
echo -e "${YELLOW}📡 Установка Telegram Webhook...${NC}"

# Небольшая пауза для запуска сервера
sleep 5

cat > set-webhook.js <<EOF
const https = require('https');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;

const options = {
  hostname: 'api.telegram.org',
  path: \`/bot\${BOT_TOKEN}/setWebhook\`,
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
};

const data = JSON.stringify({
  url: WEBHOOK_URL,
  allowed_updates: ['message', 'callback_query', 'my_chat_member'],
  drop_pending_updates: true,
});

const req = https.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    const result = JSON.parse(responseData);
    console.log(result.ok ? '✅ Webhook установлен!' : '❌ Ошибка:', result.description);
  });
});

req.write(data);
req.end();
EOF

node set-webhook.js

# ========================================
# 13. Настройка бэкапов
# ========================================

echo ""
echo -e "${YELLOW}💾 Настройка автоматических бэкапов...${NC}"

mkdir -p ~/backups

cat > ~/backup-db.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_PATH="$HOME/telegram-food-bot/backend/prisma/production.db"

if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "$BACKUP_DIR/db_backup_$DATE.db"
    find "$BACKUP_DIR" -name "db_backup_*.db" -mtime +30 -delete
    echo "✅ Backup completed: db_backup_$DATE.db"
fi
EOF

chmod +x ~/backup-db.sh

# Добавление в crontab
(crontab -l 2>/dev/null; echo "0 3 * * * $HOME/backup-db.sh >> $HOME/backups/backup.log 2>&1") | crontab -

echo -e "${GREEN}✅ Бэкапы настроены (каждый день в 3:00)${NC}"

# ========================================
# 14. Файрвол
# ========================================

echo ""
echo -e "${YELLOW}🔥 Настройка файрвола...${NC}"

sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

echo -e "${GREEN}✅ Файрвол настроен${NC}"

# ========================================
# ЗАВЕРШЕНИЕ
# ========================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Deployment завершен успешно!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}📋 Информация:${NC}"
echo -e "🌐 Домен: ${GREEN}https://${DOMAIN}${NC}"
echo -e "🤖 Бот: ${GREEN}@${BOT_USERNAME}${NC}"
echo -e "👤 Админ ID: ${GREEN}${ADMIN_ID}${NC}"
echo ""
echo -e "${YELLOW}📊 Полезные команды:${NC}"
echo -e "  Статус:     ${GREEN}pm2 status${NC}"
echo -e "  Логи:       ${GREEN}pm2 logs rocket-lunch-bot${NC}"
echo -e "  Перезапуск: ${GREEN}pm2 restart rocket-lunch-bot${NC}"
echo -e "  Мониторинг: ${GREEN}pm2 monit${NC}"
echo ""
echo -e "${YELLOW}🧪 Тестирование:${NC}"
echo -e "  1. Откройте бота в Telegram: ${GREEN}@${BOT_USERNAME}${NC}"
echo -e "  2. Отправьте команду ${GREEN}/start${NC}"
echo -e "  3. Нажмите на кнопку Menu"
echo -e "  4. Mini App должен открыться"
echo ""
echo -e "${YELLOW}📚 Документация:${NC}"
echo -e "  - PRODUCTION_DEPLOYMENT_GUIDE.md"
echo -e "  - PRODUCTION_CHECKLIST.md"
echo ""
echo -e "${GREEN}Готово! 🎉${NC}"

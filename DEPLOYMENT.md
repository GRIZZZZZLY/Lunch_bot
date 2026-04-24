# Deployment (Ubuntu VPS + Nginx + SSL)

This guide covers production deployment on Ubuntu VPS with Nginx and Let’s Encrypt.

## Prerequisites

- Ubuntu 20.04/22.04 VPS
- Domain with A record to VPS IP
- SSH access (non-root user recommended)
- Docker + Docker Compose
- Node.js 22+
- Nginx + Certbot

## 1) Server Setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ca-certificates
```

## 2) Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

## 3) Install Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

## 4) Install Nginx + Certbot

```bash
sudo apt install -y nginx
sudo apt install -y certbot python3-certbot-nginx
```

## 5) Clone and Configure

```bash
cd /home/ubuntu
git clone <repo-url>
cd telegram-food-bot/backend
cp .env.production.example .env.production
nano .env.production
```

Set at минимум:

```
NODE_ENV=production
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/foodbot_db
TELEGRAM_BOT_TOKEN=...
```

## 6) Start PostgreSQL

```bash
cd /home/ubuntu/telegram-food-bot
docker compose -f docker-compose.production.yml up -d postgres
```

## 7) Build and Migrate

```bash
cd /home/ubuntu/telegram-food-bot/backend
npm ci --production
npx prisma migrate deploy
npx prisma generate
npm run build
```

## 8) systemd Service (Backend)

Create `/etc/systemd/system/telegram-food-bot.service`:

```ini
[Unit]
Description=Telegram Food Bot Backend
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/telegram-food-bot/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /home/ubuntu/telegram-food-bot/backend/dist/index.js
Restart=always
User=ubuntu

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable telegram-food-bot
sudo systemctl start telegram-food-bot
sudo systemctl status telegram-food-bot
```

## 9) Nginx Reverse Proxy

Create `/etc/nginx/sites-available/telegram-food-bot`:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Optional: serve MiniApp static build
    # location / {
    #     root /home/ubuntu/telegram-food-bot/frontend/dist;
    #     try_files $uri /index.html;
    # }
}
```

Enable config:

```bash
sudo ln -s /etc/nginx/sites-available/telegram-food-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 10) SSL (Let’s Encrypt)

```bash
sudo certbot --nginx -d example.com -d www.example.com
sudo certbot renew --dry-run
```

## 11) GlitchTip (optional, recommended)

```bash
docker compose -f docker-compose.production.yml up -d redis glitchtip glitchtip-worker
docker compose -f docker-compose.production.yml run --rm glitchtip-migrate
```

Create admin user:

```bash
docker exec -it foodbot-glitchtip ./manage.py createsuperuser
```

Open `https://glitchtip.your-domain.com`, create project, copy DSN.

## 12) Backups (cron)

```bash
crontab -e
```

Example daily backup (3 AM):

```
0 3 * * * cd /home/ubuntu/telegram-food-bot && ./scripts/backup-postgres.sh --compress --keep 30 --silent
```

## Verification

```bash
curl http://127.0.0.1:3001/api/health
```

Expected: `{ "status": "healthy" }` and database connected.

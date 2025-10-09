# 🌐 xtunnel Configuration

## Текущая конфигурация туннеля

### URLs
- **HTTPS**: `https://337b2bfd-82ee-4d01-9aac-f4ae7505235b.tunnel4.com`
- **HTTP**: `http://337b2bfd-82ee-4d01-9aac-f4ae7505235b.tunnel4.com`
- **Target**: `http://localhost:8080`

## Настройка

### 1. Запуск xtunnel

```bash
# Запустите xtunnel с вашими настройками
# (команда зависит от вашей конфигурации xtunnel)
```

### 2. Настройка reverse proxy

Поскольку xtunnel проксирует на порт 8080, а у нас:
- Frontend на `localhost:5173`
- Backend API на `localhost:3001`

Нужно настроить nginx или другой reverse proxy:

#### Nginx конфигурация (пример):

```nginx
server {
    listen 8080;
    server_name localhost;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Обновление конфигурации при изменении URL

Если URL туннеля изменится, обновите:

#### Backend `.env`:
```env
WEBAPP_URL=https://ВАШ_НОВЫЙ_URL.tunnel4.com
BOT_WEBHOOK_URL=https://ВАШ_НОВЫЙ_URL.tunnel4.com/webhook
CORS_ORIGIN=http://localhost:5173,https://ВАШ_НОВЫЙ_URL.tunnel4.com,https://web.telegram.org
```

#### Перезапустите backend:
```bash
cd backend
npm run dev
```

## Проверка

```bash
# Проверка HTTPS доступа
curl https://337b2bfd-82ee-4d01-9aac-f4ae7505235b.tunnel4.com

# Проверка API
curl https://337b2bfd-82ee-4d01-9aac-f4ae7505235b.tunnel4.com/api/health
```

## Преимущества xtunnel перед ngrok

1. **Стабильность**: Постоянный URL (не меняется при перезапуске)
2. **Без ограничений**: Нет лимитов на количество соединений
3. **Бесплатно**: Не требует платной подписки
4. **Кастомизация**: Больше контроля над настройками

## Troubleshooting

### Туннель не доступен
1. Проверьте, запущен ли xtunnel
2. Проверьте логи xtunnel
3. Убедитесь, что порт 8080 свободен

### 502 Bad Gateway
1. Проверьте, запущен ли nginx/reverse proxy
2. Проверьте, запущены ли frontend (5173) и backend (3001)
3. Проверьте конфигурацию nginx

### CORS ошибки
1. Убедитесь, что URL туннеля добавлен в `CORS_ORIGIN` в backend/.env
2. Перезапустите backend после изменения `.env`

---

**Дата последнего обновления**: 03.10.2025  
**Заменил**: ngrok

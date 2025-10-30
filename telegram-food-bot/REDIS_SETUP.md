# Redis Setup Guide for VPS

## ✅ Что изменилось

Backend теперь использует **Redis** вместо in-memory node-cache для кэширования:
- ✅ Персистентность (данные сохраняются при перезапуске)
- ✅ Масштабируемость (общий кэш между серверами)
- ✅ RDB snapshots для backup

## 🐳 Option 1: Redis через Docker (Рекомендуется)

### 1. Установить Docker

```bash
# Обновить пакеты
sudo apt update

# Установить Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавить пользователя в группу docker
sudo usermod -aG docker $USER

# Перелогиниться или выполнить
newgrp docker
```

### 2. Запустить Redis контейнер

```bash
# Создать директорию для данных
mkdir -p ~/redis-data

# Запустить Redis с персистентностью
docker run -d \
  --name redis \
  --restart unless-stopped \
  -p 6379:6379 \
  -v ~/redis-data:/data \
  redis:7-alpine redis-server \
    --appendonly yes \
    --appendfsync everysec \
    --save 900 1 \
    --save 300 10 \
    --save 60 10000

# Проверить что работает
docker ps
docker logs redis
```

### 3. Настроить .env

Добавить в `telegram-food-bot/backend/.env`:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=  # Опционально
REDIS_DB=0
```

### 4. Auto-start после перезагрузки

Docker контейнер с флагом `--restart unless-stopped` автоматически запустится при перезагрузке сервера.

---

## 🔧 Option 2: Redis напрямую (Без Docker)

### 1. Установить Redis

```bash
sudo apt update
sudo apt install redis-server -y
```

### 2. Настроить Redis

Редактировать `/etc/redis/redis.conf`:

```bash
sudo nano /etc/redis/redis.conf
```

Найти и изменить:

```conf
# Bind на localhost (безопасно)
bind 127.0.0.1

# Включить RDB persistence
save 900 1
save 300 10
save 60 10000

# Включить AOF persistence
appendonly yes
appendfsync everysec
```

### 3. Запустить Redis

```bash
# Запустить сервис
sudo systemctl start redis-server

# Включить автозапуск
sudo systemctl enable redis-server

# Проверить статус
sudo systemctl status redis-server

# Проверить что работает
redis-cli ping
# Должно вернуть: PONG
```

### 4. Настроить .env

Добавить в `telegram-food-bot/backend/.env`:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

---

## 🧪 Тестирование Redis

### Проверить подключение

```bash
# Из командной строки
redis-cli ping

# Установить тестовое значение
redis-cli SET test_key "Hello Redis"

# Получить значение
redis-cli GET test_key

# Посмотреть все ключи
redis-cli KEYS *
```

### Мониторинг

```bash
# Просмотр статистики в реальном времени
redis-cli --stat

# Мониторинг команд
redis-cli MONITOR

# Информация о сервере
redis-cli INFO
```

---

## 🔒 Безопасность (Production)

### Установить пароль (опционально)

```bash
# В redis.conf или через command line
redis-cli CONFIG SET requirepass "ваш_сложный_пароль"

# Или в /etc/redis/redis.conf:
# requirepass ваш_сложный_пароль
```

Добавить в `.env`:

```bash
REDIS_PASSWORD=ваш_сложный_пароль
```

### Firewall

Redis должен быть доступен только с localhost:

```bash
# Проверить что Redis слушает только 127.0.0.1
sudo netstat -tulpn | grep 6379
```

Не открывайте порт 6379 во внешний интернет!

---

## 🚀 Деплой на VPS

### 1. На VPS установить Redis (Option 1 или 2)

### 2. Обновить код

```bash
cd ~/Lunch_bot
git pull
cd telegram-food-bot/backend
npm install
npm run build
```

### 3. Перезапустить PM2

```bash
pm2 restart rocket-lunch-bot
pm2 logs rocket-lunch-bot
```

### 4. Проверить логи

Должны увидеть:

```
✅ Redis connected { host: 'localhost', port: 6379, db: 0 }
🚀 Redis ready for commands
✅ Cache service initialized with Redis
```

---

## 🐛 Troubleshooting

### Redis не запускается

```bash
# Проверить порт
sudo netstat -tulpn | grep 6379

# Проверить логи Docker
docker logs redis

# Проверить логи системного Redis
sudo journalctl -u redis-server -n 50
```

### Backend не может подключиться

```bash
# Проверить что Redis работает
redis-cli ping

# Проверить .env
cat telegram-food-bot/backend/.env | grep REDIS

# Проверить что backend видит переменные
cd telegram-food-bot/backend
node -e "console.log(process.env.REDIS_HOST)"
```

### Очистить кэш

```bash
# Удалить все ключи
redis-cli FLUSHALL

# Удалить только текущую DB
redis-cli FLUSHDB
```

---

## 📊 Backup Redis данных

### Docker

```bash
# Данные автоматически сохраняются в ~/redis-data/
# Backup:
tar -czf redis-backup-$(date +%Y%m%d).tar.gz ~/redis-data/
```

### Системный Redis

```bash
# Данные в /var/lib/redis/
sudo tar -czf redis-backup-$(date +%Y%m%d).tar.gz /var/lib/redis/
```

---

## 🔄 Миграция с node-cache

Код полностью обратно совместим! Замена произошла в `cache.service.ts`:

**До (node-cache):**
```typescript
const cached = cacheService.get<T>(key);  // Синхронно
cacheService.set(key, value, ttl);        // Синхронно
```

**После (Redis):**
```typescript
const cached = await cacheService.get<T>(key);  // Асинхронно
await cacheService.set(key, value, ttl);        // Асинхронно
```

Все вызовы в сервисах уже были async, поэтому изменения минимальны.

---

## ✅ Готово!

Теперь ваш бот использует Redis для кэширования. Данные сохраняются между перезапусками, и можно масштабировать на несколько серверов с общим кэшем.

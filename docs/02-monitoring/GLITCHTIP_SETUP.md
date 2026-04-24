# GlitchTip Setup Guide

GlitchTip — open-source альтернатива Sentry, совместимая с Sentry SDK.

---

## Быстрый старт (Self-Hosted)

### 1. Запустить GlitchTip

```bash
# Запустить все сервисы (включая GlitchTip)
docker-compose up -d

# Проверить статус
docker-compose ps

# Должны быть запущены:
# - foodbot-postgres
# - foodbot-redis
# - foodbot-glitchtip
# - foodbot-glitchtip-worker
# - foodbot-backend
# - foodbot-frontend
```

---

### 2. Создать базу данных для GlitchTip

```bash
# Подключиться к Postgres
docker exec -it foodbot-postgres psql -U foodbot

# Создать БД для GlitchTip
CREATE DATABASE glitchtip_db;
GRANT ALL PRIVILEGES ON DATABASE glitchtip_db TO foodbot;
\q
```

---

### 3. Инициализировать GlitchTip

```bash
# Применить миграции
docker exec -it foodbot-glitchtip ./manage.py migrate

# Создать суперпользователя
docker exec -it foodbot-glitchtip ./manage.py createsuperuser
# Email: admin@example.com
# Password: (ваш пароль)
```

---

### 4. Открыть GlitchTip UI

```
http://localhost:8000
```

Войти с учётными данными суперпользователя.

---

### 5. Создать проект и получить DSN

1. Войти в GlitchTip UI
2. Создать новую организацию (Organization)
3. Создать новый проект (Project)
   - Name: `Telegram Food Bot`
   - Platform: `Node.js`
4. Скопировать DSN из настроек проекта
   - Формат: `http://xxx@localhost:8000/1`

---

### 6. Настроить backend

Добавить в `backend/.env`:

```bash
# GlitchTip Configuration
ENABLE_GLITCHTIP=true
GLITCHTIP_DSN=http://xxx@localhost:8000/1

# Или использовать SENTRY_DSN (совместимо)
# ENABLE_SENTRY=true
# SENTRY_DSN=http://xxx@localhost:8000/1
```

---

### 7. Перезапустить backend

```bash
docker-compose restart backend

# Или если запускаете локально
cd backend
npm run dev
```

---

### 8. Проверить работу

```bash
# Вызвать тестовую ошибку
curl http://localhost:3001/api/test-error

# Проверить в GlitchTip UI
# Issues -> должна появиться новая ошибка
```

---

## Production Setup (с ngrok)

### 1. Обновить .env.production

```bash
# GlitchTip (если используете облачный GlitchTip)
ENABLE_GLITCHTIP=true
GLITCHTIP_DSN=https://xxx@glitchtip.com/1

# Или self-hosted с публичным URL
GLITCHTIP_DSN=https://glitchtip.yourdomain.com/xxx/1
```

### 2. Запустить через start-prod.ps1

```powershell
.\start-prod.ps1
```

GlitchTip будет автоматически получать ошибки из production.

---

## Облачный GlitchTip (альтернатива self-hosted)

Если не хотите поднимать свой GlitchTip:

1. Зарегистрироваться на https://glitchtip.com
2. Создать проект
3. Скопировать DSN
4. Добавить в `.env`:
   ```bash
   ENABLE_GLITCHTIP=true
   GLITCHTIP_DSN=https://xxx@app.glitchtip.com/1
   ```

**Цены:**
- Free: 1000 событий/мес
- Paid: от $5/мес (10K событий)

---

## Переключение Sentry → GlitchTip

Если у вас уже настроен Sentry:

### Вариант 1: Заменить DSN

```bash
# Было
ENABLE_SENTRY=true
SENTRY_DSN=https://xxx@sentry.io/123

# Стало
ENABLE_GLITCHTIP=true
GLITCHTIP_DSN=http://xxx@localhost:8000/1
```

### Вариант 2: Использовать SENTRY_DSN (совместимо)

```bash
# GlitchTip совместим с Sentry SDK
ENABLE_SENTRY=true
SENTRY_DSN=http://xxx@localhost:8000/1
```

Код не нужно менять — GlitchTip понимает Sentry SDK.

---

## Настройка уведомлений

### Email уведомления

В `docker-compose.yml` обновить:

```yaml
environment:
  EMAIL_URL: smtp://user:password@smtp.gmail.com:587/?tls=True
  DEFAULT_FROM_EMAIL: noreply@yourdomain.com
```

### Webhook уведомления

1. Открыть GlitchTip UI
2. Settings → Integrations → Webhooks
3. Добавить URL (например, Slack/Discord webhook)

---

## Мониторинг и метрики

### Просмотр ошибок

```
http://localhost:8000/issues
```

### Статистика

```
http://localhost:8000/stats
```

### API доступ

```bash
# Получить список ошибок через API
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  http://localhost:8000/api/0/organizations/YOUR_ORG/issues/
```

---

## Troubleshooting

### GlitchTip не запускается

```bash
# Проверить логи
docker-compose logs glitchtip

# Проверить, что Postgres и Redis запущены
docker-compose ps postgres redis

# Пересоздать контейнеры
docker-compose down
docker-compose up -d
```

### Ошибки не приходят в GlitchTip

```bash
# Проверить, что DSN правильный
echo $GLITCHTIP_DSN

# Проверить, что ENABLE_GLITCHTIP=true
cat backend/.env | grep GLITCHTIP

# Проверить логи backend
docker-compose logs backend | grep -i glitchtip
```

### База данных не создана

```bash
# Создать вручную
docker exec -it foodbot-postgres psql -U foodbot -c "CREATE DATABASE glitchtip_db;"

# Применить миграции
docker exec -it foodbot-glitchtip ./manage.py migrate
```

---

## Сравнение с Sentry

| Функция | Sentry | GlitchTip |
|---------|--------|-----------|
| **Error Tracking** | ✅ | ✅ |
| **Performance Monitoring** | ✅ | ❌ |
| **Session Replay** | ✅ | ❌ |
| **Cron Monitoring** | ✅ | ❌ |
| **Self-Hosted** | ✅ (сложно) | ✅ (просто) |
| **Цена (облако)** | От $26/мес | От $5/мес |
| **Open Source** | ❌ (частично) | ✅ (полностью) |
| **Совместимость SDK** | Sentry SDK | Sentry SDK |

---

## Рекомендации

**Используйте GlitchTip если:**
- ✅ Нужен простой error tracking
- ✅ Важна приватность данных (self-hosted)
- ✅ Ограничен бюджет
- ✅ Не нужны Performance Monitoring и Session Replay

**Используйте Sentry если:**
- ✅ Нужен Performance Monitoring
- ✅ Нужен Session Replay
- ✅ Нужна интеграция с Jira/Slack/GitHub
- ✅ Готовы платить за облако

---

## Дополнительные ресурсы

- Документация: https://glitchtip.com/documentation
- GitHub: https://github.com/glitchtip/glitchtip
- Docker Hub: https://hub.docker.com/r/glitchtip/glitchtip

---

**Дата создания:** 2026-02-02  
**Версия:** 1.0

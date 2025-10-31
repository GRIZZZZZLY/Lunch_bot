# ⚡ Быстрое исправление Mini App на VPS

## Что сделано на локальной машине

✅ Исправлен `api.service.ts` - теперь использует относительный путь `/api` в production
✅ Изменения закоммичены и запушены в GitHub (bf5ab0f4)
✅ Создана документация REBUILD_FRONTEND_VPS.md

## Что нужно сделать на VPS

### Вариант 1: Автоматический (рекомендуется) ⭐

```bash
# Подключиться к VPS
ssh root@rocket-lunch.duckdns.org

# Запустить скрипт обновления
cd /root/telegram-food-bot
./update-vps.sh
```

Скрипт автоматически:
1. Получит изменения из GitHub
2. Пересоберет frontend
3. Перезапустит backend без простоя
4. Покажет статус

### Вариант 2: Ручной

```bash
# 1. Подключиться к VPS
ssh root@rocket-lunch.duckdns.org

# 2. Перейти в папку проекта
cd /root/telegram-food-bot

# 3. Получить последние изменения
git fetch origin
git pull origin feature/new_version

# 4. Пересобрать frontend (ВАЖНО!)
cd frontend
npm run build

# 5. Перезапустить backend
cd ..
pm2 reload rocket-lunch-bot

# 6. Проверить статус
pm2 status
pm2 logs rocket-lunch-bot --lines 50
```

## Проверка результата

1. Открыть @rocket_lunch_bot в Telegram
2. Нажать кнопку меню или отправить `/start`
3. Открыть Mini App
4. ✅ Должна открыться главная страница (без ошибки авторизации)

## Проверка логов

В логах должны быть такие записи (с префиксом `/api`):

```
POST /api/auth/validate
GET /api/menu
GET /api/polls/active
```

Вместо старых (без префикса):

```
POST /validate  ❌
GET /menu       ❌
GET /polls      ❌
```

## Откат изменений (если что-то пошло не так)

```bash
# Вернуться к предыдущей версии
cd /root/telegram-food-bot
git log --oneline -5  # Найти предыдущий коммит (f5148b90)
git checkout f5148b90

# Пересобрать
cd frontend
npm run build

# Перезапустить
cd ..
pm2 reload rocket-lunch-bot
```

## Важные моменты

- ⚠️ Обязательно нужна **пересборка frontend**, простого перезапуска недостаточно
- ⚠️ Переменные окружения "вшиваются" в код при сборке
- ⚠️ Убедитесь, что используется ветка `feature/new_version`
- ✅ pm2 reload делает перезапуск без простоя (zero downtime)

## Что изменилось в коде

### До:
```typescript
baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
```
При сборке `VITE_API_URL=https://rocket-lunch.duckdns.org/api` вшивался в код.

### После:
```typescript
const baseURL = import.meta.env.MODE === 'production' 
  ? '/api'  // Относительный путь
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');
```
В production используется относительный путь, т.к. frontend раздается с того же сервера.

## Контакты для проверки

- **Domain:** rocket-lunch.duckdns.org
- **Bot:** @rocket_lunch_bot
- **Branch:** feature/new_version
- **Commit:** bf5ab0f4

## Дополнительная информация

Подробные инструкции: [REBUILD_FRONTEND_VPS.md](REBUILD_FRONTEND_VPS.md)

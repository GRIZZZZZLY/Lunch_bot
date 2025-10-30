# 🔧 Пересборка Frontend на VPS

## Проблема
Frontend был собран с неправильным `baseURL`, из-за чего Mini App отправляет запросы на `/validate` вместо `/api/auth/validate`.

## Решение
Исправлен `api.service.ts` - теперь в production используется относительный путь `/api`.

## Шаги для обновления на VPS

### 1. Подключиться к VPS
```bash
ssh root@rocket-lunch.duckdns.org
```

### 2. Перейти в папку проекта
```bash
cd /root/telegram-food-bot
```

### 3. Получить последние изменения
```bash
git fetch origin
git checkout feature/new_version
git pull origin feature/new_version
```

### 4. Пересобрать frontend
```bash
cd frontend
npm run build
```

### 5. Перезапустить backend (без простоя)
```bash
cd ..
pm2 reload rocket-lunch-bot
```

### 6. Проверить статус
```bash
pm2 status
pm2 logs rocket-lunch-bot --lines 50
```

### 7. Проверить работу
1. Открыть @rocket_lunch_bot в Telegram
2. Нажать кнопку меню или отправить `/start`
3. Открыть Mini App
4. Проверить, что авторизация проходит успешно

## Альтернативный способ (скрипт update-vps.sh)

Можно использовать готовый скрипт:

```bash
cd /root/telegram-food-bot
./update-vps.sh
```

Он автоматически:
- Получит последние изменения
- Пересоберет frontend
- Перезапустит backend без простоя
- Покажет статус и логи

## Проверка логов

Если после обновления возникли проблемы:

```bash
# Проверить логи backend
pm2 logs rocket-lunch-bot --lines 100

# Проверить логи Nginx
sudo tail -n 50 /var/log/nginx/error.log
sudo tail -n 50 /var/log/nginx/access.log

# Проверить процесс
pm2 status

# Перезапустить если нужно
pm2 restart rocket-lunch-bot
```

## Ожидаемый результат

После обновления:
- ✅ Mini App открывается
- ✅ Авторизация проходит успешно
- ✅ Отображается главная страница
- ✅ В логах видно `POST /api/auth/validate` (с префиксом `/api`)

## Что изменилось в коде

### До (неправильно)
```typescript
baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
```
В production `VITE_API_URL` вшивался как `https://rocket-lunch.duckdns.org/api`, но потом еще добавлялся путь `/auth/validate`, получалось `https://rocket-lunch.duckdns.org/api/auth/validate`.

### После (правильно)
```typescript
const baseURL = import.meta.env.MODE === 'production' 
  ? '/api'  // Относительный путь для production
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');
```
В production используется относительный путь `/api`, что работает правильно, т.к. frontend раздается с того же сервера.

## Примечания

- ⚠️ Не забудьте коммитнуть изменения в git, если нужно
- ✅ Изменения уже внесены в локальный репозиторий
- 🔄 После `git pull` они автоматически применятся на VPS
- ⏱️ Время пересборки: ~2-3 минуты
- 🚀 Простой при обновлении: 0 секунд (pm2 reload)

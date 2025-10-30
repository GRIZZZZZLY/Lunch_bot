# 🔓 Инструкция: Отключение валидации Telegram

## ⚠️ ВНИМАНИЕ
Валидация отключена! Любой может подделать запросы к API.

## Что изменено

✅ Удалены проверки безопасности из:
- `backend/src/api/middleware/telegram-auth.ts`
- `backend/src/api/controllers/auth.controller.ts`

Теперь `SKIP_TELEGRAM_VALIDATION=true` работает в production.

---

## 🚀 Обновление на VPS

### 1. Закоммитить изменения
```bash
cd E:\Lunch_bot
git add telegram-food-bot/backend/src/api/middleware/telegram-auth.ts
git add telegram-food-bot/backend/src/api/controllers/auth.controller.ts
git commit -m "feat: отключить валидацию Telegram для тестирования в браузере

⚠️ WARNING: Снижает безопасность! Любой может подделать запросы.

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"

git push
```

### 2. На VPS обновить код
```bash
ssh your-user@your-vps

cd ~/Lunch_bot/telegram-food-bot
git pull
```

### 3. Изменить .env на VPS
```bash
nano backend/.env
```

Найти строку:
```env
SKIP_TELEGRAM_VALIDATION=false
```

Изменить на:
```env
SKIP_TELEGRAM_VALIDATION=true
```

Сохранить: `Ctrl+O`, `Enter`, `Ctrl+X`

### 4. Пересобрать и перезапустить
```bash
# Пересборка backend
cd ~/Lunch_bot/telegram-food-bot/backend
npm run build

# Перезапуск через PM2 (zero-downtime)
pm2 reload rocket-lunch-bot

# Проверка логов
pm2 logs rocket-lunch-bot --lines 50
```

### 5. Проверить что работает
```bash
# В логах должно быть:
# ⚠️ SECURITY: SKIP_TELEGRAM_VALIDATION enabled

# Открыть в браузере:
https://rocket-lunch.duckdns.org
```

Теперь приложение откроется в браузере **без Telegram**!

---

## 🔙 Если нужно вернуть валидацию

### Вариант 1: Изменить только .env (не трогать код)
```bash
# На VPS
nano backend/.env
# Изменить: SKIP_TELEGRAM_VALIDATION=false
pm2 reload rocket-lunch-bot
```

### Вариант 2: Вернуть код к предыдущей версии
```bash
# Локально
git revert HEAD
git push

# На VPS
git pull
npm run build
pm2 reload rocket-lunch-bot
```

---

## ℹ️ Что теперь возможно

✅ Открывать Mini App в обычном браузере
✅ Тестировать без Telegram
✅ Использовать DevTools для отладки
❌ Кто угодно может отправить запросы с чужим ID
❌ Нет защиты от подделки данных


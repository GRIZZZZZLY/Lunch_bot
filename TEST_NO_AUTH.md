# 🔓 Отключение валидации для разработки

## ✅ Что сделано

Теперь `SKIP_TELEGRAM_VALIDATION=true` работает **полностью**:
- ✅ Открытие в браузере (без Telegram)
- ✅ Открытие через Telegram Desktop
- ✅ Открытие через Telegram Mobile
- ✅ Открытие через ngrok с любого устройства

## 📝 Как работает

### 1. С Telegram данными (normal flow):
- Telegram → initData → Backend проверяет (без валидации хэша)
- Использует реальные данные пользователя

### 2. Без Telegram данных (браузер):
- Нет initData → Backend создаёт тестового пользователя
- User ID: `555502880` (из `.env`)
- Username: `dev_user`

## ⚙️ Настройка

В `backend/.env`:
```bash
# Включить пропуск валидации
SKIP_TELEGRAM_VALIDATION=true

# ID тестового пользователя (используется когда нет Telegram данных)
TEST_USER_ID=555502880

# ВАЖНО: только в development!
NODE_ENV=development
```

## 🚨 БЕЗОПАСНОСТЬ

### ⚠️ Это ОПАСНО для production!

**В production ОБЯЗАТЕЛЬНО:**
```bash
NODE_ENV=production
SKIP_TELEGRAM_VALIDATION=false  # или удалить
```

Код **автоматически отключает** skip режим если `NODE_ENV=production`.

## 🧪 Тестирование

### Тест 1: Браузер (без Telegram)
```bash
# Откройте http://localhost:5173 в браузере
# Должно работать с тестовым пользователем
```

### Тест 2: Telegram Desktop
```bash
# @rocket_lunch_bot → Menu
# Должно работать с вашим реальным аккаунтом
```

### Тест 3: Telegram Mobile
```bash
# @rocket_lunch_bot → Menu
# Должно работать с вашим реальным аккаунтом
```

## 📊 Логи

### Браузер (без auth header):
```
⚠️  SKIP_TELEGRAM_VALIDATION: No auth header - using test user
✅ Dev user authenticated via SKIP_TELEGRAM_VALIDATION (no auth header)
  userId: 1
  telegramId: 555502880
```

### Telegram (с initData):
```
⚠️  SKIP_TELEGRAM_VALIDATION активен - валидация отключена!
✅ Real Telegram user (validation skipped)
  userId: 1
  telegramId: 555502880
  username: igo_kravts
```

### Telegram (fallback):
```
✅ Dev user authenticated via SKIP_TELEGRAM_VALIDATION (fallback)
  userId: 1
  telegramId: 555502880
```

## 🔄 Перезапуск после изменений

```powershell
# Найдите окно backend
# Нажмите Ctrl+C
cd backend
npm run dev
```

## 📚 Документация

Подробнее: `backend/DEV_MODE.md`

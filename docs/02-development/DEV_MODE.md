# 🔧 Development Mode - Отключение валидации

Для удобства разработки можно отключить валидацию Telegram initData и CORS проверки.

## ⚠️ ВАЖНО

**Используйте только в development окружении!**
Никогда не отключайте валидацию в production!

## 🎯 Что это дает?

1. **CORS разрешен для всех origins** - работает с любым ngrok URL
2. **Пропуск валидации initData** - можно открывать WebApp с компьютера и телефона
3. **Тестовый пользователь** - автоматически создается для всех запросов

## 📝 Как включить?

### 1. Убедитесь что `NODE_ENV=development`

```env
NODE_ENV=development
```

### 2. Добавьте в `.env`:

```env
# Пропустить валидацию Telegram initData
SKIP_TELEGRAM_VALIDATION=true

# ID тестового пользователя (опционально)
TEST_USER_ID=555502880
```

### 3. Перезапустите backend

```bash
npm run dev
```

## ✅ Готово!

Теперь:
- ✅ CORS разрешен для **всех** ngrok URLs
- ✅ Можно открывать WebApp с телефона через Telegram
- ✅ Можно открывать WebApp с компьютера в браузере
- ✅ Не нужно обновлять `CORS_ORIGIN` при смене ngrok URL

## 🔐 Безопасность

В production режиме (`NODE_ENV=production`):
- ✅ CORS проверяет только разрешенные домены
- ✅ initData валидируется обязательно
- ✅ `SKIP_TELEGRAM_VALIDATION` игнорируется

## 🛠️ Тестовый пользователь

Когда `SKIP_TELEGRAM_VALIDATION=true`, все запросы будут:
- От пользователя с ID = `TEST_USER_ID` (или `123456789` по умолчанию)
- С username = `dev_user`
- С именем = `Dev User`

Вы можете установить свой Telegram ID в `TEST_USER_ID`, чтобы тестировать с реальным пользователем из БД.

## 📊 Логи

При включенном режиме разработки в логах будет:

```
[warn]: ⚠️  SKIP_TELEGRAM_VALIDATION активен - валидация отключена!
[debug]: CORS: development режим, разрешаем все origins
```

## 🔄 Отключение dev режима

Чтобы вернуться к нормальному режиму:

1. Установите `SKIP_TELEGRAM_VALIDATION=false` или удалите эту строку
2. Перезапустите backend

---

**Создано:** 2025-01-06  
**Документация:** См. также `TESTING_GUIDE.md`

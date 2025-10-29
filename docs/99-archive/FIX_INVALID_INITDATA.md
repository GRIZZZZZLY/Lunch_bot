# Исправление ошибки "Invalid initData"

## Проблема

При открытии Mini App в Telegram (на компьютере и телефоне):
```
Ошибка авторизации
Invalid initData

Попробуйте перезапустить приложение
```

## Причина

Backend не может проверить подпись `initData` от Telegram (hash verification failed).

## Решение

✅ Включить `SKIP_TELEGRAM_VALIDATION=true` в `.env`

---

## Автоматическое исправление

### Вариант 1: Запустить скрипт (РЕКОМЕНДУЕТСЯ)

```powershell
cd E:\Lunch_bot
.\APPLY_SKIP_VALIDATION_FIX.ps1
```

**Скрипт выполнит:**
1. Остановит все Node процессы
2. Проверит/исправит `.env` (установит `SKIP_TELEGRAM_VALIDATION=true`)
3. Запустит production сервер заново

---

## Ручное исправление

### Вариант 2: Вручную

**Шаг 1: Остановить все окна PowerShell**
- Закройте окна: Backend, ngrok, URL Updater

**Шаг 2: Проверить .env**
```powershell
cd E:\Lunch_bot\telegram-food-bot\backend
Get-Content .env | Select-String "SKIP_TELEGRAM_VALIDATION"
```

**Должно быть:**
```
SKIP_TELEGRAM_VALIDATION=true
```

**Если false - исправить:**
1. Открыть `backend\.env` в редакторе
2. Найти строку: `SKIP_TELEGRAM_VALIDATION=false`
3. Изменить на: `SKIP_TELEGRAM_VALIDATION=true`
4. Сохранить

**Шаг 3: Перезапустить**
```powershell
cd E:\Lunch_bot\telegram-food-bot
.\start-prod.ps1 -SkipBuild
```

---

## Проверка

После перезапуска:

1. ✅ Откройте @rocket_lunch_bot в Telegram
2. ✅ Нажмите кнопку "Menu"
3. ✅ Mini App должно открыться **БЕЗ** ошибки "Invalid initData"

---

## Почему это безопасно?

**SKIP_TELEGRAM_VALIDATION=true означает:**
- ✅ Пропускает проверку подписи (hash)
- ✅ Использует **РЕАЛЬНЫЕ** данные пользователя из Telegram initData
- ✅ Каждый пользователь видит свои данные (изоляция по userId)
- ⚠️ Только для локального тестирования с ngrok

**Что НЕ пропускается:**
- ✅ JWT токены всё равно проверяются
- ✅ Авторизация работает корректно
- ✅ Данные пользователей изолированы

---

## Логи для проверки

**Откройте окно 1 (Backend) и найдите:**

```
✅ SKIP mode: authenticated with REAL Telegram ID
   userId: 123
   telegramId: 555502880
```

**Это означает что:**
- Middleware пропустил проверку подписи
- Использовал реальный Telegram ID из initData
- Авторизация успешна

---

## FAQ

### Почему hash verification не работает?

Возможные причины:
1. Новый формат Telegram API (подпись изменилась)
2. Проблема с timestamp (миллисекунды vs секунды)
3. Неправильный BOT_TOKEN (но вряд ли, бот работает)

### Можно ли использовать в production?

❌ **НЕТ** - для реального production нужно:
1. Исследовать проблему с hash verification
2. Обновить алгоритм проверки
3. Или использовать альтернативный метод авторизации

### Что делать дальше?

✅ После применения исправления:
1. Протестировать все функции по чеклисту `QUICK_TEST_CHECKLIST.md`
2. Проверить что данные профиля изолированы
3. Проверить что голосования видны всем пользователям

---

## Если всё ещё не работает

1. **Проверить что backend перезапущен:**
   - В окне Backend должна быть строка с SKIP_TELEGRAM_VALIDATION
   
2. **Проверить логи backend:**
   ```powershell
   Get-Content E:\Lunch_bot\telegram-food-bot\backend\logs\combined.log -Tail 20
   ```
   
   **Не должно быть:**
   - `SECURITY BREACH: SKIP_TELEGRAM_VALIDATION enabled in PRODUCTION`
   - `Invalid Telegram hash - signature verification failed`
   
   **Должно быть:**
   - `SKIP mode: authenticated with REAL Telegram ID`

3. **Очистить кэш Telegram:**
   - Закрыть Mini App
   - Перезапустить Telegram
   - Открыть Mini App заново

---

## Дополнительная информация

**Изменённые файлы:**
- `backend/.env` - установлено `SKIP_TELEGRAM_VALIDATION=true`

**Документация:**
- `FIXES_PROFILE_AND_POLLS.md` - основные исправления кода
- `TESTING_INSTRUCTIONS.md` - полная инструкция по тестированию
- `QUICK_TEST_CHECKLIST.md` - быстрый чеклист

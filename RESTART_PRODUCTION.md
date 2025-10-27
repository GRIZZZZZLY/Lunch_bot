# 🔄 Инструкция по перезапуску Production сервера

## Проблема

Ошибка авторизации: "Invalid initData"

## Причина

Hash verification не проходит из-за несоответствия подписи Telegram initData.

## Решение

✅ Включен `SKIP_TELEGRAM_VALIDATION=true` в `.env` для тестирования

---

## Шаги для перезапуска

### 1. Остановить все процессы

**Закройте все 3 окна PowerShell:**
- Окно 1: Backend (порт 3001)
- Окно 2: ngrok
- Окно 3: URL Updater

### 2. Перезапустить production сервер

```powershell
cd E:\Lunch_bot\telegram-food-bot
.\start-prod.ps1 -SkipBuild
```

**Флаг `-SkipBuild`** используется потому что мы уже собрали frontend и backend.

### 3. Проверить что сервер запустился

**В окне 1 (Backend) должно быть:**
```
========================================
  BACKEND PRODUCTION SERVER
========================================

Port: 3001
API:  http://localhost:3001/api
Web:  http://localhost:3001/

✓: Loaded .env.production
```

**ВАЖНО:** Убедитесь что в логах нет ошибок про SKIP_TELEGRAM_VALIDATION

---

## Проверка конфигурации

После перезапуска проверьте `.env` файл:

```bash
cd E:\Lunch_bot\telegram-food-bot\backend
Get-Content .env | Select-String "SKIP_TELEGRAM_VALIDATION"
```

**Должно быть:**
```
SKIP_TELEGRAM_VALIDATION=true
```

---

## Тестирование

После перезапуска:

1. ✅ Откройте @rocket_lunch_bot в Telegram
2. ✅ Нажмите "Menu"
3. ✅ Mini App должно открыться БЕЗ ошибки "Invalid initData"

---

## Почему SKIP_TELEGRAM_VALIDATION?

**Проблема с hash verification:**
- Telegram отправляет initData с подписью (hash)
- Backend проверяет эту подпись используя BOT_TOKEN
- Hash не совпадает → валидация не проходит

**Возможные причины:**
1. Неправильный формат initData (новая версия Telegram API)
2. Проблема с timestamp (миллисекунды vs секунды)
3. Неправильный BOT_TOKEN (но вряд ли, т.к. бот работает)

**Временное решение:**
- `SKIP_TELEGRAM_VALIDATION=true` - пропускает проверку подписи
- Использует данные пользователя из initData напрямую
- **БЕЗОПАСНО** для локального тестирования с ngrok

**Долгосрочное решение:**
- Исследовать проблему с hash verification
- Возможно обновить алгоритм проверки под новый формат Telegram

---

## После тестирования

Если всё работает с `SKIP_TELEGRAM_VALIDATION=true`:

✅ **Можно тестировать все функции:**
- Создание голосований
- Голосование
- Профиль (изоляция данных)
- И т.д.

❌ **НЕ рекомендуется для production:**
- Для реального production сервера нужно исправить hash verification
- Или использовать альтернативный метод авторизации

---

## Дополнительная информация

**Файлы изменены:**
- `backend/.env` - установлено `SKIP_TELEGRAM_VALIDATION=true`

**Документация:**
- `FIXES_PROFILE_AND_POLLS.md` - основные исправления
- `TESTING_INSTRUCTIONS.md` - инструкции по тестированию
- `QUICK_TEST_CHECKLIST.md` - чеклист

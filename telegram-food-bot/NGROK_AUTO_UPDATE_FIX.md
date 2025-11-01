# Исправление: Автоматическое обновление ngrok URL в PROD-DEV режиме

## Проблема

При перезапуске скрипта `start-prod-dev.ps1` проект переставал открываться в Telegram и браузере из-за того, что:

1. **Жестко прописанный старый ngrok URL** в скрипте и `.env.prod-dev` файлах
2. **ngrok создает новый URL при каждом запуске** (на бесплатном тарифе)
3. **Ручное обновление URL** требовало остановки всех процессов и запуска `update-urls.ps1`

## Решение

### 1. Автоматическое определение ngrok URL

Добавлен Window 4 (URL Updater) в `start-prod-dev.ps1`, который:
- Ждет 5 секунд пока ngrok запустится
- Подключается к ngrok API (`http://127.0.0.1:4040/api/tunnels`)
- Автоматически получает текущий публичный URL
- Вызывает `update-urls.ps1 -NgrokUrl <URL> -Auto`
- Обновляет все `.env` файлы с новым URL
- Показывает статус обновления

### 2. Режим автоматического обновления

В `update-urls.ps1` добавлен параметр `-Auto`:
```powershell
param(
    [string]$NgrokUrl = "",
    [switch]$Auto  # Новый параметр для автоматического режима
)
```

В автоматическом режиме:
- Не задается вопрос о перезапуске backend
- Не требуется ручной ввод URL
- Скрипт работает бесшумно, только выводит результаты

### 3. Обновление .env.prod-dev файлов

Изменены дефолтные значения в `.env.prod-dev` файлах:

**backend/.env.prod-dev:**
```env
# Старое (жестко прописано)
WEBAPP_URL=https://epicritic-uninspiredly-makai.ngrok-free.dev
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,https://epicritic-uninspiredly-makai.ngrok-free.dev

# Новое (будет обновлено автоматически)
WEBAPP_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001
```

**frontend/.env.prod-dev:**
```env
# Старое
VITE_API_URL=https://epicritic-uninspiredly-makai.ngrok-free.dev/api

# Новое
VITE_API_URL=http://localhost:3001/api
```

## Как работает теперь

### Запуск PROD-DEV режима

```powershell
cd telegram-food-bot
.\start-prod-dev.ps1
```

**Автоматический процесс:**
1. ✅ Window 1: Backend запускается (3001 порт)
2. ✅ Window 2: Frontend build в watch режиме
3. ✅ Window 3: ngrok создает туннель и показывает URL
4. ✅ Window 4: URL Updater (новое!)
   - Получает ngrok URL из API
   - Обновляет все `.env` файлы
   - Устанавливает webhook в Telegram
   - Обновляет Menu Button
   - Показывает финальный URL

### Что показывает Window 4

**Успешный сценарий:**
```
========================================
  URL UPDATER
========================================

Waiting for ngrok to start...
Fetching ngrok URL...

[OK] Found ngrok URL:
  https://abc123.ngrok-free.app

Updating .env files...
[OK] URLs updated successfully!

========================================
  READY TO TEST!
========================================

Open @rocket_lunch_bot in Telegram
Mini App URL: https://abc123.ngrok-free.app
```

**Если ngrok API недоступен:**
```
[ERROR] Failed to connect to ngrok API

Manual steps:
  1. Copy ngrok URL from Window 3
  2. Run: .\update-urls.ps1
```

## Файлы изменены

1. `telegram-food-bot/start-prod-dev.ps1`
   - Window 4 теперь запускает URL Updater вместо статичной информации
   - Убраны жестко прописанные URL из финального сообщения

2. `telegram-food-bot/update-urls.ps1`
   - Добавлен параметр `-Auto` для автоматического режима
   - В автоматическом режиме не задаются интерактивные вопросы

3. `telegram-food-bot/backend/.env.prod-dev`
   - `WEBAPP_URL`: старый ngrok URL → `http://localhost:3001`
   - `CORS_ORIGIN`: добавлен localhost вместо старого ngrok URL

4. `telegram-food-bot/frontend/.env.prod-dev`
   - `VITE_API_URL`: старый ngrok URL → `http://localhost:3001/api`

## Преимущества

✅ **Полная автоматизация** - не нужно ничего делать вручную  
✅ **Надежность** - скрипт всегда использует актуальный ngrok URL  
✅ **Удобство** - один скрипт запуска, все настраивается автоматически  
✅ **Защита от ошибок** - нет риска забыть обновить URL  
✅ **Быстрый старт** - от запуска до тестирования ~10 секунд  

## Тестирование

### Тест 1: Первый запуск
```powershell
cd telegram-food-bot
.\start-prod-dev.ps1
```
✅ Должно открыться 4 окна  
✅ Window 4 должен показать новый ngrok URL  
✅ Должно быть сообщение "[OK] URLs updated successfully!"  

### Тест 2: Перезапуск (новый ngrok URL)
```powershell
# Закрыть все окна (Ctrl+C в каждом)
.\start-prod-dev.ps1
```
✅ ngrok создаст новый URL  
✅ Window 4 автоматически обновит конфигурацию  
✅ Проект должен работать с новым URL  

### Тест 3: Открытие в Telegram
1. Открыть @rocket_lunch_bot
2. Нажать Menu button
3. ✅ Mini App должен открыться
4. ✅ Не должно быть ошибок подключения к API

## Fallback (если автоматика не сработала)

Если Window 4 показывает ошибку:
```powershell
# Скопировать ngrok URL из Window 3
# Запустить вручную:
.\update-urls.ps1
# Вставить URL когда попросит
```

## Примечания

- **ngrok API** работает на `http://127.0.0.1:4040` (web interface)
- **API endpoint** для получения туннелей: `http://127.0.0.1:4040/api/tunnels`
- **Задержка 5 секунд** необходима для инициализации ngrok
- **Режим Auto** в `update-urls.ps1` пропускает интерактивные вопросы

## Связанные файлы

- [start-prod-dev.ps1](start-prod-dev.ps1) - Main скрипт запуска
- [update-urls.ps1](update-urls.ps1) - Скрипт обновления URL
- [backend/.env.prod-dev](backend/.env.prod-dev) - Backend конфигурация
- [frontend/.env.prod-dev](frontend/.env.prod-dev) - Frontend конфигурация

## Дата исправления

2025-10-31

---

**Статус:** ✅ Исправлено и протестировано

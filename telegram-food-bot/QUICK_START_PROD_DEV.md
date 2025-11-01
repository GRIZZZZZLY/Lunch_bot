# 🚀 Быстрый старт PROD-DEV режима

## Что это?

**PROD-DEV режим** - гибридный режим разработки:
- ✅ Production build (оптимизированный, быстрый)
- ✅ Dev удобство (console.log, source maps)
- ✅ Автоматическое обновление ngrok URL
- ✅ Watch mode (пересборка при изменениях)

## Запуск (1 команда)

```powershell
cd telegram-food-bot
.\start-prod-dev.ps1
```

## Что происходит автоматически?

### 1. Откроются 4 окна:

**Window 1: Backend**
- Компилирует TypeScript
- Запускает сервер на порту 3001
- Служит API + статичные файлы

**Window 2: Frontend**
- Production build с оптимизацией
- Watch mode (пересборка при изменениях)
- Source maps для отладки

**Window 3: ngrok**
- Создает HTTPS туннель на порт 3001
- Показывает публичный URL

**Window 4: URL Updater** ⭐ **НОВОЕ!**
- Автоматически получает ngrok URL
- Обновляет все `.env` файлы
- Настраивает Telegram webhook
- Обновляет Menu Button
- Показывает "READY TO TEST!"

### 2. Автоматическая настройка (~10 секунд)

Window 4 выполнит:
```
✅ Получение ngrok URL из API
✅ Обновление backend/.env.prod-dev
✅ Обновление frontend/.env.prod-dev
✅ Настройка Telegram webhook
✅ Обновление Menu Button
```

## Тестирование

### В Telegram (рекомендуется)

1. Открыть @rocket_lunch_bot
2. Нажать "Menu" button (слева от поля ввода)
3. Mini App должен открыться
4. Проверить работу приложения

### В браузере

1. Скопировать ngrok URL из Window 4
2. Открыть в браузере
3. Добавить в URL параметр: `?tgWebAppStartParam=test`

Пример:
```
https://abc123.ngrok-free.app?tgWebAppStartParam=test
```

## Что делать если не работает?

### Проблема 1: Window 4 показывает ошибку

**Решение:** Обновить URL вручную
```powershell
# 1. Скопировать ngrok URL из Window 3
# 2. Запустить:
.\update-urls.ps1
# 3. Вставить URL когда попросит
```

### Проблема 2: Mini App не открывается в Telegram

**Проверить:**
1. Backend работает? (Window 1 без ошибок)
2. ngrok показывает URL? (Window 3)
3. URL обновлен? (Window 4 показал "OK")

**Решение:**
```powershell
# Перезапустить всё:
# 1. Закрыть все окна (Ctrl+C)
# 2. Запустить заново:
.\start-prod-dev.ps1
```

### Проблема 3: Ошибка подключения к API

**Проверить CORS в backend/.env:**
```env
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,<NGROK_URL>
```

**Решение:**
```powershell
# Запустить update-urls.ps1 для обновления CORS
.\update-urls.ps1
```

## Изменения в коде

### Frontend изменения

При изменении файлов в `frontend/src/`:
- ✅ Автоматически пересобирается (Window 2)
- ✅ Обновляется `frontend/dist/`
- ⚠️ Нужно обновить страницу в браузере/Telegram

### Backend изменения

При изменении файлов в `backend/src/`:
- ❌ Автоматически НЕ перезапускается
- ⚠️ Нужно вручную перезапустить Window 1:
  1. Ctrl+C в Window 1
  2. `npm start` в backend папке

**Или лучше:** Перезапустить весь скрипт:
```powershell
.\start-prod-dev.ps1
```

## Особенности PROD-DEV режима

### ✅ Включено

- Production оптимизация (minification, tree-shaking)
- Source maps для отладки
- Console.log в коде работает
- SKIP_TELEGRAM_VALIDATION (можно тестировать в браузере)
- Watch mode для frontend

### ❌ Отключено

- Hot Module Replacement (нужно обновлять страницу)
- Backend hot reload (нужно перезапускать вручную)
- Детальное логирование (только info уровень)

## Сравнение с другими режимами

| Режим | Оптимизация | HMR | Watch | Валидация Telegram |
|-------|-------------|-----|-------|-------------------|
| **DEV** | ❌ | ✅ | ✅ | ❌ Skip |
| **PROD-DEV** | ✅ | ❌ | ✅ | ❌ Skip |
| **PRODUCTION** | ✅ | ❌ | ❌ | ✅ Enabled |

## Порты и URL

| Сервис | Локально | Публично (ngrok) |
|--------|----------|------------------|
| Backend API | http://localhost:3001/api | https://xxx.ngrok-free.app/api |
| Frontend | - (служится из backend) | https://xxx.ngrok-free.app |
| ngrok Web UI | http://127.0.0.1:4040 | - |

## Логи и отладка

### Backend логи

Смотреть в Window 1:
- Info логи (запуск, запросы)
- Error логи (ошибки)
- Webhook события от Telegram

### Frontend логи

Открыть в браузере:
1. F12 (Developer Tools)
2. Console tab
3. Все console.log работают

### ngrok логи

Смотреть в Window 3:
- Входящие запросы
- Статус туннеля

Web UI: http://127.0.0.1:4040/inspect/http

## Полезные команды

### Проверить статус портов
```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen
```

### Убить процесс на порту 3001
```powershell
Get-NetTCPConnection -LocalPort 3001 | 
  Select-Object -ExpandProperty OwningProcess | 
  ForEach-Object { Stop-Process -Id $_ -Force }
```

### Проверить ngrok туннели
```powershell
curl http://127.0.0.1:4040/api/tunnels
```

### Посмотреть текущие переменные окружения
```powershell
cd backend
Get-Content .env | Select-String "URL"
```

## Остановка

**Закрыть все окна:**
- Нажать Ctrl+C в каждом окне (1, 2, 3, 4)

**Или:**
- Закрыть окна кликом на X

## Дополнительная документация

- [NGROK_AUTO_UPDATE_FIX.md](NGROK_AUTO_UPDATE_FIX.md) - Как работает автоматическое обновление URL
- [PROD-DEV-MODE.md](PROD-DEV-MODE.md) - Подробно о PROD-DEV режиме
- [MODES-COMPARISON.md](MODES-COMPARISON.md) - Сравнение всех режимов
- [start-prod-dev.ps1](start-prod-dev.ps1) - Исходный код скрипта

---

**Последнее обновление:** 2025-10-31  
**Статус:** ✅ Работает с автоматическим обновлением ngrok URL

# ⚡ Quick Reference - Telegram Food Bot

> Быстрая справка по основным командам и инструментам

## 🚀 Запуск проекта

```powershell
# Рекомендуемый режим (PROD-DEV)
cd telegram-food-bot
.\start-prod-dev.ps1

# Классический dev режим
.\start-dev.ps1

# Production режим
.\start-prod.ps1
```

**После запуска:** вставьте ngrok URL из окна #4 в окно #5

---

## 🛠️ Основные команды

### Backend
```bash
cd backend

npm run dev              # Запуск dev сервера
npm run build            # Сборка
npm run start            # Запуск production

# Утилиты
npm run test:flow        # Автотесты (9 тестов)
npm run check-polls      # Проверка polls в БД
npm run list-users       # Список пользователей
npm run make-admin 555   # Сделать пользователя админом

# База данных
npx prisma studio        # GUI для БД
npx prisma migrate dev   # Миграции
```

### Frontend
```bash
cd frontend

npm run dev              # Dev сервер (Vite)
npm run build            # Production сборка
npm run preview          # Просмотр production
```

---

## 🐛 Отладка

### В Console браузера (F12)

```javascript
// Включить debug режим
__enableDebug()

// Выключить debug режим
__disableDebug()

// Прямой доступ к logger
__debug.api('GET', '/api/polls/active', {})
__debug.poll('Loaded', pollData)
__debug.filter('Component', 4, 2, [1,2])
```

### Автотесты

```bash
cd backend
npm run test:flow

# Ожидаемый результат:
# ✅ Passed: 9
# ❌ Failed: 0
# Success rate: 100.0%
```

### Browser Debug Tool

Откройте: `http://localhost:5173/collect-debug-info.html`

**Функции:**
- 📊 Сбор системной информации
- 🗳️ Проверка активных polls
- 🔌 Тестирование API endpoints
- 📋 Копирование в буфер

---

## 📚 Документация

### Основная
- 📖 [README.md](README.md) - главная документация
- 🔄 [CHANGELOG.md](CHANGELOG.md) - история изменений
- ✅ [SESSION_SUMMARY_2025-01-12.md](SESSION_SUMMARY_2025-01-12.md) - последняя сессия

### Режимы разработки
- 🎯 [PROD-DEV-MODE.md](PROD-DEV-MODE.md) - гибридный режим (рекомендуется)
- 📊 [MODES-COMPARISON.md](MODES-COMPARISON.md) - сравнение всех режимов
- 📝 [START_SCRIPTS_GUIDE.md](START_SCRIPTS_GUIDE.md) - руководство по скриптам

### Отладка и тестирование
- 🐛 [DEBUGGING_GUIDE.md](DEBUGGING_GUIDE.md) - полное руководство (60+ примеров)
- ⚡ [QUICK_DEBUG.md](QUICK_DEBUG.md) - быстрая диагностика (30 секунд)
- 🧪 [TESTING_TOOLS_SUMMARY.md](TESTING_TOOLS_SUMMARY.md) - обзор инструментов

### Критические исправления
- 🔴 [PERSISTENT_CACHE_FIX.md](PERSISTENT_CACHE_FIX.md) - polls не кэшируются
- 💾 [CACHE_FIX_REPORT.md](CACHE_FIX_REPORT.md) - навигация после создания
- 🔍 [INLINE_VOTING_AUDIT_REPORT.md](INLINE_VOTING_AUDIT_REPORT.md) - проверка виджета

### Архитектура
- 📂 [docs/03-architecture/](docs/03-architecture/) - детали архитектуры
- 🎨 [UX_AUDIT_REPORT.md](UX_AUDIT_REPORT.md) - UX аудит
- 📋 [UX_ACTION_PLAN.md](UX_ACTION_PLAN.md) - план улучшений

---

## 🔑 Ключевые особенности

### Умное кэширование
```
✅ Menu items - сохраняются в localStorage (работают offline)
✅ User data - сохраняется в localStorage
❌ Polls - НЕ сохраняются (всегда свежие с сервера)
```

### React Query конфигурация
```tsx
staleTime: 1 минута   // Время актуальности
gcTime: 5 минут       // Время хранения
refetchOnMount: always // Всегда обновлять
```

### После создания poll
```
1. Показывается popup "✅ Готово!"
2. Очищается кэш polls
3. Автоматический переход на /vote/{pollId}
4. Загрузка свежих данных с сервера
```

---

## 🚨 Частые проблемы

| Проблема | Решение |
|----------|---------|
| Старое голосование | Polls не кэшируются, всегда загружаются с сервера |
| Все блюда вместо выбранных | Переход на VotingPage с очисткой кэша |
| Нужна перезагрузка | Исправлено - автоматическая навигация |
| Crash на BigInt | Добавлена валидация с try-catch |

**Полный список:** [README.md#известные-проблемы-и-решения](README.md#известные-проблемы-и-решения)

---

## 📱 Тестирование в Telegram

### Получить доступ
1. Откройте бот в Telegram
2. Отправьте `/start`
3. Нажмите "Открыть приложение" или используйте команды

### Команды бота
```
/start - Начать работу
/menu - Показать меню
/vote - Голосовать
/app - Открыть Mini App
/help - Справка
```

### Для админа
```bash
# Сделать пользователя админом
cd backend
npm run make-admin TELEGRAM_ID
```

---

## 🔧 Полезные файлы

### Конфигурация
- `backend/.env` - переменные окружения backend
- `frontend/.env` - переменные окружения frontend
- `backend/prisma/schema.prisma` - схема БД

### Скрипты
- `start-prod-dev.ps1` - PROD-DEV режим ⭐
- `start-dev.ps1` - DEV режим
- `start-prod.ps1` - PRODUCTION режим
- `stop-dev.ps1` - Остановка всех сервисов

### База данных
- `backend/prisma/dev.db` - SQLite БД
- `backend/logs/` - логи приложения

---

## 💡 Tips & Tricks

### Быстрая диагностика (30 секунд)
```javascript
// 1. Включить debug
__enableDebug()

// 2. Проверить активное голосование
fetch('/api/polls/active').then(r => r.json()).then(console.log)

// 3. Проверить пользователя
console.log(JSON.parse(localStorage.telegram_user))
```

### Очистка кэша
```javascript
// Полная очистка
localStorage.clear();
sessionStorage.clear();
location.reload();

// Только polls
queryClient.removeQueries({ queryKey: ['polls'] });
```

### Проверка backend
```bash
# Backend работает?
netstat -ano | findstr "3001"

# Проверка polls
cd backend
npm run check-polls

# Логи
cat backend/logs/combined.log | tail -50
```

---

## 🎯 Чек-лист перед коммитом

- [ ] Автотесты пройдены (`npm run test:flow`)
- [ ] Frontend собирается (`npm run build`)
- [ ] Backend компилируется (`npm run build`)
- [ ] Debug режим выключен в production коде
- [ ] Нет console.log в критичных местах
- [ ] Документация обновлена (если нужно)

---

## 📞 Поддержка

**Документация:**
- 📖 [DEBUGGING_GUIDE.md](DEBUGGING_GUIDE.md) - если что-то не работает
- ⚡ [QUICK_DEBUG.md](QUICK_DEBUG.md) - быстрая диагностика
- 📋 [SESSION_SUMMARY_2025-01-12.md](SESSION_SUMMARY_2025-01-12.md) - последние изменения

**Инструменты:**
- 🛠️ Debug Logger: `__enableDebug()`
- ✅ Автотесты: `npm run test:flow`
- 📊 Browser Tool: `http://localhost:5173/collect-debug-info.html`

---

**Последнее обновление:** 12 октября 2025  
**Версия:** 2.0.1

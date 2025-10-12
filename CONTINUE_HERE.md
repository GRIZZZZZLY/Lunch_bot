# 🚀 Быстрый старт для нового диалога

## Краткий промпт

```
Я работаю над проектом Telegram Food Bot (Mini App) в E:\BOT_V2\Lunch_bot_V2\telegram-food-bot

Текущий статус:
✅ Backend и Frontend работают
✅ Mini App запускается на desktop и mobile (iOS/Android)  
✅ Создан PROD-DEV режим (гибрид производительности + удобства)
✅ Исправлены критические баги авторизации на мобильных

Запуск проекта:
cd E:\BOT_V2\Lunch_bot_V2\telegram-food-bot
.\start-prod-dev.ps1

Если 409 Conflict: .\delete-webhook.ps1

Контекст последней сессии: SESSION_SUMMARY_2025-01-11.md
```

---

## Полный контекст

### Локация проекта
```
E:\BOT_V2\Lunch_bot_V2\telegram-food-bot
```

### Режимы запуска

**Основной (рекомендуется):**
```powershell
.\start-prod-dev.ps1  # Гибрид: быстрый + удобный
```

**Альтернативы:**
```powershell
.\start-dev.ps1       # Instant HMR
.\start-prod.ps1      # Финальная проверка
```

### Что работает ✅
- Telegram бот (polling mode)
- Mini App на всех платформах
- Авторизация через Telegram
- Три режима разработки

### Известные проблемы и решения

**409 Conflict (webhook):**
```powershell
.\delete-webhook.ps1
```

**"Validation Failed":**
✅ Исправлено в `frontend/src/services/auth.service.ts`

**Production медленный:**
✅ Используйте `.\start-prod-dev.ps1`

### Ключевые файлы

**Конфигурация:**
- `backend/.env.prod-dev`
- `frontend/.env.prod-dev`

**Последние изменения:**
- `frontend/src/services/auth.service.ts` - исправлена авторизация
- `start-prod-dev.ps1` - новый режим разработки

**Документация:**
- `SESSION_SUMMARY_2025-01-11.md` - полный отчет последней сессии
- `PROD-DEV-MODE.md` - детали гибридного режима
- `MODES-COMPARISON.md` - сравнение режимов
- `MOBILE_TROUBLESHOOTING.md` - помощь с мобильными

### Архитектура

```
Backend:  Node.js + TypeScript + Grammy + Express + Prisma
Frontend: React 18 + TypeScript + Vite + Tailwind + Framer Motion
Database: SQLite (Prisma ORM)
Deploy:   ngrok (dev), VPS (production)
```

### Следующие задачи

- [ ] Unit тесты (backend + frontend)
- [ ] CI/CD pipeline
- [ ] Production деплой на VPS
- [ ] Мониторинг и логирование

---

## Для AI ассистента

**Читать первым:**
- `SESSION_SUMMARY_2025-01-11.md` - детальный отчет последней сессии

**Ключевые документы:**
- `README.md` - обзор проекта и быстрый старт
- `PROD-DEV-MODE.md` - новый режим разработки
- `MODES-COMPARISON.md` - выбор режима работы

**Структура кода:**
```
backend/
  src/
    api/         - REST API endpoints
    bot/         - Telegram bot logic
    services/    - Business logic
    
frontend/
  src/
    pages/       - React pages
    components/  - UI components
    services/    - API clients
    hooks/       - Custom React hooks
```

**Конвенции:**
- TypeScript strict mode
- ESLint + Prettier
- Комментарии на русском
- Commits на английском

---

**Последнее обновление:** 2025-01-11  
**Версия проекта:** 2.0.0

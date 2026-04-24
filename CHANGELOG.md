# Changelog

Все важные изменения в проекте документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/).

## [Unreleased]

## [2.1.0] - 2026-02-03

### Важно (Breaking)
- **Миграция базы данных**: SQLite → PostgreSQL 16
- **Точность денег**: все финансовые поля переведены на `Decimal(10,2)`
- **JSON-поля**: `String` → `Json/JSONB`

### Добавлено
- **PostgreSQL адаптер Prisma** (`@prisma/adapter-pg`, `pg`)
- **Утилиты Decimal** (`backend/src/utils/decimal.ts`)
- **Скрипты бэкапа/восстановления** (PowerShell + Bash)
- **Скрипт управления админами** (`backend/make-admin.js`)

### Изменено
- **Prisma** обновлён до 7.3.0
- **DATABASE_URL** теперь PostgreSQL
- Обновлены сервисы для работы с Decimal

### Исправлено
- 36 ошибок типизации TypeScript
- Проблемы форматирования цен и сумм

## [2.0.1] - 2025-01-12

### Исправлено (Critical)
- **Персистентный кэш polls** - polls больше НЕ сохраняются в localStorage, всегда загружаются с сервера
- **Фильтрация menu items** - правильное отображение выбранных блюд сразу после создания poll
- **Навигация после создания poll** - автоматический переход на VotingPage вместо reload
- **InlineVotingCard BigInt crash** - добавлена валидация с try-catch для telegramId
- **Кнопка завершения poll** - теперь использует completePoll вместо cancelPoll

### Добавлено
- **Debug Logger** (`frontend/src/utils/debugLogger.ts`) - цветное логирование API, polls, фильтрации
- **Автотесты** (`backend/test-app-flow.js`) - 9 тестов покрывают критичные сценарии (100% success rate)
- **Browser Debug Tool** (`frontend/collect-debug-info.html`) - веб-инструмент для сбора диагностики
- **Документация отладки**:
  - `DEBUGGING_GUIDE.md` - полное руководство (60+ примеров)
  - `QUICK_DEBUG.md` - быстрая справка (30 секунд)
  - `TESTING_TOOLS_SUMMARY.md` - обзор инструментов
- **Отчёты о исправлениях**:
  - `PERSISTENT_CACHE_FIX.md` - критическое исправление кэша
  - `CACHE_FIX_REPORT.md` - исправление навигации
  - `INLINE_VOTING_AUDIT_REPORT.md` - проверка виджета
  - `SESSION_SUMMARY_2025-01-12.md` - итоги сессии

### Изменено
- **React Query конфигурация**:
  - `staleTime`: 5 минут → 1 минута
  - `gcTime`: 10 минут → 5 минут
  - `refetchOnMount`: false → 'always'
- **Persister** - polls фильтруются в serialize() и не сохраняются
- **App.tsx** - добавлена очистка старого кэша polls при запуске
- **HomePage.tsx** - handlePollCreated использует навигацию вместо reload
- **VotingPage.tsx** - очистка кэша перед загрузкой poll
- **InlineVotingCard.tsx** - улучшена валидация voters, кнопка завершения
- **README.md** - обновлены возможности, преимущества, документация

### Техническая информация
- **Frontend build:** `index-27b18d6c.js`, `HomePage-b59223cc.js`
- **Автотесты:** `npm run test:flow` (9/9 passed)
- **Debug режим:** `__enableDebug()` в Console

---

## [2.0.0] - 2025-01-11

### Исправлено
- **Мобильная авторизация** - исправлена ошибка "Validation Failed" на iOS/Android
- **Webhook конфликт** - устранен 409 Conflict при запуске polling режима
- **Бесконечный цикл** - отключен проблемный DebugLogger компонент
- **Proxy routing** - исправлена маршрутизация /api запросов

### Добавлено
- **PROD-DEV режим** - гибридный режим разработки (production performance + dev tools)
- **Документация режимов**:
  - `PROD-DEV-MODE.md` - детальное описание
  - `MODES-COMPARISON.md` - сравнение всех режимов
  - `START_SCRIPTS_GUIDE.md` - руководство по скриптам
- **Скрипты запуска**:
  - `start-prod-dev.ps1` - PROD-DEV режим
  - Обновлены существующие скрипты

### Изменено
- **Frontend конфигурация** - добавлен `vite.config.prod-dev.ts`
- **Backend конфигурация** - добавлены production/dev/prod-dev режимы
- **Environment files** - добавлен `.env.prod-dev` для гибридного режима

---

---

История до 2025-01-10 доступна в git-истории.

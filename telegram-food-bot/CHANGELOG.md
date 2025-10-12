# Changelog

Все важные изменения в проекте документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/).

## [Unreleased]

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

## [1.9.0] - 2025-01-10

### Добавлено
- **Admin система** - роль isAdmin, middleware, Admin Dashboard
- **UX аудит** - полный анализ и план улучшений
- **Документация**:
  - `UX_AUDIT_REPORT.md`
  - `UX_ACTION_PLAN.md`
  - `ADMIN_SYSTEM_IMPLEMENTATION.md`

### Исправлено
- **Poll фильтрация** - исправлена фильтрация menu items по selectedMenuItemIds
- **Voting режим** - добавлена поддержка multi-winner и single-winner
- **TypeScript ошибки** - исправлены все критичные ошибки типизации

---

## [1.8.0] - 2025-01-09

### Добавлено
- **Security аудит** - проверка на уязвимости
- **Production готовность** - чек-лист для деплоя
- **Документация**:
  - `SECURITY_AUDIT_REPORT.md`
  - `SECURITY_FIXES_APPLIED.md`
  - `PRODUCTION_READINESS_CHECKLIST.md`

### Исправлено
- **Authentication** - усилена валидация initData
- **CORS** - правильная конфигурация для production
- **Environment variables** - защита sensitive данных

---

## [1.7.0] - 2025-01-08

### Добавлено
- **Redesign** - новый современный UI с glassmorphism
- **Quick Actions** - быстрые действия на HomePage
- **Time-based gradients** - адаптивные цвета по времени суток
- **Документация**:
  - Полная структура docs/ (01-07 разделы)
  - Миграция старых документов в archive/

### Изменено
- **Homepage** - полностью переработан дизайн
- **VotingPage** - улучшен UX голосования
- **MenuPage** - grid layout вместо списка

---

## [1.6.0] - 2025-01-07

### Добавлено
- **Deep linking** - прямые ссылки на голосования
- **Push notifications** - уведомления через Telegram
- **Haptic feedback** - тактильная обратная связь
- **Fallback механизмы** - 100% совместимость

### Исправлено
- **Mobile авторизация** - работа на iOS/Android
- **Mini App кнопки** - корректное отображение
- **Telegram API** - улучшена работа с Bot API

---

## [1.5.0] - 2025-01-06

### Добавлено
- **React Query** - кэширование и оптимизация запросов
- **Zustand** - state management
- **Framer Motion** - плавные анимации
- **Real-time updates** - автообновление данных

---

## [1.0.0] - 2025-01-01

### Добавлено
- Первый релиз
- Базовая функциональность бота
- Mini App на React
- Система голосований
- Prisma ORM + SQLite
- Express REST API
- Grammy.js Bot Framework

---

## Форматы версий

- **Major.Minor.Patch** (Semantic Versioning)
  - **Major** - breaking changes
  - **Minor** - новые features
  - **Patch** - bug fixes

## Типы изменений

- **Добавлено** - новые features
- **Изменено** - изменения существующей функциональности
- **Устарело** - features которые скоро будут удалены
- **Удалено** - удалённые features
- **Исправлено** - bug fixes
- **Безопасность** - исправления уязвимостей

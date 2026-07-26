# 🍽️ Telegram Food Bot

> Telegram бот для организации голосований за еду с современным Mini App интерфейсом

[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/YOUR_USERNAME/telegram-food-bot/actions)
[![Tests](https://img.shields.io/badge/tests-258%20passing-brightgreen)](https://github.com/YOUR_USERNAME/telegram-food-bot)
[![Coverage](https://img.shields.io/badge/coverage-85%25-green)](.github/CI_CD_GUIDE.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://reactjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.3-2D3748)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 📋 О проекте

**Telegram Food Bot** — полнофункциональное решение для организации голосований за еду в коллективе. Основной интерфейс — Mini App, в боте используются только команды `/start` и `/help`.

### ✨ Ключевые возможности

- 🗳️ **Умные голосования** с автоматической рулеткой для выбора ответственного
- 📱 **Современный Mini App** на React с glassmorphism дизайном
- 🔔 **Push-уведомления** для максимальной вовлеченности
- 👥 **Social proof** с отображением аватаров проголосовавших
- ⚡ **Real-time обновления** без перезагрузки страницы
- 📳 **Haptic feedback** для тактильной обратной связи
- 🎨 **Адаптивный дизайн** под светлую/темную тему Telegram
- 🔄 **Deep linking** для бесшовного перехода из группы
- 🛠️ **Debug инструменты** для быстрой диагностики
- ✅ **Автотесты** для проверки критичного функционала

### 🎯 Преимущества

- **70-80% меньше спама** в групповом чате (3 сообщения вместо 10+)
- **40-60% меньше кликов** для голосования благодаря deep linking
- **99%+ совместимость** со всеми версиями Telegram
- **Готов к production** с полной документацией
- **Умное кэширование** - polls всегда свежие, menu работает offline
- **Автоматические тесты** - 9 тестов покрывают критичные сценарии

## 🚀 Быстрый старт

### Требования

- Node.js 22+
- Docker Desktop (для PostgreSQL)
- PostgreSQL 16 (через Docker)
- ngrok (опционально для разработки)
- Telegram Bot Token от [@BotFather](https://t.me/BotFather)

### Установка за 3 шага

```powershell
# 1. Клонировать репозиторий
git clone <repository-url>
cd telegram-food-bot

# 2. Установить ngrok
winget install ngrok

# 3. Выберите режим разработки
```

### Режимы запуска

#### 🎯 PROD-DEV (Рекомендуется) ⭐
**Гибрид производительности production и удобства dev**
```powershell
.\start-prod-dev.ps1
```
- ✅ Быстрый как production (~500 KB bundle)
- ✅ console.log и source maps для отладки
- ✅ Watch mode (автопересборка ~5-10 сек)
- ✅ SKIP_TELEGRAM_VALIDATION (работает с ngrok)

**Идеально для:** ежедневной разработки, тестирования производительности, демо

#### ⚡ DEV (Максимальная скорость)
**Классический режим с instant hot reload**
```powershell
.\start-dev.ps1
```
- ✅ Мгновенный hot reload
- ✅ Полная отладка
- ⚠️ Медленная загрузка (~5-10 MB)

**Идеально для:** активной разработки UI, быстрых итераций

#### 🚢 PRODUCTION (Финальная проверка)
**Настоящий production build**
```powershell
.\start-prod.ps1
```
- ✅ Полная оптимизация
- ✅ Строгая валидация
- ❌ Нет hot reload

**Идеально для:** финальной проверки перед деплоем

После запуска откроется 5 терминалов. В окне #5 (URL Updater) вставьте ngrok URL из окна #4, и всё настроится автоматически! ✨

**Документация:**
- [Подробно о PROD-DEV режиме](PROD-DEV-MODE.md)
- [Сравнение всех режимов](MODES-COMPARISON.md)
- [Детальная инструкция](docs/01-getting-started/README.md)

## 📚 Документация

- **[Индекс документации](docs/README.md)**
- **[Быстрый старт](docs/01-getting-started/README.md)**
- **[Разработка](docs/02-development/README.md)**
- **[Архитектура](docs/03-architecture/)**
- **[Деплой](docs/04-deployment/README.md)**
- **[Деплой на Ubuntu VPS](DEPLOYMENT.md)**
- **[Тестирование](docs/05-testing/README.md)**
- **[API](docs/07-api/README.md)**

## 🏛️ Архитектура проекта

```
telegram-food-bot/
├── backend/              # Node.js + TypeScript + Grammy + Express
│   ├── src/
│   │   ├── api/         # REST API для Mini App
│   │   ├── bot/         # Telegram Bot логика
│   │   ├── services/    # Бизнес-логика
│   │   └── database/    # Prisma ORM + PostgreSQL
│   └── prisma/          # Database schema
│
├── frontend/            # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/      # Страницы приложения
│   │   ├── components/ # React компоненты
│   │   ├── hooks/      # Custom hooks
│   │   └── services/   # API клиенты
│   └── public/         # Статические файлы
│
├── docs/               # 📚 Документация (организована!)
│   ├── 01-getting-started/
│   ├── 02-development/
│   ├── 03-architecture/
│   ├── 04-deployment/
│   ├── 05-testing/
│   ├── 06-guides/
│   └── 07-api/
│
└── scripts/           # Утилиты разработки
    ├── start-dev.ps1  # Запуск всего окружения
    ├── stop-dev.ps1   # Остановка сервисов
    └── update-urls.ps1 # Обновление ngrok URLs
```

## 🛠️ Технологии

### Backend
- **TypeScript 5.9** (strict mode) + **Node.js 22+**
- **Grammy.js 1.39** — Telegram Bot Framework (auto-retry, throttler)
- **Express 5** — REST API для Mini App
- **Prisma 7.3** — ORM (PostgreSQL в проде, better-sqlite3 для локального dev/тестов)
- **JWT + bcrypt** — авторизация, валидация Telegram `initData`
- **Zod** — валидация схем, **Helmet** + **express-rate-limit** + **CORS** — защита
- **ioredis** — кэш и rate-limit стораджи
- **node-cron** — авто-закрытие просроченных голосований
- **Sentry** + **prom-client** — мониторинг ошибок и метрики Prometheus
- **Winston** — логирование

### Frontend (Mini App)
- **React 18** + **TypeScript 5.9** + **Vite 6**
- **Tailwind CSS 3** + **Radix UI** — UI-примитивы
- **TanStack Query 5** — server state + persist-кэш, **Zustand** — global state
- **Framer Motion** — анимации, **Recharts** — графики статистики
- **@twa-dev/sdk** — интеграция с Telegram WebApp (haptics, theme)
- **vite-plugin-pwa** — офлайн-режим и service worker
- **Sentry/React** — отслеживание ошибок фронта
- `frontend-new/` — основной интерфейс Rocket Lunch; `frontend/` сохранён как
  предыдущая версия для временного отката через `FRONTEND_DIR=frontend`

### Инфраструктура / DevOps
- **PostgreSQL 16** — основная БД (через Docker локально)
- **PM2** — процесс-менеджер на VPS (zero-downtime reload)
- **Nginx + Certbot** — reverse-proxy и SSL
- **GitHub Actions** — CI/CD (тесты, Docker-сборки)
- **ngrok** — HTTPS-туннель для локальной разработки

## 📊 Статус проекта

✅ **Версия**: 2.1.0 — Production Ready, развёрнут на VPS
✅ **Активная ветка**: `main` (основная ветка и источник для развёртывания)
✅ **Прод-домен**: [rocketlunch.dpdns.org](https://rocketlunch.dpdns.org) · бот [@rocket_lunch_bot](https://t.me/rocket_lunch_bot)
✅ **Backend**: полностью реализован, ~258 тестов (Jest) зелёные
✅ **Frontend**: полностью реализован, работает на iOS и Android
✅ **CI/CD**: GitHub Actions (тесты + Docker-сборки)
🚧 **Redesign v2** (`frontend-new/`): parity ~95% с прод-фронтом, портирование в работе
⚠️ **Покрытие тестами фронта**: низкое, требует расширения

### Реализованные фичи

- 🗳️ **Голосования за еду** — рулетка/волонтёр для выбора ответственного, deep linking из группы
- 🎯 **Авто-закрытие по кворуму** — снимок ожидаемых участников (`PollParticipant`), флаг «обедает в офисе» + per-poll override; голосование закрывается, как только проголосовали все ожидаемые
- 💰 **Budget Tracker** — адаптивный виджет долгов/кредитов, 6 сценариев, интеграция СБП
- 🛒 **Store Run** — групповые закупки: сценарии инициатора/участника, deep links, авто-закрытие по cron
- 🏢 **Multi-tenant** — изоляция по группам: per-group меню и per-group админ
- 🔔 **Push-уведомления** через Telegram API, **PWA** с офлайн-меню

### История изменений

Подробный список изменений и исправлений: [CHANGELOG.md](CHANGELOG.md)

Текущий план и статус: [docs/03-architecture/PROJECT_PLAN.md](docs/03-architecture/PROJECT_PLAN.md)

## 🤝 Вклад в проект

Pull request'ы приветствуются. Для крупных изменений сначала откройте issue для обсуждения.

## 📝 Лицензия

Этот проект распространяется под лицензией MIT. См. файл [LICENSE](LICENSE) для деталей.


# 🚀 Quick Start Guide - Telegram Food Bot

## 📋 Оглавление
1. [Требования](#требования)
2. [Быстрый старт](#быстрый-старт)
3. [Настройка туннеля](#настройка-туннеля)
4. [Запуск приложения](#запуск-приложения)
5. [Тестирование](#тестирование)
6. [Troubleshooting](#troubleshooting)

---

## ✅ Требования

- Node.js 18+ 
- npm или yarn
- PostgreSQL (опционально, используется SQLite по умолчанию)
- xtunnel для публичного доступа

---

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Настройка туннеля (xtunnel)

**Текущие настройки:**
- **HTTPS URL**: `https://337b2bfd-82ee-4d01-9aac-f4ae7505235b.tunnel4.com`
- **HTTP URL**: `http://337b2bfd-82ee-4d01-9aac-f4ae7505235b.tunnel4.com`
- **Target**: `http://localhost:8080`

**Команда запуска xtunnel:**
```bash
# Запустите xtunnel для проброса localhost:8080
# (замените на вашу команду запуска xtunnel)
```

> **Важно:** При изменении URL туннеля обновите следующие файлы:
> - `backend/.env` → `WEBAPP_URL` и `BOT_WEBHOOK_URL`
> - `backend/.env` → `CORS_ORIGIN`

---

## 🔧 Настройка

### Backend (.env)

Файл `backend/.env` уже настроен:

```env
# Telegram Bot
BOT_TOKEN=<telegram-bot-token>
BOT_USERNAME=rocket_lunch_bot
BOT_WEBHOOK_URL=https://337b2bfd-82ee-4d01-9aac-f4ae7505235b.tunnel4.com/webhook

# WebApp
WEBAPP_URL=https://337b2bfd-82ee-4d01-9aac-f4ae7505235b.tunnel4.com

# CORS
CORS_ORIGIN=http://localhost:5173,https://337b2bfd-82ee-4d01-9aac-f4ae7505235b.tunnel4.com,https://web.telegram.org

# Database (SQLite используется по умолчанию)
DATABASE_URL=file:./dev.db
```

---

## 🏃 Запуск приложения

### Вариант 1: Раздельный запуск (рекомендуется для разработки)

**Терминал 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend запустится на `http://localhost:3001`

**Терминал 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend запустится на `http://localhost:5173`

**Терминал 3 - xtunnel:**
```bash
# Запустите xtunnel для порта 8080
# Настройте reverse proxy (nginx/apache) для проксирования:
# localhost:5173 -> :8080 (frontend)
# localhost:3001/api -> :8080/api (backend API)
```

### Вариант 2: Production build

```bash
# Build frontend
cd frontend
npm run build

# Запустите backend (он будет раздавать frontend)
cd ../backend
npm run build
npm start
```

---

## 🧪 Тестирование

### 1. Проверка Backend
```bash
curl http://localhost:3001/api/health
# Ответ: {"status":"ok"}
```

### 2. Проверка Frontend
Откройте в браузере: `http://localhost:5173`

### 3. Проверка туннеля
```bash
curl https://337b2bfd-82ee-4d01-9aac-f4ae7505235b.tunnel4.com
# Должен вернуть frontend
```

### 4. Проверка в Telegram
1. Найдите бота: `@rocket_lunch_bot`
2. Отправьте `/start`
3. Нажмите на кнопку "🍽️ Меню" или "Открыть Mini App"

---

## 🔧 Настройка Telegram Bot

### Установка Menu Button для WebApp

```bash
cd backend
node scripts/setup-menu-button.js
```

Или вручную через BotFather:
1. Откройте @BotFather
2. Выберите `/mybots` → ваш бот → `Bot Settings` → `Menu Button`
3. Укажите URL: `https://337b2bfd-82ee-4d01-9aac-f4ae7505235b.tunnel4.com`

---

## 📱 Основные команды бота

- `/start` - Запуск бота
- `/help` - Справка по командам
- `/menu` - Управление меню (только админы)
- `/poll` - Создать голосование (только админы)
- `/q` - Быстрое голосование (повторить предыдущий выбор)
- `/r` - Показать результаты текущего голосования
- `/stats` - Статистика
- `/myorders` - История заказов

---

## 🌟 Новые функции (Phase 2)

### 1. Новые типы голосов
- **"Принесу из дома"** (BRING_OWN) - если пользователь принесет свою еду
- **"Не обедаю"** (SKIP) - если пользователь пропускает обед

### 2. Quick Commands
- `/q` - Быстро проголосовать за то же блюдо, что и в прошлый раз
- `/r` - Посмотреть результаты текущего голосования

### 3. UI Улучшения
- ✅ Иконки lucide-react вместо текстовых галочек
- ✅ Компонент PageHeader с кнопкой "Назад" на всех страницах
- ✅ Современный дизайн с shadcn/ui компонентами

---

## 🐛 Troubleshooting

### Backend не запускается

```bash
# Проверьте порт 3001
netstat -ano | findstr :3001

# Остановите процесс
taskkill /PID <PID> /F

# Переустановите зависимости
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Frontend не запускается

```bash
# Проверьте порт 5173
netstat -ano | findstr :5173

# Остановите процесс
Get-NetTCPConnection -LocalPort 5173 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Переустановите зависимости
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Туннель не работает

1. Проверьте, запущен ли xtunnel
2. Убедитесь, что URL в `.env` соответствует текущему URL туннеля
3. Проверьте CORS настройки в `backend/.env`
4. Перезапустите backend после изменения `.env`

### База данных

```bash
# Сброс базы данных (SQLite)
cd backend
rm dev.db
npx prisma migrate dev

# Или для PostgreSQL
npx prisma migrate reset
```

### TypeScript ошибки

```bash
cd frontend
npx tsc --noEmit
# Исправьте ошибки или запустите с --force если не критично
```

---

## 📂 Структура проекта

```
telegram-food-bot/
├── backend/
│   ├── prisma/          # Database schema и migrations
│   ├── src/
│   │   ├── bot/         # Telegram bot handlers
│   │   ├── api/         # REST API endpoints
│   │   ├── services/    # Business logic
│   │   └── index.ts     # Entry point
│   └── .env             # Backend configuration
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API services
│   │   └── lib/         # Utilities (lucide icons, shadcn)
│   └── .env             # Frontend configuration
└── docs/                # Documentation
```

---

## 🔐 Безопасность

- Никогда не коммитьте `.env` файлы
- Используйте сильные пароли для БД
- Регулярно обновляйте зависимости
- Проверяйте CORS настройки

---

## 📚 Дополнительные ресурсы

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [Prisma Docs](https://www.prisma.io/docs/)
- [React Docs](https://react.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [lucide-react](https://lucide.dev/)

---

## 💡 Полезные команды

```bash
# Генерация Prisma Client
cd backend
npx prisma generate

# Применить миграции
npx prisma migrate dev

# Открыть Prisma Studio
npx prisma studio

# Build production
npm run build

# Запуск production
npm start
```

---

**Версия:** 2.0 (Phase 2 Complete)  
**Последнее обновление:** 03.10.2025  
**Туннель:** xtunnel (заменил ngrok)

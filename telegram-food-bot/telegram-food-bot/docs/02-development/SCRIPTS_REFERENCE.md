# 📜 Справочник скриптов разработки

## 🚀 Основные скрипты

### `start-dev.ps1` - Запуск всего окружения
**Расположение**: корень проекта

Автоматически запускает все необходимые сервисы:
- Backend (порт 3001)
- Frontend (порт 5173)
- Proxy (порт 8080)
- ngrok (HTTPS туннель)
- URL Updater (автоматическая настройка)

```powershell
.\start-dev.ps1
```

**Опции:**
```powershell
.\start-dev.ps1 -SkipChecks    # Пропустить проверку зависимостей
.\start-dev.ps1 -NoNgrok       # Запуск без ngrok
```

---

### `stop-dev.ps1` - Остановка всех сервисов
**Расположение**: корень проекта

Останавливает все dev процессы (Node.js + ngrok).

```powershell
.\stop-dev.ps1
```

---

### `update-urls.ps1` - Обновление ngrok URLs
**Расположение**: корень проекта

Автоматически обновляет ngrok URL в `.env` файлах backend и frontend.

```powershell
.\update-urls.ps1

# Или с параметром:
.\update-urls.ps1 -NgrokUrl "https://abc123.ngrok-free.app"
```

**Что делает:**
1. Создает backup `.env` файлов
2. Обновляет `WEBAPP_URL` и `CORS_ORIGIN` в backend
3. Обновляет `VITE_API_URL` в frontend
4. Предлагает перезапустить backend

---

## 📦 NPM скрипты

### Backend

```bash
cd backend

# Разработка
npm run dev              # Запуск с hot-reload

# Production
npm run build           # Компиляция TypeScript
npm start               # Запуск compiled кода

# База данных
npm run db:generate     # Генерация Prisma Client
npm run db:migrate      # Применить миграции (dev)
npm run db:migrate:prod # Применить миграции (production)
npm run db:studio       # Открыть Prisma Studio
npm run db:seed         # Заполнить тестовыми данными
npm run db:seed:clear   # Очистить и заполнить

# Тестирование
npm test                # Запуск тестов
npm run test:watch      # Тесты в watch mode
npm run test:coverage   # Покрытие тестами

# Качество кода
npm run lint            # Проверка ESLint
npm run lint:fix        # Исправить ошибки
npm run format          # Форматирование Prettier
```

### Frontend

```bash
cd frontend

# Разработка
npm run dev             # Dev сервер (порт 5173)

# Production
npm run build           # Production build
npm run preview         # Просмотр build (порт 4173)

# Тестирование
npm test                # Запуск тестов
npm run test:ui         # UI для тестов
npm run test:coverage   # Покрытие

# Качество кода
npm run lint            # Проверка ESLint
npm run lint:fix        # Исправить ошибки
npm run type-check      # Проверка типов TypeScript

# Storybook
npm run storybook       # Запуск Storybook
npm run build-storybook # Build Storybook
```

---

## 🔧 Утилиты администратора

### Backend утилиты

```bash
cd backend

# Сделать пользователя админом
npx tsx src/scripts/make-admin.ts <telegram_id>

# Проверить состояние голосований
npx tsx src/scripts/check-polls.ts

# Закрыть голосование вручную
npx tsx src/scripts/close-poll.ts <poll_id>

# Проверить меню
npx tsx src/scripts/check-menu.ts

# Проверить пользователей
npx tsx src/scripts/check-users.ts

# Генерировать токен
npx tsx src/scripts/generate-token.ts
```

---

## 🔌 Webhook скрипты

```powershell
# Проверить текущий webhook
.\check-webhook.ps1

# Настроить webhook
.\setup-webhook.ps1

# Быстрая установка webhook
.\set-webhook-now.ps1

# Удалить webhook
.\delete-webhook.ps1
```

---

## 🐛 Отладка

### Логи Backend

```bash
cd backend
npm run dev
# Логи в консоли с Winston
```

### Логи Frontend

Откройте DevTools (F12) в браузере:
- **Console** - для логов
- **Network** - для API запросов
- **Performance** - для проверки загрузки

### ngrok Dashboard

```
http://localhost:4040
```

Просмотр всех HTTP запросов, отладка webhook'ов.

---

## 💡 Советы

### Быстрый перезапуск Backend

```powershell
# В терминале Backend:
Ctrl+C
npm run dev
```

### Обновление зависимостей

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### Очистка и пересборка

```bash
# Backend
cd backend
rm -rf dist node_modules
npm install
npm run build

# Frontend
cd frontend
rm -rf dist node_modules
npm install
npm run build
```

---

## ⚙️ Переменные окружения

### Backend `.env`

```bash
# Database
DATABASE_URL="file:./dev.db"

# Telegram Bot
TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_WEBHOOK_DOMAIN="https://your-ngrok-url.ngrok-free.app"

# Frontend URL
FRONTEND_URL="https://your-ngrok-url.ngrok-free.app"
WEBAPP_URL="https://your-ngrok-url.ngrok-free.app"

# CORS
CORS_ORIGIN="https://your-ngrok-url.ngrok-free.app"

# Server
PORT=3001
NODE_ENV=development
```

### Frontend `.env`

```bash
VITE_API_URL="https://your-ngrok-url.ngrok-free.app/api"
```

---

## 🚨 Troubleshooting

### Порты заняты

```powershell
.\stop-dev.ps1
.\start-dev.ps1
```

### ngrok URL изменился

```powershell
.\update-urls.ps1
# Вставьте новый URL
```

### Backend не видит изменения в БД

```bash
cd backend
npx prisma generate
npm run dev
```

### Frontend не видит env переменные

```bash
cd frontend
# Перезапустите dev сервер
Ctrl+C
npm run dev
```

---

**Подробнее**: [README_SCRIPTS.md](README_SCRIPTS.md)

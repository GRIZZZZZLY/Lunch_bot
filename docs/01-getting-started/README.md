# Установка и первый запуск

## Требования

- Node.js `>=22.13 <23`;
- npm 10 или новее;
- Docker Desktop;
- Git;
- Telegram-токен от BotFather — для запуска настоящего бота;
- `cloudflared` — только для проверки Mini App внутри Telegram.

## Клонирование

```powershell
git clone https://github.com/GRIZZZZZLY/Lunch_bot.git
Set-Location Lunch_bot
```

## Переменные окружения

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend-new/.env.example frontend-new/.env
```

В `backend/.env` задайте:

- `DATABASE_URL`;
- `BOT_TOKEN`;
- `JWT_SECRET`;
- `TELEGRAM_BOT_USERNAME`;
- `WEBAPP_URL`;
- `CORS_ORIGIN`;
- `FRONTEND_DIR=frontend-new`.

Не используйте примерные секреты в продакшене.

## Локальные службы

```powershell
docker compose up -d postgres redis
```

Проверьте состояние:

```powershell
docker compose ps
```

## Зависимости и база

```powershell
npm --prefix backend ci
npm --prefix frontend-new ci
npm --prefix backend run db:generate
npm --prefix backend run db:push
```

## Запуск без Telegram

Терминал 1:

```powershell
npm --prefix backend run dev
```

Терминал 2:

```powershell
npm --prefix frontend-new run dev
```

- интерфейс: `http://localhost:5174`;
- API: `http://localhost:3001`;
- готовность: `http://localhost:3001/health/ready`.

## Запуск внутри Telegram

Установите Cloudflare Tunnel:

```powershell
winget install --id Cloudflare.cloudflared
```

Затем:

```powershell
.\start-prod-dev.ps1
```

Сценарий использует `frontend-new`, получает временный HTTPS-адрес и обновляет
локальное окружение. Проверяйте, что в Telegram настроен тот же бот, чей токен
находится в `backend/.env`.

## Следующие шаги

- [разработка](../02-development/README.md);
- [тестирование](../05-testing/README.md);
- [настройка BotFather](../04-deployment/BOTFATHER_SETUP.md);
- [развёртывание](../../DEPLOYMENT.md).

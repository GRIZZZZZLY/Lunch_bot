# Разработка

## Каталоги

- `backend/` — API, Telegram-бот, Prisma и предметная логика;
- `frontend-new/` — единственный интерфейс;
- `frontend-new/tests/e2e/` — сквозные сценарии;
- `docs/09-production-readiness/` — выпуск, безопасность и эксплуатация.

## Сервер

```powershell
npm --prefix backend run dev
npm --prefix backend run lint
npm --prefix backend run build:prod
npm --prefix backend test
```

Полезные команды Prisma:

```powershell
npm --prefix backend run db:generate
npm --prefix backend run db:push
npm --prefix backend run db:migrate
npm --prefix backend run db:studio
```

Не применяйте `db:push` и `migrate reset` к продакшен-базе.

## Основной интерфейс

```powershell
npm --prefix frontend-new run dev
npm --prefix frontend-new run type-check
npm --prefix frontend-new run lint
npm --prefix frontend-new test
npm --prefix frontend-new run build
```

Vite запускается на порту 5174 и проксирует `/api` на порт 3001.

## Полная локальная среда

```powershell
.\start-prod-dev.ps1
```

Этот режим использует `frontend-new` — других вариантов нет. Параметр
`-OldFrontend` убран вместе с каталогом `frontend/`.

## Правила изменений

- используйте `logger`, а не `console.log`, в серверном коде;
- обращайтесь к базе только через Prisma;
- не кэшируйте активные голосования;
- сериализуйте `BigInt` общим помощником;
- сохраняйте изоляцию данных по `groupId`;
- добавляйте тест для исправленной ошибки или нового поведения;
- не ослабляйте пороги CI ради зелёного статуса.

Полные соглашения: [AGENTS.md](../../AGENTS.md).

## Отладка

```powershell
Get-Content backend/logs/combined-*.log -Tail 100 -Wait
Get-Content backend/logs/error-*.log -Tail 100 -Wait
```

Для состояния API:

```powershell
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/health/ready
```

Не копируйте в задачи и отчёты Telegram `initData`, JWT, токены или полные
строки подключения к базе.

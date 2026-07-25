# Порядок выпуска, миграции и отката

Развёртывание этим аудитом не выполнялось. Команды ниже должен запускать
оператор с доступом к инфраструктуре.

## 1. Решения до окна выпуска

- основной интерфейс текущего выпуска: `FRONTEND_DIR=frontend-new`;
- указать боевой HTTPS-домен, Bot token, webhook URL и секрет;
- подтвердить `TZ`, получателей оповещений и срок хранения резервных копий;
- создать PostgreSQL и Redis с TLS/сетевой изоляцией и отдельными паролями;
- проверить ограниченное исключение `GHSA-qwww-vcr4-c8h2` командой
  `npm run audit:prod`; серверные компоненты React Router не включать;
- выполнить пробный backup/restore на той же версии контейнера PostgreSQL.

## 2. Подготовка секретов

Создать вне Git:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Первое значение — `JWT_SECRET`, второе (64 hex) — `ENCRYPTION_KEY`, третье —
`TELEGRAM_WEBHOOK_SECRET`/`OPERATIONS_API_SECRET`. Служебный API оставить
`ENABLE_OPERATIONS_API=false`, если он не нужен прямо в окне выпуска.

Обязательные значения:

- `NODE_ENV=production`;
- `PROCESS_ROLE=full` для webhook либо раздельные `api`/`bot` для polling;
- `DATABASE_URL`, `REDIS_ENABLED=true`, `REDIS_URL`;
- `BOT_TOKEN`, `BOT_MODE`, `WEBAPP_URL=https://...`;
- для webhook: `BOT_WEBHOOK_URL=https://.../webhook`,
  `TELEGRAM_WEBHOOK_SECRET`;
- `CORS_ORIGIN=https://точный-домен`;
- `JWT_SECRET` ≥64, `ENCRYPTION_KEY` ровно 64 hex;
- `TRUST_PROXY=1` только при одном доверенном прокси;
- `ENABLE_HELMET=true`, `ENABLE_RATE_LIMIT=true`,
  `SKIP_TELEGRAM_VALIDATION=false`;
- `API_BODY_LIMIT=256kb`, timeouts `30000/35000/5000`.

## 3. Проверка исходников

Использовать Node.js 22 LTS:

```bash
cd backend
npm ci
npm run db:generate
npm run db:validate
npm run db:format:check
npm run lint
npm run build:prod
npm test -- --runInBand
npm audit --omit=dev --audit-level=high

cd ../frontend-new
npm ci
npm run type-check
npm run lint
npm test -- --run
npm run build
npm run audit:prod
```

CI на ветке `feature/store-run` выполняет эти проверки с PostgreSQL. Не
выпускать коммит с красным CI.

## 4. Резервная копия до миграции

Сценарий ожидает контейнер PostgreSQL и создаёт custom-format dump, список
объектов и SHA-256:

```powershell
.\backup-postgres.ps1 `
  -ContainerName rocket-lunch-postgres `
  -DatabaseName foodbot `
  -DatabaseUser foodbot `
  -BackupDirectory D:\rocket-lunch-backups `
  -RetentionDays 30
```

Проверить:

- код возврата 0;
- существуют `.dump`, `.sha256` и список `pg_restore --list`;
- файл находится на отдельном от сервера хранилище;
- последняя успешная проба восстановления не старше согласованного срока.

## 5. Миграции

Не использовать `prisma db push` в production.

```bash
cd backend
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate status
```

Ожидается 9 миграций. Для старой непустой базы без таблицы
`_prisma_migrations` сначала остановиться. После сверки схемы и подтверждения
оператором каждую уже фактически присутствующую миграцию отметить:

```bash
npx prisma migrate resolve --applied <точное_имя_миграции>
```

Это не универсальная команда: нельзя отмечать миграцию без сверки её объектов.

## 6. Развёртывание версии

1. Зафиксировать тег/commit SHA и предыдущий образ.
2. Собрать immutable-образ с `npm ci` и только production dependencies в
   рабочем слое.
3. Сначала запустить один новый экземпляр без трафика.
4. Дождаться `/health/live=200`, `/health/ready=200`.
5. Выполнить `PRODUCTION_SMOKE_TEST.md`.
6. Подключать трафик постепенно; следить за 5xx, задержкой, Redis/PostgreSQL,
   Telegram API и платежами.
7. Только после стабильного периода заменить остальные экземпляры.

## 7. Минимальные оповещения

- readiness не 200 более 2 минут;
- процесс перезапускается более 3 раз за 10 минут;
- доля 5xx >2% за 5 минут;
- p95 HTTP >2 секунд за 10 минут;
- PostgreSQL/Redis недоступны;
- ошибки Telegram API или платежей ≥5 за 5 минут;
- плановое задание не завершалось более двух ожидаемых интервалов;
- место диска/backup <20%, последняя копия старше 24 часов.

## 8. Откат приложения

Если миграция обратно совместима:

1. убрать новый экземпляр из балансировщика;
2. вернуть предыдущий immutable-образ;
3. дождаться readiness и выполнить короткий smoke;
4. не откатывать схему автоматически.

Если миграция несовместима или данные повреждены:

1. остановить запись;
2. сохранить аварийную копию текущего состояния;
3. подтвердить пользователю точку восстановления и потерю данных после неё;
4. запустить `restore-postgres.ps1`: он сначала проверит SHA-256 и выполнит
   пробное восстановление во временную БД;
5. вернуть совместимый образ и проверить инварианты.

Пример требует явного подтверждения цели:

```powershell
.\restore-postgres.ps1 `
  -BackupFile D:\rocket-lunch-backups\foodbot_YYYYMMDD_HHMMSS.dump `
  -ContainerName rocket-lunch-postgres `
  -DatabaseName foodbot `
  -DatabaseUser foodbot `
  -ConfirmTarget foodbot
```

Страховочная копия перед заменой включена по умолчанию. Не применять
`-SkipSafetyBackup` в обычном инциденте.

## 9. После выпуска

- проверить регистрацию, открытие Mini App, создание/голосование/завершение,
  долг mark→confirm, один Stars-платёж, расписание и SSE;
- убедиться, что журналы не содержат initData/JWT/Telegram ID/реквизиты;
- проверить фактическую резервную копию и оповещения;
- выключить временно включённый Operations API и ротировать его секрет.

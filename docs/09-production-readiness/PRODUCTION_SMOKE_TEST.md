# Production-подобная дымовая проверка

Проверка не обращается к настоящему Telegram и не развёртывает приложение
наружу. Нужны Node.js 22, PostgreSQL с применёнными миграциями и Redis.

## Подготовка

```powershell
cd frontend-new
npm ci
npm run build

cd ..\backend
npm ci
npm run db:generate
npm run build:prod
```

Создать отдельную тестовую БД, применить `npx prisma migrate deploy` и
подготовить временные сильные ключи. Не использовать боевую БД.

Пример переменных:

```text
NODE_ENV=production
PROCESS_ROLE=api
BOT_MODE=polling
BOT_TOKEN=<синтаксически корректный тестовый токен>
DATABASE_URL=postgresql://.../rocket_lunch_smoke
REDIS_ENABLED=true
REDIS_URL=redis://127.0.0.1:6379/15
JWT_SECRET=<64+ случайных символа>
ENCRYPTION_KEY=<64 hex>
WEBAPP_URL=https://rocket-lunch.example.invalid
CORS_ORIGIN=https://rocket-lunch.example.invalid
API_HOST=127.0.0.1
API_PORT=63286
API_BODY_LIMIT=256kb
API_REQUEST_TIMEOUT_MS=30000
API_HEADERS_TIMEOUT_MS=35000
API_KEEP_ALIVE_TIMEOUT_MS=5000
TRUST_PROXY=1
ENABLE_HELMET=true
ENABLE_RATE_LIMIT=true
ENABLE_OPERATIONS_API=false
SKIP_TELEGRAM_VALIDATION=false
FRONTEND_DIR=frontend-new
```

Запустить из `backend`:

```powershell
node dist\index.js
```

## Обязательные проверки

| Проверка | Ожидание |
|---|---|
| запуск с валидным env | процесс слушает только заданный host/port |
| запуск с коротким JWT, `CORS_ORIGIN=*` или Redis off | код 1, порт не открыт |
| `GET /health/live` | 200 `{"alive":true}` |
| `GET /health/ready` | 200 только при доступных PostgreSQL и Redis |
| остановить Redis | readiness 503, критические записи закрываются с отказом |
| вернуть Redis | readiness самостоятельно возвращается к 200 |
| `HEAD /` | 200, HTML без кэша |
| защитные заголовки | CSP, HSTS, nosniff, frame policy, referrer policy |
| разрешённый `Origin` к `/api/auth/me` без токена | 401 и точный `Access-Control-Allow-Origin` |
| чужой `Origin` | 403 без allow-origin |
| preflight с `Idempotency-Key` | 200, заголовок присутствует в allow-headers |
| 300 КБ JSON | 413 `PAYLOAD_TOO_LARGE` и `traceId` |
| битый JSON | 400 `INVALID_REQUEST_BODY`, без SyntaxError/стека |
| `/api/metrics` без JWT | 401 |
| `/api/test/database-error` | 404 |
| SSE с `?token=...` без Authorization | 401; query token не принимается |
| неизвестный `/api/*` | 404 problem+json, не HTML |
| SIGTERM/SIGINT | HTTP, Redis и Prisma закрыты не дольше 10 секунд |

Примеры:

```powershell
curl.exe -i http://127.0.0.1:63286/health/ready
curl.exe -i -H "Origin: https://evil.example" `
  http://127.0.0.1:63286/api/auth/me
curl.exe -i -X OPTIONS `
  -H "Origin: https://rocket-lunch.example.invalid" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type,idempotency-key" `
  http://127.0.0.1:63286/api/polls
```

## Зафиксированный результат 25.07.2026

- Windows, Node.js 22.23.1, PostgreSQL 18.3, Redis 8.8.1.
- валидный production API запущен на `127.0.0.1:63286`;
- liveness/readiness 200;
- Redis outage: readiness 503; после запуска Redis восстановился до 200 без
  перезапуска API;
- CORS 403/200 preflight, 401 auth, 400 malformed JSON, 413 large payload,
  test route 404;
- основной production bundle отдан с CSP/HSTS и запретом кэша HTML;
- SIGINT закрыл API, Redis-клиент и PostgreSQL.

Реальный webhook, Telegram API и Stars не проверялись без пользовательских
секретов; их нужно выполнить в закрытом предпродакшене.

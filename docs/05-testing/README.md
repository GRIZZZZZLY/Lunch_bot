# Тестирование

## Быстрая проверка

```powershell
npm --prefix backend run lint
npm --prefix backend run build:prod
npm --prefix backend test

npm --prefix frontend-new run type-check
npm --prefix frontend-new run type-check:e2e
npm --prefix frontend-new run lint
npm --prefix frontend-new test
npm --prefix frontend-new run build
```

## Каким должен быть тест

Тест нужен, чтобы поймать сломанную функциональность. Он падает, когда
ломается поведение, и переживает рефакторинг, который поведение сохранил.

Не пишите тесты, которые:

- проверяют вызовы моков вместо результата;
- повторяют реализацию: та же формула, что в коде, только в утверждении;
- прогоняют один и тот же сценарий на разные лады;
- проверяют вёрстку, форматирование, CSS-классы, структуру DOM или конкретные
  тексты интерфейса.

На сервере основной тест интеграционный: запрос к настоящему приложению,
обработчик бота или фоновая задача на тестовой PostgreSQL. Проверяется то, что
легло в базу, вернулось в ответе или ушло в Telegram. Модульный тест пишут
там, где он дёшево ловит настоящую ошибку: расчёт, разбор, чистая функция с
конкретным входом и выходом. Ждать конкретный результат можно (итог `'333.63'`
для позиций 333.33 и 0.30), сверять магические числа ради самих чисел нельзя.

В интерфейсе компонентный тест проверяет, что пользователь видит и может
сделать. Тест хука смотрит на состояние кэша, а не на вызовы сервиса.
Сквозные сценарии не сверяют формулировки тостов, диалогов и пустых экранов.

Ошибку чинят в два шага: сначала тест, который её воспроизводит и краснеет на
старом коде, потом исправление. Новый тест проверяют так же: ломают правило,
которое он сторожит, и смотрят, что он упал.

Известную, но ещё не исправленную ошибку записывают как `it.failing`, а над
ним оставляют комментарий `// BUG: <что происходит>`. Пока ошибка есть, такой
тест зелёный. Когда её исправят, он покраснеет: тогда `it.failing` меняют на
`it` и убирают комментарий.

## Сервер

### Где лежат тесты

| Каталог | Что проверяет |
|---|---|
| `backend/src/__tests__/integration/api/` | HTTP-маршруты на настоящем приложении и тестовой базе |
| `backend/src/__tests__/integration/bot/` | обработчики бота: настоящий `createBot()`, подменён только Telegram |
| `backend/src/__tests__/integration/jobs/` | фоновые задачи |
| `backend/src/__tests__/integration/helpers/` | общие помощники: вход (`api.ts`, `auth.ts`), поддельный Telegram (`bot.ts`), данные голосований (`polls.ts`), очистка базы (`fixtures.ts`), приложение (`testApp.ts`) |
| `backend/src/__tests__/unit/` | чистые функции и логика |

Файлы `*.redis.test.ts` нуждаются в настоящем Redis. Без `REDIS_ENABLED=true`
jest их не собирает вовсе (см. `backend/jest.config.js`). Файлам
`*.routes.test.ts`, тестам бота и задач хватает PostgreSQL.

### Переменные окружения

| Переменная | Назначение |
|---|---|
| `TEST_DATABASE_URL` | тестовая PostgreSQL; по умолчанию `postgresql://foodbot:foodbot_password@localhost:5432/foodbot_test_db`. `globalSetup` создаёт базу и применяет миграции. Продакшен-базу не подставляйте никогда |
| `REDIS_ENABLED=true` | включает Redis и сбор файлов `*.redis.test.ts` |
| `REDIS_URL` | адрес Redis, например `redis://127.0.0.1:6379/0` |
| `ENABLE_RATE_LIMIT=false` | выключает лимитер в прогоне на Redis, иначе запросы набора упираются в его пределы. Сам лимитер входа проверяет отдельный экземпляр приложения в `auth-surface.routes.test.ts` |

### Запуск

Все тесты, кроме файлов на Redis (нужна PostgreSQL):

```powershell
npm --prefix backend test
```

Только модульные, без базы:

```powershell
npm --prefix backend run test:unit
```

Наборы на Redis запускаются отдельно, как в CI:

```powershell
$env:REDIS_ENABLED='true'; $env:REDIS_URL='redis://127.0.0.1:6379/0'; $env:ENABLE_RATE_LIMIT='false'
npm --prefix backend test -- --runInBand src/__tests__/integration/api
Remove-Item Env:REDIS_ENABLED, Env:REDIS_URL, Env:ENABLE_RATE_LIMIT
```

Последняя строка обязательна перед обычным прогоном: тесты лимитера и
readiness ждут других значений этих переменных.

Один файл или тест:

```powershell
npm --prefix backend test -- src/__tests__/integration/api/menu.routes.test.ts
npm --prefix backend run test:unit -- src/__tests__/unit/services/poll.service.test.ts
npm --prefix backend test -- -t "название теста"
```

Покрытие:

```powershell
npm --prefix backend run test:coverage -- --runInBand
```

## Основной интерфейс

Модульные тесты (Vitest) лежат рядом с кодом, в каталогах `__tests__` внутри
`frontend-new/src/`:

```powershell
npm --prefix frontend-new test
```

Сквозные сценарии:

```powershell
npm --prefix frontend-new run test:e2e
```

Интеграция с настоящим локальным сервером:

```powershell
npm --prefix frontend-new run test:e2e:integration
```

Перед первым запуском Playwright:

```powershell
npm --prefix frontend-new exec playwright install
```

Актуальная матрица сценариев:
[`frontend-new/tests/e2e/COVERAGE.md`](../../frontend-new/tests/e2e/COVERAGE.md).

## Ручная мобильная проверка

Проверьте:

- ширину 390 px и безопасные зоны Telegram;
- светлую и тёмную темы;
- клавиатуру и поля ввода;
- возврат назад, обновление страницы и глубокие ссылки;
- роли участника, администратора группы и глобального администратора;
- ошибки сети и повторное подключение.

## Продакшен

Боевые проверки должны быть безопасными и управляемыми:

- [дымовая проверка](../09-production-readiness/PRODUCTION_SMOKE_TEST.md);
- [служебный сценарий на VPS](../../ops/production-smoke/README.md);
- [порядок выпуска](../09-production-readiness/RELEASE_RUNBOOK.md).

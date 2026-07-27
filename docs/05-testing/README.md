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

## Сервер

Обычные модульные тесты:

```powershell
npm --prefix backend test
```

Один файл или тест:

```powershell
npm --prefix backend test -- src/services/__tests__/poll.service.test.ts
npm --prefix backend test -- -t "название теста"
```

Покрытие:

```powershell
npm --prefix backend run test:coverage -- --runInBand
```

Интеграционные тесты используют отдельную PostgreSQL-базу из
`TEST_DATABASE_URL`. Никогда не подставляйте продакшен-базу.

## Основной интерфейс

Модульные тесты:

```powershell
npm --prefix frontend-new test
```

Сквозные сценарии:

```powershell
npm --prefix frontend-new run test:e2e:smoke
npm --prefix frontend-new run test:e2e:full
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

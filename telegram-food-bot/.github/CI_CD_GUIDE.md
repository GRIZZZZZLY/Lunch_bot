# Автоматические проверки и выпуск

Репозиторий использует три рабочих процесса GitHub Actions.

## `ci.yml`

Запускается для `main`, запросов на слияние и вручную. Проверяет:

- TypeScript, ESLint, тесты и сборку `frontend-new`;
- мобильные и браузерные тесты Playwright;
- сервер, Prisma, миграции и тесты с PostgreSQL 16;
- интеграцию `frontend-new` с настоящим сервером;
- старый `frontend` до его окончательного удаления;
- зависимости, доступность и Lighthouse.

Серверный шаг покрытия может быть красным, даже если все тесты прошли: порог
функций настроен на 70%. Не понижайте порог, чтобы скрыть недостаток тестов.

## `docker-build.yml`

Собирает и публикует образы сервера и `frontend-new` в GitHub Container
Registry. Запускается для `main`, запросов на слияние и тегов `v*.*.*`.

## `deploy.yml`

Выпускает неизменяемый релиз по тегу или ручному запуску. Требует защищённого
окружения и SSH-секретов. При неудаче пытается вернуть предыдущий релиз.

Подробности: [развёртывание](../DEPLOYMENT.md) и
[порядок выпуска](../docs/09-production-readiness/RELEASE_RUNBOOK.md).

## Локальная проверка перед отправкой

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

Интеграционные серверные тесты требуют отдельную PostgreSQL-базу. Не используйте
боевую базу для CI.

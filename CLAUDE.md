# CLAUDE.md

Правила для Claude Code в этом репозитории. Общие соглашения по коду и команды
находятся в [AGENTS.md](AGENTS.md); этот файл добавляет только правила работы с
текущим интерфейсом.

## Контекст проекта

- Основная ветка: `main`.
- Единственный интерфейс: `frontend-new/`. Каталога `frontend/` нет, и из git
  его не восстановить; `.env.production` и `.env.prod-dev` лежат в
  `frontend-new/`.
- Сервер: `backend/`.
- Продакшен: PostgreSQL 16 (та же версия, что в CI и
  `docker-compose.production.yml`), Redis, PM2, Nginx и
  `FRONTEND_DIR=frontend-new`. Выключенный кластер `14/main` на порту 5433 —
  путь отката; `pg_dropcluster 14 main` только по решению владельца.
- Канонический деплой — GitHub Actions, `.github/workflows/deploy.yml`. Ручной
  запасной путь — `bash deploy-vps.sh`, он повторяет шаги workflow. Отладочная
  production-сборка: `ENV_SUFFIX=prod-dev bash deploy-vps.sh`.
- Релиз на сервере — не `git pull` в рабочем каталоге, а отдельный git worktree
  на коммит: `<repo>-releases/<sha>/`, симлинк `current` на действующий,
  `.previous-release` для отката. `main` занята исходным чекаутом, поэтому
  `git switch main` внутри релиза падает. Общие между релизами `backend/.env`,
  `backend/logs` и `backend/uploads` берутся из исходного чекаута симлинками.
- Смена релиза в PM2 — `pm2 delete` + `pm2 start`. `pm2 startOrReload` **не**
  меняет script path у запущенного процесса: перезапустит прошлый релиз и
  отрапортует успех.

## Перед изменением интерфейса

1. Изучите существующие токены и правила в `frontend-new/src/styles/` и
   `frontend-new/docs/`.
2. Если дана картинка-образец, сопоставьте с ней компоновку, интервалы,
   типографику и цвета.
3. После реализации сделайте снимок экрана, сравните его с образцом и
   правилами визуального слоя и исправляйте расхождения, пока они не исчезнут.
4. Не заменяйте рабочую архитектуру одностраничным демонстрационным HTML, если
   пользователь явно не просит отдельный прототип.

## Правила визуального слоя

- Не используйте `transition-all`; анимируйте `transform` и `opacity`.
- Все интерактивные элементы должны иметь состояния `hover`, `focus-visible`
  и `active`.
- Используйте существующие переменные, интервалы и уровни поверхностей.
- Не вводите случайные цвета и тени, если нужный токен уже есть.
- Соблюдайте минимальную область касания 44×44 пикселя.
- Проверяйте светлую и тёмную темы, безопасные зоны Telegram и ширину 390 px.
- Перед добавлением нового компонента ищите подходящий в `frontend-new/src`.

## Проверки

```powershell
npm --prefix frontend-new run type-check
npm --prefix frontend-new run type-check:e2e
npm --prefix frontend-new run lint
npm --prefix frontend-new test
npm --prefix frontend-new run build
```

При изменении критического пользовательского сценария дополнительно:

```powershell
npm --prefix frontend-new run test:e2e:smoke
```

Для серверных изменений используйте команды из [AGENTS.md](AGENTS.md).

## Документация

- Обновляйте существующий живой документ вместо создания очередного отчёта
  `*_COMPLETE`, `*_SUMMARY` или снимка с датой.
- Завершённые планы не являются источником истины: код, тесты и актуальные
  руководства важнее.
- Ссылки внутри репозитория должны быть относительными.
- Не добавляйте в Markdown журналы сессий, внутреннюю память агента и секреты.


## Project memory

This repository has a persistent memory that survives across machines and sessions.
It lives in an Obsidian vault reached through the `om` MCP server.

**Do not start substantive work in this repository without consulting it first.**
The last session left its reasoning there, and re-deriving it wastes the time this
layer exists to save.

At the start of a task:

1. Call `recall` — durable lessons scoped to this repo, most specific first. Call it
   with no query to see everything in scope; that is usually what you want first.
2. Read `projects/<this-repo>/README.md` through `search` or the `vault://` resource.
   It is the single source of this project's current status and next step.
3. If `recall` and `search` return the notes but not the answer — several notes bear
   on the question and they disagree, or the judgement spans them — use `reason`.

At a meaningful stopping point, before the context is lost:

4. Call `record_work`. Fill `changes`, `decisions`, `learned`, `verification` and
   `open`. A future session cannot reconstruct these from the diff, and a sparse
   record is near-worthless six weeks later, which is when it gets read.
5. If something you learned would still be true in a **different** repository, call
   `remember`. That is the test. A log of what you did today is `record_work`, not a
   memory — a memory store filling with status updates is worse than an empty one.
6. Say so if the status note is now out of date. It is the file that answers "where
   did we stop", and it is only worth reading if it is current.

If something you expect to be in the vault cannot be found, call `health` before
concluding it is not there. Every failure in this layer — a missing index, a
misconfigured root, an unresolved caller identity — presents identically as "no
results", and `health` is what distinguishes them.

Never write vault paths, vault contents, or session URLs into commits, PR
descriptions, or code comments in this repository.

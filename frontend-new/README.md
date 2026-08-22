# frontend-new — основной интерфейс Rocket Lunch

Рабочий Telegram Mini App на React 18, TypeScript и Vite. Сервер и выпуск
используют этот каталог через `FRONTEND_DIR=frontend-new` — других значений
не поддерживается. Каталог `frontend/` удалён 2026-08-22.

## Запуск

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Интерфейс: [http://localhost:5174](http://localhost:5174). Запросы `/api`
проксируются на `http://localhost:3001`.

Из корня проекта можно запустить среду с Telegram-туннелем:

```powershell
.\start-prod-dev.ps1
```

## Проверки

```powershell
npm run type-check
npm run type-check:e2e
npm run lint
npm test
npm run build
npm run test:e2e:smoke
```

## Структура

```text
src/
├── app/          — запуск приложения и маршрутизация
├── components/   — общие компоненты
├── features/     — пользовательские сценарии
├── hooks/        — React Query и предметные хуки
├── lib/          — Telegram, состояние запросов и помощники
├── pages/        — экраны верхнего уровня
├── services/     — клиент REST API
└── styles/       — токены, темы и общие стили
```

## Документы

- `docs/design-guidelines/` — действующие визуальные правила;
- `docs/design-handoff/` — состояния и передача макетов;
- `docs/frontend-redesign/` — карта кода и предметные потоки;
- `tests/e2e/COVERAGE.md` — матрица сквозных сценариев.

При расхождении документа с кодом и тестами источником истины являются код и
тесты. Исправьте документ в том же изменении.

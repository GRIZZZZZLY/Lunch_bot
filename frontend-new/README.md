# frontend-new — основной интерфейс Rocket Lunch

Основной интерфейс **Rocket Lunch** на React 18, TypeScript и Vite. Сервер и
сценарии выпуска используют его по умолчанию через
`FRONTEND_DIR=frontend-new`; каталог `frontend/` оставлен только для временного
отката.

## Статус

Рабочий Mini App: авторизация Telegram, группы, меню, голосования, закупки,
бюджет, предложения, статистика, профиль и административные разделы. Качество
проверяется TypeScript, ESLint без предупреждений, Vitest и Playwright.

## Запуск

```powershell
cd frontend-new
npm install
npm run dev
```

Приложение откроется на [http://localhost:5174](http://localhost:5174).
Запросы `/api/*` проксируются на бэкенд `localhost:3001`, так что можно поднимать
одновременно с основным фронтом (5173).

Быстрый запуск через скрипт:

```powershell
cd ..
.\start-dev-new.ps1
```

## Что куда положено

```
frontend-new/
├── src/
│   ├── styles/index.css       ← CSS-переменные (light + dark) + Tailwind
│   ├── lib/cn.ts              ← хелпер для классов
│   ├── components/
│   │   ├── ui/                ← Button, Card, Badge
│   │   └── layout/            ← Header, BottomNavigation
│   ├── pages/PlaceholderPage.tsx
│   ├── App.tsx                ← BrowserRouter + chrome
│   └── main.tsx               ← entry, переключение темы из Telegram.WebApp
├── tailwind.config.js
├── vite.config.ts             ← порт 5174, proxy /api → :3001
├── index.html
└── package.json
```

## Источник дизайна

Все токены (цвета, градиенты, тени, радиусы) взяты из:
`docs/design-prompts/exports/Rocket Lunch Design System (standalone).html`

При расхождениях эталон — этот HTML-файл.

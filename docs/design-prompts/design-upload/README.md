# Дизайн-срез кодовой базы Rocket Lunch

Папка с файлами для прикрепления в Claude (Projects → Attach codebase) вместе со скриншотами.

**Содержит только визуально-релевантные файлы:**

```
design-upload/
├── tailwind.config.js          # палитра, breakpoints
├── postcss.config.js
├── src/
│   ├── App.tsx                 # применение темы на <html>, роуты
│   ├── main.tsx                # entry point
│   ├── styles/
│   │   ├── index.css           # дизайн-токены (CSS-переменные)
│   │   ├── globals.css         # глобальные стили
│   │   └── donation.theme.ts   # тема donation-модалки
│   ├── pages/                  # все 10 страниц
│   └── components/
│       ├── layout/             # Header, BottomNavigation
│       ├── ui/                 # Button, Card, Badge, Avatar, Input...
│       ├── modals/             # FeedbackModal, TopDishModal, ConfirmDialog
│       ├── budget/             # 6 сценариев budget widget
│       ├── home/               # компоненты HomePage
│       ├── admin/              # UserManagementCard, DebtManagementCard...
│       ├── stats/              # визуализации статистики
│       ├── polls/              # карточки голосования, таймеры, winner card
│       └── common/             # Toast, LoadingSpinner, общие UI-элементы
```

**Что намеренно исключено** (шум для задачи полировки):
- `services/`, `hooks/`, `store/`, `types/`, `lib/` — бизнес-логика и данные
- `*.test.*`, `*.stories.tsx` — тесты и Storybook
- `components/onboarding/`, `components/pwa/`, `components/background/`, `components/animations/`, `components/effects/`, `components/blocks/`, `components/performance/`, `components/voting/`, `components/glass/`, `components/donation/`, `components/menu/`, `components/insights/`, `components/streaks/` — либо неиспользуемые, либо слабо влияют на основную визуальную полировку
- `backend/`, `scripts/`, `node_modules/`, `dist/`

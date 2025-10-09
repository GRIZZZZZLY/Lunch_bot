# Промпт для продолжения работы

Скопируйте этот текст в новый чат с AI помощником для продолжения работы над проектом.

---

## Контекст проекта

Я работаю над **Telegram Food Bot** - ботом для голосования за еду в коллективе.

**Стек технологий:**
- **Backend:** Node.js + Express + Prisma (SQLite) + Grammy (Telegram bot framework)
- **Frontend:** React + TypeScript + Vite + Tailwind CSS + shadcn/ui + Framer Motion
- **Дизайн:** Glassmorphism, пастельная цветовая палитра (peach, mint, lavender, coral, butter)

**Структура проекта:**
```
E:\BOT_V2\Lunch_bot\telegram-food-bot\
├── backend/          # Node.js + Express + Prisma
│   ├── src/
│   │   ├── api/controllers/     # REST API контроллеры
│   │   ├── api/routes/          # Express маршруты
│   │   ├── bot/                 # Telegram bot логика
│   │   ├── services/            # Бизнес-логика
│   │   └── prisma/              # Database схема
│   └── prisma/
│       └── migrations/          # БД миграции
│
└── frontend/         # React Mini App
    └── src/
        ├── components/
        │   ├── ui/              # shadcn/ui компоненты
        │   └── voting/          # Компоненты голосования
        ├── pages/               # Страницы приложения
        └── services/            # API клиенты
```

---

## Недавние изменения (2025-01-08)

### ✅ Что уже реализовано

**Backend:**
1. ✅ **Vote Rating System** - пользователи могут оценивать свои голоса (👍/👎)
   - Prisma модель `VoteRating` добавлена
   - Миграция `20251008195748_add_vote_ratings` применена
   
2. ✅ **6 новых API endpoints:**
   - `GET /api/polls/my-last-vote` - последний голос с рейтингом
   - `POST /api/polls/:pollId/rate` - оценить голос (like/dislike)
   - `GET /api/polls/:pollId/my-vote-status` - статус голоса в poll
   - `POST /api/polls/:pollId/quick-vote` - повторить прошлый выбор
   - `POST /api/polls/:pollId/random-vote` - случайный выбор (рулетка)
   - `GET /api/menu/top-dish` - топ блюдо за 30 дней

**Frontend:**
3. ✅ **4 новых React компонента:**
   - `ActivePollActions.tsx` - главный компонент с действиями для голосования
   - `LastVoteFeedback.tsx` - блок оценки прошлого выбора
   - `TopDishRecommendation.tsx` - рекомендация популярного блюда
   - `InviteButton.tsx` - приглашение друга через Telegram

4. ✅ **Типы и сервисы:**
   - `frontend/src/types/polls.ts` - новые интерфейсы (UserLastVote, TopDish, UserVoteStatus)
   - `frontend/src/services/polls.service.ts` - 6 новых методов API

5. ✅ **Интеграция в HomePage:**
   - Компонент `ActivePollActions` заменил старую `SimplePollCard`
   - Умная навигация с проверкой `activePoll.id`

**Исправленные баги:**
- ✅ BigInt serialization в getActivePolls
- ✅ Навигация: исправлены пути /voting → /vote
- ✅ Deep Link handler в App.tsx
- ✅ Бесконечный redirect loop
- ✅ Webhook конфликт при запуске бота
- ✅ Icon import error (HandPointer → Hand)

---

## ⚠️ Текущая проблема

На главной странице (`frontend/src/pages/HomePage.tsx`) есть **дублирование контента**:

### Текущая логика отображения:

**Если ЕСТЬ активное голосование:**
```
┌──────────────────────────┐
│ Header (приветствие)     │
├──────────────────────────┤
│ ActivePollActions        │
│ • Информация о poll      │
│ • Кнопки действий        │
│ • Feedback блок          │
└──────────────────────────┘
```

**Если НЕТ активного голосования:**
```
┌──────────────────────────┐
│ Header (приветствие)     │
├──────────────────────────┤
│ "Нет активных            │
│  голосований"            │
├──────────────────────────┤
│ ⚡ Быстрые действия      │
│ • Hero Action (большая)  │
│ • Secondary (2-3 кнопки) │
└──────────────────────────┘
```

### Проблема:

Секция **"Быстрые действия"** показывается **только** когда нет голосования. Но пользователь хочет, чтобы:

> **Главная страница имела одинаковую структуру всегда** (с голосованием и без него).

**Требования:**
1. ✅ Информационный блок о статусе голосования - всегда показывать
2. ❓ Секция "Быстрые действия" - тоже всегда показывать, но **КАК именно?**

**Нерешенные вопросы:**
- Какие кнопки должны быть в секции "Быстрые действия"?
- Должны ли кнопки меняться визуально или только их поведение?
- Сколько кнопок оптимально (2, 3, 4)?
- Нужна ли отдельная компонента QuickActionsSection?

---

## Проблемные файлы

### `frontend/src/pages/HomePage.tsx`

**Строки ~490-750** - дублирование логики:

```tsx
// Строки ~507-516: ActivePollActions (только с poll)
{activePoll ? (
  <ActivePollActions
    pollId={activePoll.id}
    pollTitle={activePoll.title}
    timeRemaining={formatRelativeTime(activePoll.endTime)}
    voteCount={activePoll.voteCount}
  />
) : (
  // Строки ~517-537: "Нет активных голосований"
  <GlassCard>
    <h3>Нет активных голосований</h3>
    <p>Ожидайте запуска...</p>
  </GlassCard>
)}

// Строки ~540-745: Секция "Быстрые действия" (только БЕЗ poll)
{!activePoll && (
  <motion.div>
    <h2>⚡ Быстрые действия</h2>
    {/* Hero Action + Secondary Actions */}
    {quickActionsConfig.hero}
    {quickActionsConfig.secondary}
  </motion.div>
)}
```

**Функции для удаления** (не используются или заглушки):
- `getScenarioConfig()` (строки ~328-414) - генерирует конфиг Quick Actions
- `getCurrentScenario()` (строки ~241-244)
- `handleShowUserStats()` - alert заглушка
- `handleShowTopDish()` - alert заглушка
- `handleInviteFriend()` - console.log
- Типы: `ScenarioType`, `ScenarioConfig`, `HeroAction`

### `frontend/src/components/voting/ActivePollActions.tsx`

**Работает корректно**, содержит:
- Информацию о голосовании
- Кнопки действий (Повторить, Рулетка, Результаты)
- Feedback блок
- Invite кнопку

---

## Задача

**Спроектировать единый UX главной страницы** так, чтобы:

1. ✅ Структура была **одинаковой всегда** (с голосованием и без)
2. ✅ Не было дублирования кнопок
3. ✅ Секция "Быстрые действия" выглядела **консистентно**

### Вопросы для обсуждения:

1. **Какие кнопки должны быть в секции "Быстрые действия"?**
   - Варианты: Голосовать, Меню, Статистика, История, Повторить, Рулетка, Пригласить...
   
2. **Должны ли кнопки меняться визуально?**
   - Вариант A: Кнопки статичные (одни и те же), только поведение меняется
   - Вариант B: Кнопки адаптируются под состояние (разные для poll/no-poll)
   
3. **Сколько кнопок оптимально?**
   - 2 кнопки (1 ряд)
   - 3 кнопки (2+1 или 1+2 layout)
   - 4 кнопки (2x2 grid)
   
4. **Нужно ли разделять компоненты?**
   - ActivePollActions → только информация
   - QuickActionsSection → отдельный компонент с кнопками

---

## Дополнительная информация

**Документация:**
- `docs/SESSION_CHANGES_2025-01-08.md` - полное описание недавних изменений
- `docs/API.md` - документация API endpoints
- `docs/FRONTEND_CURRENT_STATE.md` - структура фронтенда

**Запущенные сервисы:**
- Backend: `http://localhost:3001` (dev server работает)
- Frontend: `http://localhost:5173` (dev server работает)

**Важные команды:**
```powershell
# Backend
cd E:\BOT_V2\Lunch_bot\telegram-food-bot\backend
npm run dev

# Frontend
cd E:\BOT_V2\Lunch_bot\telegram-food-bot\frontend
npm run dev
```

---

## Как мне помочь

1. **Обсудить** варианты UX для секции "Быстрые действия"
2. **Предложить** финальный дизайн HomePage с учетом всех требований
3. **Помочь реализовать** выбранное решение (изменить файлы, протестировать)

Готов ответить на любые дополнительные вопросы о проекте! 🚀

# 🚀 Multi-Winner Voting: Prompt для реализации

**Версия:** 1.0  
**Для:** Продолжения диалога в новом окне

---

## 📋 Тезисный контекст

### Что реализуем:
**Multi-Winner Voting** - новый режим завершения голосования, который группирует пользователей по выбранным блюдам вместо выбора одного "победителя".

### Проблема:
```
❌ Сейчас: "Борщ победил (5 голосов)" - непонятно кто что заказывает
✅ Нужно: "Борщ — 4 человека: Иван, Мария, Петр, Света"
```

### Документация:
- 📖 **Полный гайд:** `/docs/08-multi-winner/MULTI_WINNER_VOTING_IMPLEMENTATION.md` (1859 строк)
- 📡 **API Spec:** `/docs/08-multi-winner/MULTI_WINNER_API_SPEC.md`
- ❓ **FAQ:** `/docs/08-multi-winner/MULTI_WINNER_FAQ.md`
- 💻 **Примеры:** `/docs/08-multi-winner/examples/multi-winner-example.ts`

---

## 🎯 Ключевые решения

### ✅ Преимущества архитектуры:
- **Нет миграций БД** - использует существующее поле `PollResult.rouletteData` (JSON)
- **Обратная совместимость** - старые polls работают через `winnerMenuItemId`
- **Feature flag** - откат за 5 минут (`FEATURE_MULTI_WINNER=true/false`)
- **Идемпотентность** - повторный вызов вернет существующий результат
- **Транзакционность** - Prisma `$transaction`

### 📊 Структура данных:
```typescript
// Хранится в PollResult.rouletteData как JSON
{
  version: 1,
  mode: 'multi-winner',
  winners: [{
    menuItemId: number,
    menuItemName: string,        // Снэпшот
    voters: VoterSnapshot[],      // Снэпшоты имен
    voteCount: number,
    votedAt: string[]             // Для тай-брейка
  }],
  bringOwn: { voters: [...], count: number },
  skipped: { voters: [...], count: number },
  meta: {
    primaryWinnerId: number,      // Для совместимости
    tieBreak?: { method, appliedTo[], reason },
    completedAt: string,
    completedBy: number,
    params: { minVotes, maxWinners }
  }
}
```

---

## 🔨 План реализации (3-4 дня)

### 1️⃣ Backend (1-1.5 дня)
**Файлы для создания/изменения:**
```
backend/src/services/poll.service.ts          - метод completePollMultiWinner()
backend/src/api/controllers/poll.controller.ts - handler completePollMultiWinner()
backend/src/api/routes/poll.routes.ts          - route PATCH /:id/complete-multi
backend/src/config/features.ts                 - СОЗДАТЬ: feature flag config
backend/.env                                   - добавить FEATURE_MULTI_WINNER=true
```

**Ключевые моменты:**
- Группировка votes по `menuItemId`, `voteType === 'BRING_OWN'`, `voteType === 'SKIP'`
- Фильтрация по `minVotes` (default: 1)
- Ограничение `maxWinners` (default: null)
- Тай-брейк: `earliest` (по timestamp) или `alphabetical` (по имени)
- Снэпшоты: `menuItem.name`, `user.firstName` на момент завершения
- Транзакция: `UPDATE poll` + `CREATE pollResult`

### 2️⃣ Frontend (1 день)
**Файлы для создания/изменения:**
```
frontend/src/services/polls.service.ts                       - метод completePollMultiWinner()
frontend/src/components/voting/MultiWinnerResults.tsx        - СОЗДАТЬ: компонент результатов
frontend/src/pages/VotingPage.tsx                            - добавить toggle multi/single
frontend/src/pages/ResultsPage.tsx                           - рендер multi-winner
```

**Ключевые моменты:**
- TypeScript interfaces для `MultiWinnerResultData`
- Прогрессивное раскрытие: если > 5 voters - показывать "Еще N" + кнопка
- Glassmorphism стиль (bg-glass, border-white/10)
- Framer Motion анимации (stagger по 0.1s)
- Кнопка "Копировать" в буфер обмена

### 3️⃣ Telegram Integration (0.5 дня)
**Файлы для изменения:**
```
backend/src/bot/handlers/poll.handlers.ts - formatMultiWinnerResults()
                                          - обновить handleShowResults()
```

**Ключевые моменты:**
- HTML форматирование для Telegram
- Прогрессивное раскрытие: если > 5 человек - "и еще N"
- Truncation: если message > 3500 символов - обрезать + ссылка на WebApp
- Множественное число: `getPluralForm(count, 'человек', 'человека', 'человек')`

### 4️⃣ Testing (0.5 дня)
**Файлы для создания:**
```
backend/src/services/__tests__/poll.service.test.ts - unit tests
backend/tests/integration/multi-winner.test.ts      - integration tests
frontend/tests/e2e/multi-winner.spec.ts             - E2E tests
```

**Тест-кейсы:**
- Multiple winners с разным voteCount
- Tie-break earliest vs alphabetical
- minVotes фильтрация
- maxWinners ограничение
- Идемпотентность
- Feature flag disabled

---

## ⚠️ Важные ограничения

### 1. Детерминированный тай-брейк:
```typescript
❌ tieBreakMethod: 'random'  // Недетерминистично!
✅ tieBreakMethod: 'earliest' // Воспроизводимо
```

### 2. Telegram Message Length:
```typescript
if (message.length > 3500) {
  message = message.substring(0, 3500);
  message += `\n\n📊 <a href="${webAppUrl}">Полные результаты</a>`;
}
```

### 3. Прогрессивное раскрытие:
```tsx
// Не показывать 20 имен сразу - UI ломается
{winner.voters.slice(0, 5).map(v => <Chip>{v.firstName}</Chip>)}
{winner.voters.length > 5 && (
  <button>Еще {winner.voters.length - 5}</button>
)}
```

### 4. Обратная совместимость:
```typescript
// Сохранить primaryWinnerId в winnerMenuItemId
winnerMenuItemId: primaryWinnerId,
```

---

## 🚀 Команды для начала

```bash
# 1. Создать feature flag config
touch backend/src/config/features.ts

# 2. Добавить в .env
echo "FEATURE_MULTI_WINNER=true" >> backend/.env

# 3. Начать с backend
code backend/src/services/poll.service.ts

# 4. Запустить backend
cd backend && npm run dev

# 5. После backend - frontend
code frontend/src/components/voting/MultiWinnerResults.tsx
```

---

## 📝 Промпт для нового диалога

```
Нужно реализовать Multi-Winner Voting для Telegram Food Bot.

Контекст:
- Текущая система: single-winner (один победитель)
- Нужно: группировка пользователей по выбранным блюдам
- Документация: /docs/08-multi-winner/ (полный Implementation Guide на 1859 строк)

Архитектура:
- БД: Используем существующее поле PollResult.rouletteData (JSON) - миграций НЕТ
- Обратная совместимость: primaryWinnerId → winnerMenuItemId
- Feature flag: FEATURE_MULTI_WINNER=true/false для быстрого отката

План реализации:
1. Backend (1-1.5 дня):
   - poll.service.ts: метод completePollMultiWinner()
   - poll.controller.ts: handler + валидация
   - poll.routes.ts: PATCH /:id/complete-multi
   - features.ts: СОЗДАТЬ feature flag config

2. Frontend (1 день):
   - polls.service.ts: API метод
   - MultiWinnerResults.tsx: СОЗДАТЬ компонент с прогрессивным раскрытием
   - VotingPage.tsx: toggle multi/single
   - ResultsPage.tsx: рендер по типу результата

3. Telegram (0.5 дня):
   - poll.handlers.ts: formatMultiWinnerResults() с HTML + truncation

Ключевые детали:
- Снэпшоты имен (защита от изменений в БД)
- Детерминированный тай-брейк (earliest/alphabetical)
- Прогрессивное раскрытие (> 5 voters → кнопка "Еще N")
- Идемпотентность (повторный вызов = тот же результат)
- Транзакционность (Prisma $transaction)

Начни с:
1. Изучи полную документацию: /docs/08-multi-winner/MULTI_WINNER_VOTING_IMPLEMENTATION.md
2. Создай backend/src/config/features.ts
3. Реализуй completePollMultiWinner() в poll.service.ts (код есть в документации)
4. Создай endpoint PATCH /api/polls/:id/complete-multi

Важно:
- Копируй код из Implementation Guide - он production-ready
- Проверяй каждый шаг по Acceptance Criteria
- Тестируй идемпотентность и tie-break
```

---

## ✅ Acceptance Criteria

- [ ] Админ может завершить poll с multi-winner через API
- [ ] Пользователи группируются по menuItemId
- [ ] "Принесу своё" и "Пропускаю" в отдельных категориях
- [ ] Тай-брейк работает детерминированно
- [ ] Снэпшоты имен сохраняются
- [ ] Telegram сообщение форматируется корректно (< 4096 символов)
- [ ] Frontend рендерит группы с прогрессивным раскрытием
- [ ] Кнопка "Копировать" работает
- [ ] Идемпотентность: повторный вызов не создает дубликаты
- [ ] Feature flag позволяет откатить за 5 минут
- [ ] Unit + Integration + E2E тесты проходят

---

**📌 Timeline:** 3-4 дня (Backend 1.5д + Frontend 1д + Telegram 0.5д + Testing 0.5д)

**🎉 Готово к старту!**

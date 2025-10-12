# ❓ Multi-Winner Voting: FAQ & Troubleshooting

**Version:** 1.0  
**Last Updated:** 10 января 2025

---

## 📑 Table of Contents

1. [General Questions](#general-questions)
2. [Technical Questions](#technical-questions)
3. [Troubleshooting](#troubleshooting)
4. [Migration Guide](#migration-guide)
5. [Performance Tips](#performance-tips)
6. [Security Considerations](#security-considerations)

---

## 🤔 General Questions

### Q1: Зачем нужен Multi-Winner Voting?

**A:** Multi-Winner решает проблему текущей системы, где голосование показывает "победителя", но непонятно, кто конкретно что заказывает. С Multi-Winner вы видите четкое распределение:

```
🍜 Борщ — 4 человека
   👤 Иван, Мария, Петр, Света

🍛 Плов — 2 человека
   👤 Алексей, Дмитрий
```

Это **идеально для команд 5-20 человек** с разными предпочтениями.

---

### Q2: Чем Multi-Winner отличается от Single-Winner?

| Аспект | Single-Winner | Multi-Winner |
|--------|---------------|--------------|
| **Результат** | Одно блюдо-победитель | Группы пользователей по блюдам |
| **Use Case** | Команда ест одно общее блюдо | Каждый заказывает своё |
| **UX** | "Борщ победил (5 голосов)" | "Борщ — 4 человека: Иван, Мария..." |
| **Совместимость** | Старая система | Полностью совместим |

---

### Q3: Нужны ли миграции БД?

**A:** **НЕТ!** Multi-Winner использует существующее поле `rouletteData` (JSON) в таблице `poll_results`. Никаких изменений схемы не требуется.

---

### Q4: Можно ли откатить Multi-Winner?

**A:** **ДА!** Откат за 5 минут:
1. Установите `FEATURE_MULTI_WINNER=false` в `.env`
2. Перезапустите backend: `pm2 restart lunch-bot-backend`

Старые single-winner polls продолжат работать. Новые multi-winner results будут недоступны до включения feature flag.

---

### Q5: Что делать при равенстве голосов?

**A:** Multi-Winner применяет **детерминированный тай-брейк**:

- **`earliest`** (по умолчанию): Выбирается блюдо с самым ранним голосом
- **`alphabetical`**: Выбирается блюдо по алфавиту (русская локаль)

Метод указывается в параметре `tieBreakMethod` при завершении poll.

---

### Q6: Совместим ли Multi-Winner со старыми результатами?

**A:** **ДА!** Полная обратная совместимость:
- Старые single-winner results отображаются как раньше
- Frontend определяет тип результата по полю `mode` в JSON
- Backend сохраняет `primaryWinnerId` в `winnerMenuItemId` для старых систем

---

### Q7: Сколько пользователей поддерживается?

**A:** Multi-Winner **оптимизирован для 5-20 человек**.

- **> 5 человек в группе**: Применяется прогрессивное раскрытие ("Еще N")
- **> 10 групп**: Telegram сообщение обрезается с ссылкой на WebApp
- **> 50 участников**: Рекомендуется кеширование результатов

---

## 🔧 Technical Questions

### Q8: Как хранятся данные Multi-Winner?

**A:** В поле `PollResult.rouletteData` как JSON:

```typescript
{
  "version": 1,
  "mode": "multi-winner",
  "winners": [
    {
      "menuItemId": 1,
      "menuItemName": "Борщ",
      "voters": [{ "userId": 101, "firstName": "Иван" }, ...]
    }
  ],
  "bringOwn": { "count": 1, "voters": [...] },
  "meta": { "completedAt": "...", "primaryWinnerId": 1 }
}
```

---

### Q9: Почему снэпшоты имен?

**A:** **Защита от изменений в БД.**

Если пользователь изменит имя после завершения голосования, в истории результатов сохранится его **старое имя на момент голосования**. Это важно для аудита и консистентности.

---

### Q10: Как Frontend определяет тип результата?

**A:** Проверяет поля `mode` и `version` в `rouletteData`:

```typescript
try {
  const resultData = JSON.parse(pollResult.rouletteData || '{}');
  
  if (resultData.mode === 'multi-winner' && resultData.version === 1) {
    // Рендерим MultiWinnerResults
    return <MultiWinnerResults resultData={resultData} />;
  } else {
    // Рендерим SingleWinnerResults
    return <SingleWinnerResults pollResult={pollResult} />;
  }
} catch (e) {
  // Fallback на single-winner
  return <SingleWinnerResults pollResult={pollResult} />;
}
```

---

### Q11: Можно ли кастомизировать параметры завершения?

**A:** **ДА!** Доступны 3 параметра:

```typescript
{
  minVotes: 2,          // Блюда с < 2 голосами исключаются
  maxWinners: 5,        // Показываем только топ-5 блюд
  tieBreakMethod: 'alphabetical'  // Тай-брейк по алфавиту
}
```

---

### Q12: Что происходит с рулеткой?

**A:** Multi-Winner **не влияет на рулетку**.

1. Завершается poll с Multi-Winner → сохраняется `resultData`
2. Отдельно запускается рулетка → обновляется `responsibleUserId`
3. Оба результата живут вместе в `PollResult`

---

## 🛠️ Troubleshooting

### Problem 1: Poll не завершается (ALREADY_COMPLETED)

**Symptom:**
```json
{
  "success": false,
  "error": "Poll is already completed",
  "code": "ALREADY_COMPLETED"
}
```

**Cause:** Poll уже имеет status = 'COMPLETED'

**Solution:**
- ✅ **Это нормально!** Multi-Winner идемпотентен.
- Повторный вызов вернет существующий результат.
- Если нужно обновить результат - сначала верните poll в status = 'ACTIVE' через админ-панель.

---

### Problem 2: ResultData не парсится на Frontend

**Symptom:**
```
Error: Unexpected token in JSON at position 0
```

**Cause:** `rouletteData` пустой или содержит невалидный JSON

**Solution:**
```typescript
// Добавьте fallback
try {
  const resultData = JSON.parse(pollResult.rouletteData || '{}');
} catch (e) {
  logger.error('Failed to parse rouletteData', { error: e });
  // Fallback на single-winner UI
  return <SingleWinnerResults pollResult={pollResult} />;
}
```

---

### Problem 3: Telegram сообщение обрезано

**Symptom:** В Telegram показывается только часть результатов

**Cause:** Telegram ограничивает сообщения до 4096 символов

**Solution:**
Обновите `formatMultiWinnerResults`:

```typescript
if (message.length > 3500) {
  message = message.substring(0, 3500);
  message += `\n\n📊 <a href="${process.env.WEBAPP_URL}/poll/${pollId}/results">Смотреть полные результаты</a>`;
}
```

---

### Problem 4: Имена не отображаются в группах

**Symptom:** Вместо имен пустые чипы

**Cause:** `voters` массив пустой или `firstName` undefined

**Solution:**
Проверьте наличие `user` relation в `Vote`:

```typescript
const poll = await prisma.poll.findUnique({
  where: { id: pollId },
  include: {
    votes: {
      include: {
        user: true,  // ⚠️ Обязательно!
        menuItem: true,
      },
    },
  },
});
```

---

### Problem 5: Feature flag не работает

**Symptom:** Endpoint возвращает 503, даже когда `FEATURE_MULTI_WINNER=true`

**Cause:** `.env` не перечитан после изменений

**Solution:**
```bash
# 1. Проверьте .env
cat backend/.env | grep FEATURE_MULTI_WINNER

# 2. Перезапустите backend
pm2 restart lunch-bot-backend

# 3. Проверьте логи
pm2 logs lunch-bot-backend --lines 20
```

---

### Problem 6: Admin не может завершить poll

**Symptom:**
```json
{
  "success": false,
  "error": "Admin access required",
  "code": "FORBIDDEN"
}
```

**Cause:** Пользователь не является админом группы

**Solution:**
Проверьте флаг `isAdmin` в middleware:

```typescript
// backend/src/api/middleware/admin.middleware.ts
export function adminMiddleware(req: Request, res: Response, next: Function) {
  const user = (req as any).user;
  
  if (!user.isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'FORBIDDEN',
    });
  }
  
  next();
}
```

Убедитесь, что пользователь добавлен как админ в БД:
```sql
UPDATE users SET is_admin = TRUE WHERE id = 123;
```

---

### Problem 7: Tie-Break не работает корректно

**Symptom:** Primary winner выбран неправильно

**Cause:** Timestamps одинаковые или метод не применился

**Solution:**
Проверьте логи tie-break:

```bash
pm2 logs lunch-bot-backend | grep "Tie-break applied"
```

Убедитесь, что голоса имеют разные `createdAt`:
```sql
SELECT id, user_id, menu_item_id, created_at 
FROM votes 
WHERE poll_id = 123 
ORDER BY created_at;
```

---

## 🔄 Migration Guide

### Переход от Single-Winner к Multi-Winner

#### Step 1: Включите Feature Flag

```bash
# backend/.env
FEATURE_MULTI_WINNER=true
```

#### Step 2: Обновите Frontend

Добавьте поддержку multi-winner results в `ResultsPage.tsx`:

```tsx
const ResultsPage = () => {
  const { pollResult } = usePollResult(pollId);

  // Определяем тип результата
  const resultData = JSON.parse(pollResult.rouletteData || '{}');
  const isMultiWinner = resultData.mode === 'multi-winner';

  return isMultiWinner 
    ? <MultiWinnerResults resultData={resultData} />
    : <SingleWinnerResults pollResult={pollResult} />;
};
```

#### Step 3: Обновите Telegram Handler

```typescript
// backend/src/bot/handlers/poll.handlers.ts
export async function handleShowResults(ctx, pollId) {
  const result = await getPollResult(pollId);
  const resultData = JSON.parse(result.rouletteData || '{}');

  const message = resultData.mode === 'multi-winner'
    ? formatMultiWinnerResults(resultData)
    : formatSingleWinnerResults(result);

  await ctx.reply(message, { parse_mode: 'HTML' });
}
```

#### Step 4: Протестируйте

1. Создайте тестовый poll
2. Проголосуйте с несколькими пользователями
3. Завершите с флагом multi-winner
4. Проверьте результаты в Telegram и WebApp

---

### Откат на Single-Winner

```bash
# 1. Отключите feature flag
echo "FEATURE_MULTI_WINNER=false" > backend/.env

# 2. Перезапустите
pm2 restart lunch-bot-backend

# ✅ Multi-winner недоступен, single-winner работает
```

---

## ⚡ Performance Tips

### Tip 1: Кеширование результатов

Для polls с > 50 участников:

```typescript
// backend/src/services/poll.service.ts
import { cacheManager } from '../cache/manager';

static async completePollMultiWinner(pollId: number, ...) {
  // ... логика завершения

  // Кешируем результат на 1 час
  await cacheManager.set(
    `poll:${pollId}:multi-winner-result`,
    resultData,
    3600
  );

  return result;
}

// При GET /polls/:id/result - сначала проверяем кеш
static async getPollResult(pollId: number) {
  const cached = await cacheManager.get(`poll:${pollId}:multi-winner-result`);
  if (cached) return cached;

  // ... запрос к БД
}
```

---

### Tip 2: Lazy Loading для voters

При > 10 voters используйте виртуализацию:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const VoterList = ({ voters }: { voters: VoterSnapshot[] }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: voters.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
  });

  return (
    <div ref={parentRef} className="h-64 overflow-auto">
      {virtualizer.getVirtualItems().map(item => (
        <div key={item.key}>
          {voters[item.index].firstName}
        </div>
      ))}
    </div>
  );
};
```

---

### Tip 3: Pagination для Telegram

При > 10 групп:

```typescript
function formatMultiWinnerResults(resultData: MultiWinnerResultData, page = 1) {
  const ITEMS_PER_PAGE = 10;
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;

  const winners = resultData.winners.slice(start, end);
  
  // ... форматирование

  if (resultData.winners.length > end) {
    message += `\n\n📄 Страница ${page}/${Math.ceil(resultData.winners.length / ITEMS_PER_PAGE)}`;
  }

  return message;
}
```

---

## 🔒 Security Considerations

### 1. Валидация параметров

❌ **Bad:**
```typescript
const { minVotes } = req.body;
// Нет валидации - может быть отрицательным!
```

✅ **Good:**
```typescript
const { minVotes = 1 } = req.body;

if (typeof minVotes !== 'number' || minVotes < 0 || minVotes > 100) {
  return res.status(400).json({ error: 'Invalid minVotes' });
}
```

---

### 2. Sanitization имен

При отображении в HTML:

```typescript
import DOMPurify from 'dompurify';

const sanitizedName = DOMPurify.sanitize(voter.firstName);
```

---

### 3. Rate Limiting

Добавьте rate limiter:

```typescript
import rateLimit from 'express-rate-limit';

const completePollLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 10, // 10 запросов на пользователя
  message: 'Too many requests',
});

router.patch(
  '/:id/complete-multi',
  completePollLimiter,
  telegramAuthMiddleware,
  adminMiddleware,
  pollController.completePollMultiWinner
);
```

---

### 4. SQL Injection Protection

✅ **Prisma автоматически защищает от SQL injection**, но будьте внимательны с raw queries:

```typescript
// ❌ Bad
await prisma.$executeRaw(`UPDATE polls SET status = '${status}'`);

// ✅ Good
await prisma.$executeRaw`UPDATE polls SET status = ${status}`;
```

---

## 📞 Need More Help?

- 📖 [Implementation Guide](./MULTI_WINNER_VOTING_IMPLEMENTATION.md)
- 📡 [API Specification](./MULTI_WINNER_API_SPEC.md)
- 💻 [Code Examples](./examples/multi-winner-example.ts)
- 🧪 [Test Templates](./tests/multi-winner.test.ts)

**Не нашли ответ?** Создайте issue в репозитории с тегом `multi-winner`.

---

**🎉 Спасибо за использование Multi-Winner Voting!**

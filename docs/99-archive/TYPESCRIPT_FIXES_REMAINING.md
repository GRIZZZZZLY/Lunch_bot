# Оставшиеся TypeScript исправления

## Выполнено ✅
1. ✅ useToast API (showToast → success/error/info)
2. ✅ AnimatedNavIcon transition типы (as const)
3. ✅ haptic.impact() вызовы (убраны аргументы)
4. ✅ Telegram openLink добавлен в global types
5. ✅ ApiResponse типы в auth.service (response.data)
6. ✅ VirtualMenuList FixedSizeList тип (typeof)
7. ✅ PopularItem расширен (menuItemName, totalVotes, percentage, imageUrl)

## Осталось исправить 🔧

### 1. usePolls.ts - типы queryClient.setQueryData
**Файл:** `frontend/src/hooks/usePolls.ts`
**Строка:** 118, 201

```typescript
// Проблема: setQueryData ожидает правильные типы
// Решение: использовать as PollWithDetails для приведения типов

queryClient.setQueryData(['poll', pollId], (old: PollWithDetails) => ({
  ...old,
  votes: [...old.votes, newVote]
})) as PollWithDetails;
```

### 2. HomePage - PollWithDetails типы
**Файл:** `frontend/src/pages/HomePage.tsx`  
**Строки:** 166, 431

```typescript
// Проблема: передаются неполные объекты Poll вместо PollWithDetails
// Решение: либо преобразовать Poll в PollWithDetails, либо использовать partial

// Option 1: Добавить недостающие поля
const pollWithDetails: PollWithDetails = {
  ...poll,
  group: poll.group || { id: 0, title: '', telegramId: '' },
  votes: poll.votes || [],
  results: poll.results || []
};

// Option 2: Использовать Partial
const [activePoll, setActivePoll] = useState<Partial<PollWithDetails> | null>(null);
```

### 3. PollResultsPage - PollResult типы
**Файл:** `frontend/src/pages/PollResultsPage.tsx`  
**Строки:** 62, 74, 79

```typescript
// Проблема: PollResult не имеет полей result и breakdown
// Нужно проверить правильный интерфейс PollResult

// Возможное решение: использовать опциональные поля
poll.results?.result
poll.results?.breakdown
```

### 4. MockApiService - отсутствующие методы
**Файл:** `frontend/src/services/polls.service.ts`  
**Строки:** 599, 615, 631

```typescript
// Проблема: MockApiService не имеет методов createPoll, closePoll, vote
// Решение: добавить эти методы в mockApi.service.ts

// В mockApi.service.ts добавить:
async createPoll(data: any) { /* ... */ }
async closePoll(pollId: number) { /* ... */ }
async vote(pollId: number, menuItemId: number) { /* ... */ }
```

## Быстрое исправление всех проблем

```bash
# 1. Запустить type-check чтобы увидеть все ошибки
npm run type-check

# 2. Временно отключить строгую проверку (не рекомендуется для production)
# В tsconfig.json добавить:
{
  "compilerOptions": {
    "skipLibCheck": true,
    "noImplicitAny": false
  }
}

# 3. Или использовать @ts-ignore для проблемных строк (временно)
```

## Приоритет исправлений

1. **HIGH**: MockApiService методы (блокирует mock mode)
2. **HIGH**: PollResult типы (блокирует страницу результатов)
3. **MEDIUM**: usePolls типы (работает, но есть warning)
4. **LOW**: HomePage PollWithDetails (работает с частичными данными)

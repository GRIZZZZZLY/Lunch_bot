# 📡 Multi-Winner Voting: API Specification

**Version:** 1.0  
**Last Updated:** 10 января 2025  
**Format:** OpenAPI-style  

---

## 📑 Table of Contents

1. [Endpoint Overview](#endpoint-overview)
2. [Authentication](#authentication)
3. [Request Schema](#request-schema)
4. [Response Schema](#response-schema)
5. [Error Codes](#error-codes)
6. [Data Models](#data-models)
7. [Usage Examples](#usage-examples)
8. [Rate Limiting](#rate-limiting)
9. [Changelog](#changelog)

---

## 🔍 Endpoint Overview

### Complete Poll with Multi-Winner

Завершает голосование с множественными победителями, группируя пользователей по их выбору.

```
PATCH /api/polls/:id/complete-multi
```

**Method:** `PATCH`  
**Content-Type:** `application/json`  
**Authentication:** Required (Admin only)  
**Rate Limit:** 10 requests per minute per user

---

## 🔐 Authentication

### Required Headers

```http
Authorization: Bearer {telegram_init_data}
```

- **telegram_init_data**: Данные авторизации из Telegram WebApp
- Пользователь должен быть администратором группы (проверяется через middleware)

### Authentication Flow

1. Frontend получает `telegram_init_data` через Telegram WebApp API
2. Отправляет в заголовке `Authorization`
3. Backend валидирует через `telegramAuthMiddleware`
4. Проверяет `isAdmin` через `adminMiddleware`

---

## 📥 Request Schema

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | ID голосования (Poll ID) |

### Request Body

```typescript
interface CompletePollMultiWinnerRequest {
  minVotes?: number;              // Min 0, Max 100, Default 1
  maxWinners?: number | null;     // Min 1, Max 50, Default null (без ограничений)
  tieBreakMethod?: 'earliest' | 'alphabetical';  // Default 'earliest'
}
```

### Body Parameters

| Field | Type | Required | Default | Validation | Description |
|-------|------|----------|---------|------------|-------------|
| `minVotes` | number | No | 1 | 0 ≤ n ≤ 100 | Минимальное кол-во голосов для включения в winners |
| `maxWinners` | number \| null | No | null | 1 ≤ n ≤ 50 или null | Макс. кол-во winners (null = без ограничений) |
| `tieBreakMethod` | string | No | `'earliest'` | `'earliest'` \| `'alphabetical'` | Метод разрешения равенства голосов |

### Example Request

```http
PATCH /api/polls/123/complete-multi HTTP/1.1
Host: api.your-app.com
Authorization: Bearer query_id=AAH...&user=%7B%22id%22%3A...
Content-Type: application/json

{
  "minVotes": 1,
  "maxWinners": null,
  "tieBreakMethod": "earliest"
}
```

---

## 📤 Response Schema

### Success Response (200 OK)

```typescript
interface CompletePollMultiWinnerResponse {
  success: true;
  data: {
    pollResult: PollResult;          // Database entity
    resultData: MultiWinnerResultData;  // Parsed JSON from rouletteData
  };
}
```

### PollResult Entity

```typescript
interface PollResult {
  id: number;
  pollId: number;
  winnerMenuItemId: number | null;  // Primary winner ID (для совместимости)
  responsibleUserId: number;        // Ответственный (рулетка)
  totalVotes: number;
  rouletteData: string;             // JSON-сериализованный MultiWinnerResultData
  createdAt: string;                // ISO timestamp
}
```

### MultiWinnerResultData Structure

```typescript
interface MultiWinnerResultData {
  version: 1;
  mode: 'multi-winner';
  winners: Winner[];
  bringOwn: BringOwnGroup;
  skipped: SkippedGroup;
  meta: ResultMeta;
}

interface Winner {
  menuItemId: number;
  menuItemName: string;
  menuItemSnapshot: {
    price?: number;
    category?: string;
    imageUrl?: string;
  };
  voterIds: number[];
  voters: VoterSnapshot[];
  voteCount: number;
  votedAt: string[];               // ISO timestamps
}

interface VoterSnapshot {
  userId: number;
  firstName: string;
  lastName?: string;
  username?: string;
}

interface BringOwnGroup {
  voterIds: number[];
  voters: VoterSnapshot[];
  count: number;
}

interface SkippedGroup {
  voterIds: number[];
  voters: VoterSnapshot[];
  count: number;
}

interface ResultMeta {
  primaryWinnerId: number | null;
  tieBreak?: TieBreak;
  completedAt: string;              // ISO timestamp
  completedBy: number;              // User ID админа
  params: {
    minVotes: number;
    maxWinners: number | null;
  };
}

interface TieBreak {
  method: 'earliest' | 'alphabetical';
  appliedTo: number[];              // IDs блюд с равным voteCount
  reason: string;
}
```

### Example Success Response

```json
{
  "success": true,
  "data": {
    "pollResult": {
      "id": 456,
      "pollId": 123,
      "winnerMenuItemId": 1,
      "responsibleUserId": 10,
      "totalVotes": 7,
      "rouletteData": "{\"version\":1,\"mode\":\"multi-winner\",...}",
      "createdAt": "2025-01-10T12:00:00.000Z"
    },
    "resultData": {
      "version": 1,
      "mode": "multi-winner",
      "winners": [
        {
          "menuItemId": 1,
          "menuItemName": "Борщ",
          "menuItemSnapshot": {
            "price": 250,
            "category": "первые блюда",
            "imageUrl": "https://..."
          },
          "voterIds": [101, 102, 103, 104],
          "voters": [
            { "userId": 101, "firstName": "Иван", "lastName": "Иванов" },
            { "userId": 102, "firstName": "Мария" },
            { "userId": 103, "firstName": "Петр" },
            { "userId": 104, "firstName": "Света" }
          ],
          "voteCount": 4,
          "votedAt": [
            "2025-01-10T11:05:23.000Z",
            "2025-01-10T11:06:12.000Z",
            "2025-01-10T11:07:45.000Z",
            "2025-01-10T11:08:01.000Z"
          ]
        },
        {
          "menuItemId": 2,
          "menuItemName": "Плов",
          "menuItemSnapshot": { "price": 300 },
          "voterIds": [105, 106],
          "voters": [
            { "userId": 105, "firstName": "Алексей" },
            { "userId": 106, "firstName": "Дмитрий" }
          ],
          "voteCount": 2,
          "votedAt": [
            "2025-01-10T11:09:00.000Z",
            "2025-01-10T11:09:30.000Z"
          ]
        }
      ],
      "bringOwn": {
        "voterIds": [107],
        "voters": [{ "userId": 107, "firstName": "Анна" }],
        "count": 1
      },
      "skipped": {
        "voterIds": [],
        "voters": [],
        "count": 0
      },
      "meta": {
        "primaryWinnerId": 1,
        "tieBreak": null,
        "completedAt": "2025-01-10T12:00:00.000Z",
        "completedBy": 10,
        "params": {
          "minVotes": 1,
          "maxWinners": null
        }
      }
    }
  }
}
```

---

## ❌ Error Codes

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
}
```

### Error Codes Table

| Code | HTTP Status | Description | Solution |
|------|-------------|-------------|----------|
| `INVALID_ID` | 400 | Poll ID невалиден (не число) | Проверьте формат ID |
| `INVALID_PARAMS` | 400 | Параметры запроса невалидны | Проверьте minVotes, maxWinners, tieBreakMethod |
| `NOT_FOUND` | 404 | Голосование не найдено | Проверьте существование poll |
| `NOT_ACTIVE` | 400 | Голосование не активно | Poll должен иметь status === 'ACTIVE' |
| `ALREADY_COMPLETED` | 400 | Голосование уже завершено | Операция идемпотентна, повторный вызов вернет тот же результат |
| `FORBIDDEN` | 403 | Доступ запрещен (не админ) | Пользователь должен быть админом группы |
| `UNAUTHORIZED` | 401 | Не авторизован | Требуется валидный telegram_init_data |
| `FEATURE_DISABLED` | 503 | Feature flag отключен | Multi-Winner временно недоступен |
| `INTERNAL_ERROR` | 500 | Внутренняя ошибка сервера | Обратитесь к администратору |

### Example Error Responses

**400 Bad Request - Invalid Parameters:**
```json
{
  "success": false,
  "error": "minVotes must be a number between 0 and 100",
  "code": "INVALID_PARAMS"
}
```

**403 Forbidden - Not Admin:**
```json
{
  "success": false,
  "error": "Admin access required",
  "code": "FORBIDDEN"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Poll not found",
  "code": "NOT_FOUND"
}
```

**503 Service Unavailable - Feature Disabled:**
```json
{
  "success": false,
  "error": "Multi-Winner Voting is currently disabled",
  "code": "FEATURE_DISABLED"
}
```

---

## 📊 Data Models

### Relationship Diagram

```
Poll
 ├─ votes[]
 │   ├─ Vote (voteType: MENU_ITEM)
 │   │   ├─ user (User)
 │   │   └─ menuItem (MenuItem)
 │   ├─ Vote (voteType: BRING_OWN)
 │   │   └─ user (User)
 │   └─ Vote (voteType: SKIP)
 │       └─ user (User)
 └─ result (PollResult)
     └─ rouletteData (MultiWinnerResultData JSON)
```

### Key Concepts

**1. Winners Sorting:**
- Сортируются по убыванию `voteCount`
- При равенстве применяется `tieBreakMethod`

**2. Primary Winner:**
- Первый в списке winners
- Сохраняется в `winnerMenuItemId` для обратной совместимости

**3. Snapshots:**
- Имена пользователей и блюд снимаются на момент завершения
- Защита от изменений в БД после завершения

**4. Idempotency:**
- Повторный вызов с тем же `pollId` возвращает существующий result
- Не создает дубликаты

---

## 💻 Usage Examples

### JavaScript / TypeScript (Axios)

```typescript
import axios from 'axios';

async function completePollMultiWinner(
  pollId: number,
  telegramInitData: string
): Promise<MultiWinnerResultData> {
  const response = await axios.patch(
    `https://api.your-app.com/api/polls/${pollId}/complete-multi`,
    {
      minVotes: 1,
      maxWinners: null,
      tieBreakMethod: 'earliest',
    },
    {
      headers: {
        'Authorization': `Bearer ${telegramInitData}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.data.success) {
    throw new Error(response.data.error);
  }

  return response.data.data.resultData;
}

// Usage
const resultData = await completePollMultiWinner(123, telegram.initData);
console.log(`Winners: ${resultData.winners.length}`);
console.log(`Bring Own: ${resultData.bringOwn.count}`);
```

### cURL

```bash
curl -X PATCH "https://api.your-app.com/api/polls/123/complete-multi" \
  -H "Authorization: Bearer query_id=AAH..." \
  -H "Content-Type: application/json" \
  -d '{
    "minVotes": 1,
    "maxWinners": null,
    "tieBreakMethod": "earliest"
  }'
```

### Python (requests)

```python
import requests

def complete_poll_multi_winner(poll_id: int, telegram_init_data: str):
    response = requests.patch(
        f"https://api.your-app.com/api/polls/{poll_id}/complete-multi",
        headers={
            "Authorization": f"Bearer {telegram_init_data}",
            "Content-Type": "application/json",
        },
        json={
            "minVotes": 1,
            "maxWinners": None,
            "tieBreakMethod": "earliest",
        },
    )

    response.raise_for_status()
    data = response.json()

    if not data["success"]:
        raise Exception(data["error"])

    return data["data"]["resultData"]

# Usage
result_data = complete_poll_multi_winner(123, telegram_init_data)
print(f"Winners: {len(result_data['winners'])}")
```

### React Hook

```tsx
import { useMutation } from '@tanstack/react-query';
import { pollsService } from '@/services/polls.service';

function useCompletePollMultiWinner() {
  return useMutation({
    mutationFn: async ({ 
      pollId, 
      options 
    }: { 
      pollId: number; 
      options?: CompletePollMultiWinnerRequest;
    }) => {
      const response = await pollsService.completePollMultiWinner(pollId, options);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Poll completed:', data.resultData);
    },
    onError: (error) => {
      console.error('Failed to complete poll:', error);
    },
  });
}

// Component usage
function AdminControls({ pollId }: { pollId: number }) {
  const { mutate, isPending } = useCompletePollMultiWinner();

  const handleComplete = () => {
    mutate({
      pollId,
      options: {
        minVotes: 1,
        maxWinners: null,
        tieBreakMethod: 'earliest',
      },
    });
  };

  return (
    <button onClick={handleComplete} disabled={isPending}>
      {isPending ? 'Завершение...' : 'Завершить голосование'}
    </button>
  );
}
```

---

## ⏱️ Rate Limiting

### Limits

- **Per User:** 10 requests per minute
- **Per IP:** 100 requests per minute
- **Global:** 1000 requests per minute

### Rate Limit Headers

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1704883200
```

### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60

{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

---

## 📝 Changelog

### Version 1.0 (10 января 2025)

**Initial Release:**
- ✅ `PATCH /api/polls/:id/complete-multi` endpoint
- ✅ MultiWinnerResultData JSON schema
- ✅ Tie-break support (earliest, alphabetical)
- ✅ Progressive disclosure для > 5 voters
- ✅ Idempotency check
- ✅ Feature flag support
- ✅ Admin-only access
- ✅ Full backward compatibility

**Breaking Changes:**
- None (полностью обратно совместимо со single-winner)

**Deprecations:**
- None

---

## 🔗 Related Documentation

- [Implementation Guide](./MULTI_WINNER_VOTING_IMPLEMENTATION.md)
- [FAQ & Troubleshooting](./MULTI_WINNER_FAQ.md)
- [Code Examples](./examples/multi-winner-example.ts)
- [Test Templates](./tests/multi-winner.test.ts)

---

**Questions? См. [FAQ](./MULTI_WINNER_FAQ.md) или создайте issue в репозитории.**

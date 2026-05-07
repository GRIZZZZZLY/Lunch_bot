# 🔌 REST API Documentation

## 📋 Обзор

Backend предоставляет REST API для Mini App. Все endpoints доступны по адресу `/api/*`.

**Base URL (dev)**: `http://localhost:3001/api`  
**Base URL (production)**: `https://your-domain.com/api`

## 🔐 Аутентификация

Все запросы от Mini App должны включать Telegram `initData` для валидации.

### Заголовки

```http
Content-Type: application/json
Authorization: tma <telegram_init_data_string>
```

После `POST /api/auth/validate` сервер возвращает JWT — последующие запросы используют:

```http
Authorization: Bearer <jwt_access_token>
```

### Валидация

Backend проверяет подпись `initData` через HMAC-SHA256 с Bot Token (`@telegram-apps/init-data-node`).

---

## 📡 Endpoints

### Authentication

#### POST `/api/auth/validate`

Валидация Telegram initData.

**Request:**
```json
{
  "initData": "query_id=..."
}
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": 123456789,
    "telegramId": 123456789,
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "isAdmin": false
  }
}
```

---

### Menu Management

#### GET `/api/menu`

Получить все блюда меню.

**Query Parameters:**
- `active` (optional): `true` | `false` - фильтр по активности
- `category` (optional): `string` - фильтр по категории

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "name": "Пицца Маргарита",
      "description": "Классическая итальянская пицца",
      "price": 450,
      "category": "Пицца",
      "imageUrl": "https://example.com/pizza.jpg",
      "isActive": true,
      "createdAt": "2025-10-01T10:00:00Z",
      "updatedAt": "2025-10-01T10:00:00Z"
    }
  ]
}
```

#### GET `/api/menu/:id`

Получить конкретное блюдо.

**Response:**
```json
{
  "id": 1,
  "name": "Пицца Маргарита",
  "description": "Классическая итальянская пицца",
  "price": 450,
  "category": "Пицца",
  "imageUrl": "https://example.com/pizza.jpg",
  "isActive": true
}
```

#### POST `/api/menu`

Создать новое блюдо (только для админов).

**Request:**
```json
{
  "name": "Пицца Маргарита",
  "description": "Классическая итальянская пицца",
  "price": 450,
  "category": "Пицца",
  "imageUrl": "https://example.com/pizza.jpg",
  "isActive": true
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Пицца Маргарита",
  ...
}
```

#### PUT `/api/menu/:id`

Обновить блюдо (только для админов).

**Request:** То же что и POST

**Response:** Обновленное блюдо

#### DELETE `/api/menu/:id`

Удалить блюдо (только для админов).

**Response:**
```json
{
  "message": "Menu item deleted successfully"
}
```

#### PATCH `/api/menu/:id/toggle`

Переключить активность блюда (только для админов).

**Response:**
```json
{
  "id": 1,
  "isActive": false
}
```

---

### Polls

#### GET `/api/polls/active`

Получить активное голосование для группы.

**Query Parameters:**
- `groupId` (required): `number` - ID группы

**Response:**
```json
{
  "poll": {
    "id": 1,
    "groupId": 1,
    "status": "ACTIVE",
    "duration": 30,
    "startedAt": "2025-10-06T10:00:00Z",
    "endedAt": null,
    "votes": [
      {
        "id": 1,
        "userId": 123456789,
        "menuItemId": 5,
        "user": {
          "firstName": "John",
          "username": "johndoe"
        },
        "menuItem": {
          "name": "Пицца Маргарита"
        }
      }
    ]
  }
}
```

#### GET `/api/polls/:id`

Получить конкретное голосование.

**Response:** То же что и активное голосование

#### GET `/api/polls/history`

История голосований для группы.

**Query Parameters:**
- `groupId` (required): `number`
- `limit` (optional): `number` (default: 10)
- `offset` (optional): `number` (default: 0)

**Response:**
```json
{
  "polls": [
    {
      "id": 1,
      "status": "COMPLETED",
      "startedAt": "2025-10-05T10:00:00Z",
      "endedAt": "2025-10-05T10:30:00Z",
      "result": {
        "winnerMenuItem": {
          "name": "Пицца Маргарита"
        },
        "responsibleUser": {
          "firstName": "John",
          "username": "johndoe"
        },
        "totalVotes": 5
      }
    }
  ],
  "total": 50
}
```

#### GET `/api/polls/:id/results`

Результаты голосования.

**Response:**
```json
{
  "result": {
    "id": 1,
    "pollId": 1,
    "winnerMenuItemId": 5,
    "responsibleUserId": 123456789,
    "totalVotes": 5,
    "winnerMenuItem": {
      "name": "Пицца Маргарита"
    },
    "responsibleUser": {
      "firstName": "John",
      "username": "johndoe"
    }
  }
}
```

---

### User Profile

#### GET `/api/user/profile`

Получить профиль текущего пользователя.

**Response:**
```json
{
  "user": {
    "id": 1,
    "telegramId": 123456789,
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "isAdmin": false,
    "paymentCard": "1234 5678 9012 3456",
    "paymentPhone": "+79001234567",
    "paymentDetails": "Дополнительная информация"
  }
}
```

#### PUT `/api/user/profile`

Обновить профиль пользователя.

**Request:**
```json
{
  "paymentCard": "1234 5678 9012 3456",
  "paymentPhone": "+79001234567",
  "paymentDetails": "Дополнительная информация"
}
```

**Response:** Обновленный профиль

---

## ⚠️ Коды ошибок

### HTTP Status Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request (невалидные данные)
- `401` - Unauthorized (невалидный initData)
- `403` - Forbidden (недостаточно прав)
- `404` - Not Found
- `500` - Internal Server Error

### Error Response

```json
{
  "error": "Error message",
  "details": "Detailed error description"
}
```

---

## 📝 Примечания

- Все даты в формате ISO 8601 (UTC)
- Все ID - целые числа (integer)
- telegramId - BigInt (до 64 бит)
- Пагинация поддерживается через `limit` и `offset`

---

## 🚧 TODO

- [ ] Документировать endpoints для создания голосований
- [ ] Документировать WebSocket endpoints (если будут)
- [ ] Добавить примеры cURL запросов
- [ ] Добавить Postman коллекцию
- [ ] Swagger/OpenAPI спецификация

---

**Обновлено**: 06.10.2025

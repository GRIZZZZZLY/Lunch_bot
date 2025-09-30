# API Documentation

REST API документация для Telegram Food Bot Mini App.

## Базовая информация

- **Base URL**: `https://yourdomain.com/api`
- **Content-Type**: `application/json`
- **Authentication**: Telegram WebApp initData validation

## Аутентификация

Все API запросы должны содержать валидные данные Telegram WebApp в заголовке:

```javascript
headers: {
  'Authorization': 'tma ${initData}',
  'Content-Type': 'application/json'
}
```

где `initData` - строка данных от Telegram WebApp.

## Endpoints

### Authentication

#### `POST /auth/validate`
Валидация данных пользователя от Telegram WebApp.

**Request:**
```json
{
  "initData": "user=%7B%22id%22%3A123456789..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "telegramId": 123456789,
      "firstName": "John",
      "lastName": "Doe",
      "username": "johndoe",
      "isAdmin": false
    },
    "valid": true
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

### Menu Management

#### `GET /menu`
Получить список всех блюд в меню.

**Query Parameters:**
- `active` (boolean, optional) - фильтр по активным блюдам
- `category` (string, optional) - фильтр по категории
- `search` (string, optional) - поиск по названию

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "Пицца Маргарита",
        "description": "Классическая пицца с томатами и моцареллой",
        "price": 450.00,
        "category": "pizza",
        "isActive": true,
        "createdBy": 1,
        "createdAt": "2024-01-01T10:00:00Z",
        "updatedAt": "2024-01-01T10:00:00Z"
      }
    ],
    "total": 1,
    "categories": ["pizza", "pasta", "salad"]
  }
}
```

#### `POST /menu`
Создать новое блюдо в меню.

**Request:**
```json
{
  "name": "Пицца Пепперони",
  "description": "Пицца с пепперони и моцареллой", 
  "price": 520.00,
  "category": "pizza",
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Пицца Пепперони",
    "description": "Пицца с пепперони и моцареллой",
    "price": 520.00,
    "category": "pizza", 
    "isActive": true,
    "createdBy": 1,
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z"
  },
  "message": "Блюдо успешно создано"
}
```

#### `PUT /menu/:id`
Обновить существующее блюдо.

**Parameters:**
- `id` (integer) - ID блюда

**Request:**
```json
{
  "name": "Пицца Пепперони Большая",
  "description": "Большая пицца с пепперони и моцареллой",
  "price": 650.00,
  "category": "pizza",
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Пицца Пепперони Большая",
    "description": "Большая пицца с пепперони и моцареллой",
    "price": 650.00,
    "category": "pizza",
    "isActive": true,
    "createdBy": 1,
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:30:00Z"
  },
  "message": "Блюдо успешно обновлено"
}
```

#### `DELETE /menu/:id`
Удалить блюдо из меню.

**Parameters:**
- `id` (integer) - ID блюда

**Response:**
```json
{
  "success": true,
  "message": "Блюдо успешно удалено"
}
```

#### `PATCH /menu/:id/toggle`
Переключить активность блюда.

**Parameters:**
- `id` (integer) - ID блюда

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "isActive": false
  },
  "message": "Статус блюда изменен"
}
```

---

### Polls & Voting

#### `GET /polls/active`
Получить активное голосование.

**Response:**
```json
{
  "success": true,
  "data": {
    "poll": {
      "id": 1,
      "groupId": -123456789,
      "status": "ACTIVE",
      "duration": 30,
      "startedAt": "2024-01-01T12:00:00Z",
      "endedAt": null,
      "createdBy": 1,
      "items": [
        {
          "id": 1,
          "name": "Пицца Маргарита",
          "votes": 3
        },
        {
          "id": 2, 
          "name": "Пицца Пепперони",
          "votes": 5
        }
      ],
      "totalVotes": 8,
      "myVote": {
        "menuItemId": 2
      }
    }
  }
}
```

#### `GET /polls/:id/results`
Получить результаты голосования.

**Parameters:**
- `id` (integer) - ID голосования

**Response:**
```json
{
  "success": true,
  "data": {
    "poll": {
      "id": 1,
      "status": "COMPLETED",
      "endedAt": "2024-01-01T12:30:00Z"
    },
    "results": {
      "winner": {
        "id": 2,
        "name": "Пицца Пепперони",
        "votes": 8
      },
      "responsible": {
        "id": 123456789,
        "firstName": "John",
        "username": "johndoe"
      },
      "allVotes": [
        {
          "menuItem": {
            "id": 1,
            "name": "Пицца Маргарита"
          },
          "votes": 3
        },
        {
          "menuItem": {
            "id": 2,
            "name": "Пицца Пепперони"  
          },
          "votes": 8
        }
      ]
    }
  }
}
```

#### `GET /polls/history`
Получить историю голосований.

**Query Parameters:**
- `page` (integer, optional, default: 1) - номер страницы
- `limit` (integer, optional, default: 10) - количество записей на странице

**Response:**
```json
{
  "success": true,
  "data": {
    "polls": [
      {
        "id": 1,
        "status": "COMPLETED",
        "startedAt": "2024-01-01T12:00:00Z",
        "endedAt": "2024-01-01T12:30:00Z",
        "winner": {
          "name": "Пицца Пепперони"
        },
        "totalVotes": 8
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

---

### Statistics

#### `GET /stats/popular`
Получить статистику популярных блюд.

**Query Parameters:**
- `period` (string, optional) - период статистики: 'week', 'month', 'all' (default: 'month')
- `limit` (integer, optional, default: 10) - количество блюд

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "items": [
      {
        "menuItem": {
          "id": 2,
          "name": "Пицца Пепперони"
        },
        "winCount": 5,
        "voteCount": 23,
        "winRate": 0.833
      },
      {
        "menuItem": {
          "id": 1,
          "name": "Пицца Маргарита"
        },
        "winCount": 1,
        "voteCount": 15,
        "winRate": 0.167
      }
    ]
  }
}
```

#### `GET /stats/users`
Получить статистику пользователей.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 25,
    "activeUsers": 18,
    "topVoters": [
      {
        "user": {
          "firstName": "John",
          "username": "johndoe"
        },
        "voteCount": 42
      }
    ],
    "responsibleStats": [
      {
        "user": {
          "firstName": "Jane", 
          "username": "janedoe"
        },
        "responsibleCount": 8
      }
    ]
  }
}
```

---

## Error Responses

### Стандартные HTTP коды ошибок:

- `400 Bad Request` - Некорректные данные запроса
- `401 Unauthorized` - Недействительная аутентификация
- `403 Forbidden` - Недостаточно прав доступа
- `404 Not Found` - Ресурс не найден
- `422 Unprocessable Entity` - Ошибка валидации
- `500 Internal Server Error` - Внутренняя ошибка сервера

### Формат ошибки:
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "field": "name",
    "message": "Name is required"
  },
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Rate Limiting

- **Лимит**: 100 запросов в минуту на IP
- **Headers в ответе**:
  - `X-RateLimit-Limit` - лимит запросов
  - `X-RateLimit-Remaining` - оставшиеся запросы
  - `X-RateLimit-Reset` - время сброса счетчика

При превышении лимита возвращается статус `429 Too Many Requests`.

## WebSocket Events (опционально)

Для real-time обновлений голосований:

### Connection
```javascript
const ws = new WebSocket('wss://yourdomain.com/ws');
ws.send(JSON.stringify({
  type: 'auth',
  initData: 'user=%7B%22id%22%3A123456789...'
}));
```

### Events
- `poll:started` - начало нового голосования
- `poll:vote` - новый голос
- `poll:ended` - окончание голосования
- `poll:results` - результаты рулетки

## SDKs и Examples

### JavaScript/TypeScript Client
```javascript
class FoodBotAPI {
  constructor(initData) {
    this.initData = initData;
    this.baseURL = 'https://yourdomain.com/api';
  }
  
  async request(method, endpoint, data = null) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `tma ${this.initData}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : null
    });
    
    return await response.json();
  }
  
  // Menu methods
  async getMenu(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request('GET', `/menu?${params}`);
  }
  
  async createMenuItem(item) {
    return this.request('POST', '/menu', item);
  }
  
  // Polls methods
  async getActivePoll() {
    return this.request('GET', '/polls/active');
  }
}

// Usage
const api = new FoodBotAPI(window.Telegram.WebApp.initData);
const menu = await api.getMenu({ active: true });
```

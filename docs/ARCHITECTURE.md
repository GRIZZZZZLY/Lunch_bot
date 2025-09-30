# Архитектура проекта

Telegram Food Bot построен по модульной архитектуре с разделением на backend и frontend части.

## Общая архитектура

```
┌─────────────────────┐    ┌─────────────────────┐
│   Telegram Users    │◄──►│   Telegram Bot      │
└─────────────────────┘    └─────────────────────┘
                                       │
                                       ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│     Mini App        │◄──►│   Backend Server    │◄──►│    PostgreSQL       │
│   (React + TWA)     │    │  (Express + Grammy) │    │     Database        │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## Backend архитектура

### Структура модулей

```
backend/src/
├── bot/              # Telegram Bot логика
│   ├── commands/     # Обработчики команд (/start, /help, etc.)
│   ├── handlers/     # Обработчики событий (callback, polls)
│   ├── keyboards/    # Inline и Reply клавиатуры
│   └── middleware/   # Bot middleware (auth, logging)
├── api/              # REST API для Mini App
│   ├── routes/       # API endpoints
│   ├── controllers/  # Контроллеры
│   └── middleware/   # API middleware
├── services/         # Бизнес-логика
├── database/         # База данных (Prisma)
└── utils/            # Утилиты и helpers
```

### Компоненты

#### 1. Telegram Bot (Grammy)
- **Роль**: Обработка команд, callback queries, управление голосованиями
- **Технологии**: Grammy, TypeScript
- **Основные функции**:
  - Регистрация пользователей
  - Запуск голосований
  - Обработка голосов
  - Рулетка для выбора ответственного

#### 2. REST API (Express)
- **Роль**: API для Mini App
- **Технологии**: Express, TypeScript
- **Endpoints**:
  - `/api/auth` - Валидация Telegram initData
  - `/api/menu` - CRUD операции с меню
  - `/api/polls` - Управление голосованиями
  - `/api/stats` - Статистика

#### 3. Database Layer (Prisma)
- **Роль**: ORM для работы с PostgreSQL
- **Модели**:
  - `User` - Пользователи Telegram
  - `Group` - Telegram группы
  - `MenuItem` - Блюда в меню
  - `Poll` - Голосования
  - `Vote` - Голоса пользователей
  - `PollResult` - Результаты голосований

#### 4. Services Layer
- **Роль**: Бизнес-логика приложения
- **Сервисы**:
  - `UserService` - Управление пользователями
  - `MenuService` - Управление меню
  - `PollService` - Логика голосований
  - `RouletteService` - Логика рулетки
  - `NotificationService` - Уведомления

### Поток данных

1. **Команда бота** → Handler → Service → Database
2. **Mini App запрос** → API Route → Controller → Service → Database
3. **Webhook** → Bot Handler → Service → Database → Response

## Frontend архитектура

### Структура компонентов

```
frontend/src/
├── components/       # React компоненты
│   ├── common/      # Переиспользуемые компоненты
│   ├── menu/        # Компоненты управления меню
│   ├── layout/      # Layout компоненты
│   └── stats/       # Статистика
├── pages/           # Страницы приложения
├── hooks/           # Custom React hooks
├── services/        # API клиенты
├── store/           # State management
└── utils/           # Утилиты
```

### Технологии

- **React 18** - UI библиотека
- **TypeScript** - Типизация
- **Tailwind CSS** - Стилизация
- **Telegram WebApp SDK** - Интеграция с Telegram
- **Vite** - Build tool и dev server

### State Management

Используется комбинация:
- **React Context** - для глобального состояния (auth, theme)
- **useState/useReducer** - для локального состояния
- **Custom hooks** - для переиспользуемой логики

## Безопасность

### Telegram WebApp Security

1. **initData валидация** - проверка подлинности данных от Telegram
2. **Hash проверка** - криптографическая проверка целостности
3. **Timeout проверка** - данные действительны ограниченное время

### API Security

1. **CORS настройки** - ограничение доступа по доменам
2. **Rate limiting** - ограничение количества запросов
3. **Input validation** - валидация всех входящих данных
4. **SQL injection защита** - использование Prisma ORM

### Bot Security

1. **Admin проверка** - ограничение административных команд
2. **Group validation** - проверка принадлежности к группе
3. **Rate limiting** - защита от спама

## База данных

### Schema Design

```sql
User {
  id          Int
  telegramId  BigInt     # Telegram User ID
  username    String?    # Telegram username
  firstName   String     # Telegram first name
  lastName    String?    # Telegram last name
  isAdmin     Boolean    # Права администратора
  createdAt   DateTime
  updatedAt   DateTime
}

Group {
  id          Int
  telegramId  BigInt     # Telegram Chat ID
  title       String     # Название группы
  isActive    Boolean    # Активная группа
  createdAt   DateTime
}

MenuItem {
  id          Int
  name        String     # Название блюда
  description String?    # Описание
  price       Decimal?   # Цена (опционально)
  category    String?    # Категория блюда
  isActive    Boolean    # Доступно для голосования
  createdBy   Int        # User ID создателя
  createdAt   DateTime
  updatedAt   DateTime
}

Poll {
  id          Int
  groupId     Int        # Связь с группой
  status      PollStatus # ACTIVE, COMPLETED, CANCELLED
  duration    Int        # Длительность в минутах
  startedAt   DateTime
  endedAt     DateTime?
  createdBy   Int        # User ID инициатора
}

Vote {
  id          Int
  pollId      Int
  userId      Int
  menuItemId  Int
  createdAt   DateTime
  updatedAt   DateTime
}

PollResult {
  id          Int
  pollId      Int
  winnerId    Int        # Выбранное блюдо
  responsibleUserId Int  # Ответственный за заказ
  createdAt   DateTime
}
```

### Индексы и оптимизация

- Индексы по `telegramId` для быстрого поиска
- Составные индексы для связей `(pollId, userId)`
- Партиционирование по времени для больших таблиц

## Развертывание

### Development
- Hot reload для backend и frontend
- Docker Compose для локальной разработки
- Автоматическое применение миграций

### Production
- Multi-stage Docker builds
- Nginx reverse proxy
- PostgreSQL с репликацией
- SSL/TLS шифрование
- Health checks и мониторинг

## Масштабирование

### Горизонтальное масштабирование
- Stateless backend сервисы
- Load balancer (Nginx)
- Database read replicas
- Redis для сессий (опционально)

### Вертикальное масштабирование
- Оптимизация SQL запросов
- Connection pooling
- Кэширование часто используемых данных

## Мониторинг и логирование

### Логирование
- Структурированное логирование (Winston)
- Разные уровни логов (error, warn, info, debug)
- Логирование в файлы и stdout

### Мониторинг
- Health check endpoints
- Метрики производительности
- Уведомления об ошибках

## API Design

### REST Conventions
- GET `/api/menu` - получить список блюд
- POST `/api/menu` - создать новое блюдо
- PUT `/api/menu/:id` - обновить блюдо
- DELETE `/api/menu/:id` - удалить блюдо

### Response Format
```json
{
  "success": true,
  "data": {...},
  "message": "Success message",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Error Handling
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Testing Strategy

### Unit Tests
- Services тестирование
- Utility functions
- React компоненты

### Integration Tests
- API endpoints
- Database операции
- Bot handlers

### E2E Tests
- Пользовательские сценарии
- Mini App workflow
- Bot commands flow

## Конфигурация

### Environment Variables
- Разделение по окружениям (dev, staging, prod)
- Валидация обязательных переменных
- Безопасное хранение секретов

### Feature Flags
- Возможность включения/отключения функций
- A/B тестирование
- Постепенный rollout

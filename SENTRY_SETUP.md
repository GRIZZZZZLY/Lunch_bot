# 🔍 Настройка Sentry для мониторинга ошибок

## Зачем нужен Sentry?

Sentry автоматически отслеживает и логирует ошибки в production:
- ✅ Отлавливает неожиданные ошибки
- ✅ Собирает стек трейсы и контекст
- ✅ Отправляет уведомления о критических проблемах
- ✅ Анализирует производительность приложения
- ✅ Фильтрует чувствительные данные (токены, пароли)

## Шаг 1: Создание проекта в Sentry

1. Зарегистрируйтесь на [sentry.io](https://sentry.io)
2. Создайте новую организацию (если ее нет)
3. Создайте 2 проекта:
   - **telegram-food-bot-backend** (Node.js)
   - **telegram-food-bot-frontend** (React)
4. Скопируйте DSN (Data Source Name) для каждого проекта

## Шаг 2: Настройка Backend

### 2.1. Установка зависимостей

```bash
cd telegram-food-bot/backend
npm install @sentry/node @sentry/profiling-node
```

### 2.2. Настройка переменных окружения

Добавьте в `.env.production`:

```env
# ERROR MONITORING - SENTRY
ENABLE_SENTRY=true
SENTRY_DSN=https://your-backend-dsn@sentry.io/project-id
```

### 2.3. Проверка

Backend автоматически инициализирует Sentry при старте. Проверьте логи:

```
✅ Sentry инициализирован для окружения: production
```

## Шаг 3: Настройка Frontend

### 3.1. Установка зависимостей

```bash
cd telegram-food-bot/frontend
npm install @sentry/react
```

### 3.2. Настройка переменных окружения

Добавьте в `.env.production`:

```env
# ERROR MONITORING - SENTRY
VITE_ENABLE_SENTRY=true
VITE_SENTRY_DSN=https://your-frontend-dsn@sentry.io/project-id
```

### 3.3. Инициализация (если еще не настроено)

Создайте файл `frontend/src/lib/sentry.ts`:

```typescript
import * as Sentry from '@sentry/react';

export function initSentry() {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  const enableSentry = import.meta.env.VITE_ENABLE_SENTRY === 'true';
  const environment = import.meta.env.MODE;

  if (!enableSentry || !sentryDsn) {
    console.log('Sentry disabled');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      // Удаляем токены
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
      }
      return event;
    },
  });

  console.log('✅ Sentry initialized');
}
```

Импортируйте в `main.tsx`:

```typescript
import { initSentry } from './lib/sentry';

initSentry(); // Должно быть первым!

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## Шаг 4: Использование Sentry в коде

### Backend

```typescript
import { captureException, captureMessage, setUserContext } from './config/sentry.config';

// Отлавливаем исключения
try {
  // ...
} catch (error) {
  captureException(error, { context: 'poll-creation' });
}

// Логируем события
captureMessage('Poll created', 'info', { pollId: 123 });

// Устанавливаем контекст пользователя
setUserContext(user.id, user.username);
```

### Frontend

```typescript
import * as Sentry from '@sentry/react';

// Отлавливаем ошибки
try {
  // ...
} catch (error) {
  Sentry.captureException(error);
}

// Добавляем контекст
Sentry.setUser({ id: user.id, username: user.username });

// Breadcrumbs (хлебные крошки)
Sentry.addBreadcrumb({
  message: 'User voted',
  level: 'info',
  data: { pollId: 123, itemId: 456 },
});
```

## Шаг 5: Тестирование

### Backend

Создайте тестовый endpoint для проверки:

```typescript
app.get('/test-sentry', (req, res) => {
  throw new Error('Test Sentry error!');
});
```

Откройте `http://localhost:3001/test-sentry` - ошибка должна появиться в Sentry.

### Frontend

Добавьте кнопку в интерфейс:

```tsx
<button onClick={() => {
  throw new Error('Test Sentry error!');
}}>
  Test Sentry
</button>
```

## Шаг 6: Настройка уведомлений

В Sentry dashboard:

1. Settings → Integrations
2. Подключите Telegram/Slack/Email
3. Settings → Alerts → Create Alert Rule
4. Настройте условия (например, "новая ошибка в production")

## Фильтрация чувствительных данных

Backend автоматически удаляет:
- `TELEGRAM_BOT_TOKEN`
- `JWT_SECRET`
- `authorization` headers

Если нужно добавить больше фильтров, обновите `beforeSend` в `sentry.config.ts`.

## Игнорирование определенных ошибок

Backend игнорирует:
- Telegram API timeouts
- 404 ошибки
- ECONNRESET

Список можно расширить в `ignoreErrors` в `sentry.config.ts`.

## Отключение Sentry в разработке

В `.env.development`:

```env
ENABLE_SENTRY=false
```

В `.env.prod-dev`:

```env
ENABLE_SENTRY=false  # Или true для тестирования
```

## Проверка статуса

После деплоя проверьте:

1. Backend логи: должно быть `✅ Sentry инициализирован`
2. Sentry Dashboard → Issues - должны появляться новые ошибки
3. Performance → Transactions - отслеживание производительности

## Best Practices

1. **Не логируйте всё подряд** - используйте `captureException` только для реальных ошибок
2. **Добавляйте контекст** - передавайте дополнительные данные в `extra`
3. **Устанавливайте user context** - помогает отслеживать проблемы конкретных пользователей
4. **Используйте breadcrumbs** - помогают понять последовательность действий перед ошибкой
5. **Настройте sample rates** - в production не нужно отправлять 100% событий

## Troubleshooting

**Sentry не инициализируется:**
- Проверьте `ENABLE_SENTRY=true`
- Проверьте валидность SENTRY_DSN
- Проверьте интернет-соединение

**Ошибки не попадают в Sentry:**
- Проверьте `ignoreErrors` - может фильтруется
- Проверьте sample rate
- Проверьте квоты проекта в Sentry

**Слишком много событий:**
- Уменьшите `tracesSampleRate`
- Добавьте больше фильтров в `ignoreErrors`
- Используйте rate limits в Sentry dashboard

## Полезные ссылки

- [Sentry Node.js Docs](https://docs.sentry.io/platforms/node/)
- [Sentry React Docs](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Best Practices](https://docs.sentry.io/product/sentry-basics/guides/)

---

**Готово!** Теперь все ошибки будут автоматически отслеживаться и логироваться в Sentry 🎉

# 📊 Полное руководство по настройке мониторинга

**Дата:** 2025-10-29
**Проект:** Telegram Food Bot
**Статус:** ✅ Конфигурация готова, требуются DSN ключи

---

## 📋 Оглавление

1. [Текущее состояние](#текущее-состояние)
2. [Sentry - Мониторинг ошибок](#sentry---мониторинг-ошибок)
3. [PM2 - Мониторинг процессов](#pm2---мониторинг-процессов)
4. [Логирование](#логирование)
5. [Метрики производительности](#метрики-производительности)
6. [Alerting - Уведомления](#alerting---уведомления)
7. [Dashboard](#dashboard)
8. [Тестирование](#тестирование)

---

## 1. Текущее состояние

### ✅ Что уже настроено

**Backend:**
- ✅ Sentry конфигурация: `backend/src/config/sentry.config.ts`
- ✅ Winston logger: `backend/src/utils/logger.ts`
- ✅ Фильтрация чувствительных данных
- ✅ Игнорирование известных ошибок
- ✅ User context tracking

**Frontend:**
- ✅ Sentry конфигурация: `frontend/src/lib/sentry.ts`
- ✅ Session Replay
- ✅ Performance monitoring
- ✅ Error Boundary
- ✅ Breadcrumbs tracking

### ⏳ Что требуется

- ⚠️ Получить Sentry DSN ключи
- ⚠️ Настроить .env переменные
- ⚠️ Настроить PM2 мониторинг
- ⚠️ Создать dashboard для метрик

---

## 2. Sentry - Мониторинг ошибок

### 2.1 Создание Sentry проектов

#### Шаг 1: Регистрация на Sentry

1. Перейдите на [sentry.io](https://sentry.io)
2. Создайте аккаунт (можно через GitHub)
3. Создайте организацию: `telegram-food-bot`

#### Шаг 2: Создайте 2 проекта

**Проект 1: Backend**
- Name: `telegram-food-bot-backend`
- Platform: `Node.js`
- Alert frequency: `On every issue`

**Проект 2: Frontend**
- Name: `telegram-food-bot-frontend`
- Platform: `React`
- Alert frequency: `On every issue`

#### Шаг 3: Получите DSN ключи

После создания проектов:
1. Зайдите в Settings → Projects → [Project Name]
2. Перейдите в `Client Keys (DSN)`
3. Скопируйте DSN URL

**Пример DSN:**
```
https://a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6@o123456.ingest.sentry.io/7890123
```

### 2.2 Настройка Backend

#### Обновите `.env` файлы

**backend/.env.development:**
```bash
# Sentry (опционально для dev)
ENABLE_SENTRY=false
SENTRY_DSN=
```

**backend/.env.production:**
```bash
# Sentry Error Tracking
ENABLE_SENTRY=true
SENTRY_DSN=https://YOUR_BACKEND_DSN@o123456.ingest.sentry.io/7890123
```

#### Проверьте интеграцию в `backend/src/index.ts`

```typescript
import { initSentry } from './config/sentry.config';

// Инициализация Sentry (должно быть в самом начале)
initSentry();

// Остальной код приложения...
```

### 2.3 Настройка Frontend

#### Обновите `.env` файлы

**frontend/.env.development:**
```bash
# Sentry (не используется в dev)
VITE_SENTRY_DSN=
```

**frontend/.env.production:**
```bash
# Sentry Error Tracking
VITE_SENTRY_DSN=https://YOUR_FRONTEND_DSN@o123456.ingest.sentry.io/7890123
VITE_APP_VERSION=2.0.0
```

#### Проверьте интеграцию в `frontend/src/main.tsx`

```typescript
import { initSentry } from './lib/sentry';

// Инициализация Sentry перед рендером
initSentry();

// React render...
```

### 2.4 Тестирование Sentry

#### Backend тест

Добавьте тестовый endpoint:

```typescript
// backend/src/api/routes/test.routes.ts
import { Router } from 'express';
import { captureException, captureMessage } from '../../config/sentry.config';

const router = Router();

router.get('/sentry-test-error', (req, res) => {
  try {
    throw new Error('Test Sentry Error - Backend');
  } catch (error) {
    captureException(error as Error, { endpoint: '/sentry-test-error' });
    res.status(500).json({ error: 'Test error sent to Sentry' });
  }
});

router.get('/sentry-test-message', (req, res) => {
  captureMessage('Test Sentry Message - Backend', 'info');
  res.json({ message: 'Test message sent to Sentry' });
});

export default router;
```

**Запросы для тестирования:**
```bash
# Production (после деплоя)
curl https://rocket-lunch.duckdns.org/api/test/sentry-test-error
curl https://rocket-lunch.duckdns.org/api/test/sentry-test-message
```

#### Frontend тест

Добавьте тестовую кнопку (только для dev):

```typescript
// В любую страницу для тестирования
import { captureException, captureMessage } from '../lib/sentry';

// Тестовые функции
const testSentryError = () => {
  try {
    throw new Error('Test Sentry Error - Frontend');
  } catch (error) {
    captureException(error);
  }
};

const testSentryMessage = () => {
  captureMessage('Test Sentry Message - Frontend', 'info');
};
```

### 2.5 Настройка Alerts

В Sentry проекте:

1. **Settings → Alerts → New Alert Rule**

2. **Alert Rule для Backend:**
   - Name: `Backend Critical Errors`
   - When: `An issue is first seen`
   - Conditions: `Level equals error OR fatal`
   - Actions: `Send notification via Email` + `Slack` (опционально)

3. **Alert Rule для Frontend:**
   - Name: `Frontend User-Facing Errors`
   - When: `An issue's events exceed 10 in 1 hour`
   - Conditions: `Level equals error`
   - Actions: `Send notification via Email`

---

## 3. PM2 - Мониторинг процессов

### 3.1 Настройка PM2 на VPS

PM2 уже настроен через deployment скрипты, но давайте добавим мониторинг.

#### Установка PM2 Plus (опционально)

```bash
# На VPS
pm2 link YOUR_SECRET_KEY YOUR_PUBLIC_KEY

# Получить ключи на https://app.pm2.io
```

#### Базовые команды мониторинга

```bash
# Статус всех процессов
pm2 status

# Детальный мониторинг
pm2 monit

# Логи в реальном времени
pm2 logs rocket-lunch-bot

# Только ошибки
pm2 logs rocket-lunch-bot --err

# Метрики
pm2 describe rocket-lunch-bot

# Сохранить конфигурацию
pm2 save

# Автозапуск при перезагрузке
pm2 startup
```

### 3.2 PM2 Ecosystem файл

Создайте `telegram-food-bot/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'rocket-lunch-bot',
    script: './backend/dist/index.js',
    cwd: '/root/telegram-food-bot',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Мониторинг
    min_uptime: '10s',
    max_restarts: 10,

    // Metrics
    instance_var: 'INSTANCE_ID',
  }]
};
```

**Использование:**
```bash
pm2 start ecosystem.config.js
pm2 reload ecosystem.config.js --update-env
```

---

## 4. Логирование

### 4.1 Winston Logger (уже настроен)

**Конфигурация:** `backend/src/utils/logger.ts`

**Уровни логирования:**
- `error` - Ошибки (отправляются в Sentry)
- `warn` - Предупреждения
- `info` - Информационные сообщения
- `debug` - Отладочная информация

**Использование в коде:**

```typescript
import { logger } from '../utils/logger';

logger.error('Database connection failed', { error: err.message });
logger.warn('Poll expired', { pollId: poll.id });
logger.info('User voted', { userId, pollId, itemId });
logger.debug('Cache cleared', { keys: ['poll:*'] });
```

### 4.2 Ротация логов

Создайте скрипт `telegram-food-bot/scripts/setup-log-rotation.sh`:

```bash
#!/bin/bash

# Создаем конфигурацию logrotate
cat > /etc/logrotate.d/rocket-lunch-bot <<EOF
/root/telegram-food-bot/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

echo "✅ Log rotation configured"
```

**Запуск:**
```bash
chmod +x scripts/setup-log-rotation.sh
sudo ./scripts/setup-log-rotation.sh
```

### 4.3 Централизованное логирование (опционально)

Для production можно настроить:

**Option 1: Loki + Grafana**
- Loki - хранение логов
- Grafana - визуализация

**Option 2: ELK Stack**
- Elasticsearch - хранение
- Logstash - обработка
- Kibana - визуализация

**Option 3: Cloud services**
- [Papertrail](https://www.papertrail.com/) - простой cloud logging
- [Loggly](https://www.loggly.com/) - SaaS решение

---

## 5. Метрики производительности

### 5.1 Application Metrics

Создайте сервис для сбора метрик `backend/src/services/metrics.service.ts`:

```typescript
import { logger } from '../utils/logger';

interface Metrics {
  totalPolls: number;
  activePolls: number;
  totalVotes: number;
  totalUsers: number;
  avgResponseTime: number;
  errors24h: number;
}

class MetricsService {
  private metrics: Metrics = {
    totalPolls: 0,
    activePolls: 0,
    totalVotes: 0,
    totalUsers: 0,
    avgResponseTime: 0,
    errors24h: 0,
  };

  async collectMetrics(): Promise<Metrics> {
    try {
      const [polls, votes, users] = await Promise.all([
        prisma.poll.count(),
        prisma.vote.count(),
        prisma.user.count(),
      ]);

      const activePolls = await prisma.poll.count({
        where: { status: 'ACTIVE' },
      });

      this.metrics = {
        totalPolls: polls,
        activePolls,
        totalVotes: votes,
        totalUsers: users,
        avgResponseTime: this.metrics.avgResponseTime,
        errors24h: this.metrics.errors24h,
      };

      return this.metrics;
    } catch (error) {
      logger.error('Failed to collect metrics', { error });
      return this.metrics;
    }
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  incrementErrors(): void {
    this.metrics.errors24h++;
  }

  recordResponseTime(time: number): void {
    // Simple moving average
    this.metrics.avgResponseTime =
      (this.metrics.avgResponseTime * 0.9) + (time * 0.1);
  }
}

export const metricsService = new MetricsService();
```

**API Endpoint для метрик:**

```typescript
// backend/src/api/routes/metrics.routes.ts
import { Router } from 'express';
import { metricsService } from '../../services/metrics.service';

const router = Router();

router.get('/metrics', async (req, res) => {
  const metrics = await metricsService.collectMetrics();
  res.json(metrics);
});

export default router;
```

### 5.2 Response Time Middleware

```typescript
// backend/src/api/middleware/metrics.ts
import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../../services/metrics.service';

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    metricsService.recordResponseTime(duration);
  });

  next();
}
```

### 5.3 Health Check Endpoint

```typescript
// backend/src/api/routes/health.routes.ts
import { Router } from 'express';
import { prisma } from '../../database/client';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed',
    });
  }
});

export default router;
```

---

## 6. Alerting - Уведомления

### 6.1 Критические события

Настройте уведомления для:

1. **High Error Rate** - >10 ошибок в 5 минут
2. **Server Down** - PM2 не может restart процесс
3. **Database Issues** - Connection timeouts
4. **Memory Leaks** - Memory >90% от лимита

### 6.2 Telegram Alerting Bot (опционально)

Создайте отдельный бот для уведомлений:

```typescript
// backend/src/utils/alerting.ts
import { Bot } from 'grammy';

const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_ID;
const alertBot = new Bot(process.env.ALERT_BOT_TOKEN || '');

export async function sendAlert(
  level: 'critical' | 'warning' | 'info',
  message: string,
  details?: Record<string, any>
) {
  if (!ADMIN_CHAT_ID) return;

  const emoji = {
    critical: '🚨',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const text = `
${emoji[level]} <b>${level.toUpperCase()}</b>

${message}

${details ? `<pre>${JSON.stringify(details, null, 2)}</pre>` : ''}

<i>${new Date().toLocaleString('ru-RU')}</i>
  `.trim();

  try {
    await alertBot.api.sendMessage(ADMIN_CHAT_ID, text, {
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
}
```

---

## 7. Dashboard

### 7.1 Простой HTML Dashboard

Создайте `telegram-food-bot/public/dashboard.html`:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rocket Lunch Bot - Monitoring Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 30px;
      font-size: 2.5rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .metric {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .metric-name {
      color: #666;
      font-size: 14px;
    }
    .metric-value {
      color: #333;
      font-size: 24px;
      font-weight: bold;
    }
    .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .status.healthy { background: #10b981; color: white; }
    .status.warning { background: #f59e0b; color: white; }
    .status.error { background: #ef4444; color: white; }
    canvas {
      margin-top: 20px;
    }
    .loading {
      text-align: center;
      color: white;
      font-size: 18px;
      margin-top: 50px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🍽️ Rocket Lunch Bot - Monitoring</h1>

    <div class="grid">
      <!-- Health Status -->
      <div class="card">
        <h2>System Health</h2>
        <div class="metric">
          <span class="metric-name">Status:</span>
          <span id="health-status" class="status healthy">Healthy</span>
        </div>
        <div class="metric">
          <span class="metric-name">Uptime:</span>
          <span id="uptime" class="metric-value">-</span>
        </div>
        <div class="metric">
          <span class="metric-name">Database:</span>
          <span id="db-status" class="status healthy">Connected</span>
        </div>
      </div>

      <!-- Metrics -->
      <div class="card">
        <h2>Application Metrics</h2>
        <div class="metric">
          <span class="metric-name">Total Polls:</span>
          <span id="total-polls" class="metric-value">-</span>
        </div>
        <div class="metric">
          <span class="metric-name">Active Polls:</span>
          <span id="active-polls" class="metric-value">-</span>
        </div>
        <div class="metric">
          <span class="metric-name">Total Votes:</span>
          <span id="total-votes" class="metric-value">-</span>
        </div>
        <div class="metric">
          <span class="metric-name">Total Users:</span>
          <span id="total-users" class="metric-value">-</span>
        </div>
      </div>

      <!-- Performance -->
      <div class="card">
        <h2>Performance</h2>
        <div class="metric">
          <span class="metric-name">Avg Response Time:</span>
          <span id="response-time" class="metric-value">-</span>
        </div>
        <div class="metric">
          <span class="metric-name">Errors (24h):</span>
          <span id="errors-24h" class="metric-value">-</span>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <div class="card">
      <h2>Activity Chart</h2>
      <canvas id="activityChart"></canvas>
    </div>
  </div>

  <script>
    const API_URL = window.location.origin;

    // Fetch health status
    async function fetchHealth() {
      try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();

        document.getElementById('health-status').textContent = data.status;
        document.getElementById('health-status').className =
          `status ${data.status === 'healthy' ? 'healthy' : 'error'}`;

        const uptimeHours = Math.floor(data.uptime / 3600);
        document.getElementById('uptime').textContent = `${uptimeHours}h`;

        document.getElementById('db-status').textContent = data.database;
      } catch (error) {
        document.getElementById('health-status').textContent = 'Error';
        document.getElementById('health-status').className = 'status error';
      }
    }

    // Fetch metrics
    async function fetchMetrics() {
      try {
        const response = await fetch(`${API_URL}/api/metrics`);
        const data = await response.json();

        document.getElementById('total-polls').textContent = data.totalPolls;
        document.getElementById('active-polls').textContent = data.activePolls;
        document.getElementById('total-votes').textContent = data.totalVotes;
        document.getElementById('total-users').textContent = data.totalUsers;
        document.getElementById('response-time').textContent =
          `${Math.round(data.avgResponseTime)}ms`;
        document.getElementById('errors-24h').textContent = data.errors24h;
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    }

    // Initialize chart
    const ctx = document.getElementById('activityChart');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Active Polls',
          data: [],
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }, {
          label: 'Votes',
          data: [],
          borderColor: 'rgb(153, 102, 255)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });

    // Update dashboard
    async function updateDashboard() {
      await Promise.all([fetchHealth(), fetchMetrics()]);
    }

    // Initial load and refresh every 30 seconds
    updateDashboard();
    setInterval(updateDashboard, 30000);
  </script>
</body>
</html>
```

**Доступ к dashboard:**
```
https://rocket-lunch.duckdns.org/dashboard.html
```

---

## 8. Тестирование мониторинга

### 8.1 Чек-лист проверки

После настройки проверьте:

- [ ] Sentry получает ошибки с backend
- [ ] Sentry получает ошибки с frontend
- [ ] Sentry Session Replay работает
- [ ] PM2 отслеживает процесс
- [ ] Логи пишутся корректно
- [ ] Health endpoint отвечает
- [ ] Metrics endpoint возвращает данные
- [ ] Dashboard отображает метрики
- [ ] Alerts приходят на email
- [ ] Log rotation настроен

### 8.2 Тестовые сценарии

```bash
# 1. Тест Sentry (после настройки DSN)
curl https://rocket-lunch.duckdns.org/api/test/sentry-test-error

# 2. Проверка здоровья
curl https://rocket-lunch.duckdns.org/health

# 3. Проверка метрик
curl https://rocket-lunch.duckdns.org/api/metrics

# 4. PM2 статус
ssh root@YOUR_VPS_IP
pm2 status
pm2 monit

# 5. Логи
pm2 logs rocket-lunch-bot --lines 100
```

---

## 9. Чек-лист деплоя с мониторингом

### Перед деплоем:

- [ ] Получены Sentry DSN ключи (backend + frontend)
- [ ] Обновлены .env.production файлы
- [ ] Sentry alert rules настроены
- [ ] Логирование проверено локально

### На VPS:

- [ ] PM2 установлен и настроен
- [ ] Log rotation настроен
- [ ] Health endpoint доступен
- [ ] Metrics endpoint доступен
- [ ] Dashboard доступен

### После деплоя:

- [ ] Sentry получает события
- [ ] PM2 показывает процесс
- [ ] Логи пишутся
- [ ] Dashboard показывает метрики
- [ ] Тестовые ошибки появляются в Sentry

---

## 10. Полезные ссылки

- [Sentry Docs](https://docs.sentry.io/)
- [PM2 Docs](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Winston Docs](https://github.com/winstonjs/winston)
- [Grafana](https://grafana.com/docs/)

---

## 11. Следующие шаги

### Immediate (1-2 days):
1. Получить Sentry DSN ключи
2. Обновить .env файлы
3. Протестировать локально
4. Задеплоить на VPS
5. Проверить работу мониторинга

### Short-term (1-2 weeks):
6. Настроить Telegram alerting
7. Добавить более детальные метрики
8. Создать custom dashboard
9. Настроить performance budgets

### Long-term (1+ month):
10. Интеграция с Grafana
11. Распределенный трейсинг
12. Predictive alerting
13. Автоматическое масштабирование

---

**Статус:** ✅ Готов к получению DSN ключей и финальной настройке

**Следующий шаг:** Зарегистрируйтесь на [sentry.io](https://sentry.io) и получите DSN ключи

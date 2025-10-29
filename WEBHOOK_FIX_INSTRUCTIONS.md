# Инструкция по исправлению webhook роута

## Проблема
Роут `/webhook` регистрируется ПОСЛЕ запуска Express сервера, поэтому Telegram получает 404.

## Решение
Исправить порядок в файле `backend/src/index.ts`

### На VPS выполни:

```bash
cd ~/Lunch_bot/telegram-food-bot/backend/src

# 1. Создай backup
cp index.ts index.ts.backup

# 2. Открой файл в редакторе
nano index.ts
```

### Найди строки 60-81 (функция startApplication):

```typescript
    // Запуск бота
    // Запуск API сервера СНАЧАЛА
    startApiServer(app);

    if (process.env.NODE_ENV === 'production' && botConfig.webhookUrl) {
      // Production: webhook режим
      await setupWebhook(bot, botConfig.webhookUrl);

      // Обработчик webhook
      app.use(`/webhook`, async (req, res) => {
        try {
          await bot.handleUpdate(req.body);
          res.sendStatus(200);
        } catch (error) {
          logger.error('Ошибка обработки webhook:', error);
          res.sendStatus(500);
        }
      });
    } else {
      // Development: polling режим (запускаем БЕЗ await)
      startPolling(bot);
    }
```

### Замени на:

```typescript
    // Запуск бота
    if (process.env.NODE_ENV === 'production' && botConfig.webhookUrl) {
      // Production: webhook режим

      // ✅ FIX: Регистрируем роут webhook ДО запуска сервера
      app.post('/webhook', async (req, res) => {
        try {
          await bot.handleUpdate(req.body);
          res.sendStatus(200);
        } catch (error) {
          logger.error('Ошибка обработки webhook:', error);
          res.sendStatus(500);
        }
      });

      // Запускаем API сервер
      startApiServer(app);

      // Устанавливаем webhook в Telegram
      await setupWebhook(bot, botConfig.webhookUrl);
    } else {
      // Development: polling режим
      startApiServer(app);
      startPolling(bot);
    }
```

### Ключевые изменения:
1. **app.use → app.post** (правильный HTTP метод)
2. **Роут регистрируется ДО startApiServer()**
3. **setupWebhook вызывается ПОСЛЕ startApiServer()**

### Сохрани и выйди:
- Ctrl+O (сохранить)
- Enter
- Ctrl+X (выйти)

### Пересобери и перезапусти:

```bash
cd ~/Lunch_bot/telegram-food-bot/backend
npm run build

pm2 restart rocket-lunch-bot

# Проверь логи
pm2 logs rocket-lunch-bot --lines 30
```

### Ожидаемый результат:
```
✅ Приложение успешно запущено
```

Без ошибок 404 на /webhook.

### Проверь работу:
Отправь боту `/start` в Telegram - должен ответить!

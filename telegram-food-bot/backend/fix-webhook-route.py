#!/usr/bin/env python3
import re

with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Найти и заменить блок с webhook
old_block = """    // Запуск бота
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

    logger.info('✅ Приложение успешно запущено');"""

new_block = """    // Запуск бота
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

    logger.info('✅ Приложение успешно запущено');"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open('src/index.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK: Webhook route fixed!')
else:
    print('ERROR: Could not find old block')
    print('Trying to show current content around line 60-83:')
    lines = content.split('\n')
    for i, line in enumerate(lines[59:83], start=60):
        print(f'{i}: {line}')

#!/bin/bash

echo "Fixing webhook route order in index.ts..."

cd "$(dirname "$0")/src"

# Backup
cp index.ts index.ts.backup.$(date +%Y%m%d_%H%M%S)

# Применяем патч с помощью sed
# Удаляем старые строки 61-62 и заменяем блок
sed -i '60,81d' index.ts

# Вставляем новый блок после строки 59
sed -i '59a\    // Запуск бота\
    if (process.env.NODE_ENV === '"'"'production'"'"' && botConfig.webhookUrl) {\
      // Production: webhook режим\
\
      // ✅ FIX: Регистрируем роут webhook ДО запуска сервера\
      app.post('"'"'/webhook'"'"', async (req, res) => {\
        try {\
          await bot.handleUpdate(req.body);\
          res.sendStatus(200);\
        } catch (error) {\
          logger.error('"'"'Ошибка обработки webhook:'"'"', error);\
          res.sendStatus(500);\
        }\
      });\
\
      // Запускаем API сервер\
      startApiServer(app);\
\
      // Устанавливаем webhook в Telegram\
      await setupWebhook(bot, botConfig.webhookUrl);\
    } else {\
      // Development: polling режим\
      startApiServer(app);\
      startPolling(bot);\
    }' index.ts

echo "✅ File patched successfully!"
echo "Now run: npm run build && pm2 restart rocket-lunch-bot"

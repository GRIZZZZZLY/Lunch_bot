#!/bin/bash
# СРОЧНОЕ ИСПРАВЛЕНИЕ для VPS
# Выполните эти команды на VPS НЕМЕДЛЕННО!

echo "=== СРОЧНОЕ ИСПРАВЛЕНИЕ REDIS.CONFIG ==="

# Проверяем наличие файла
echo "1. Проверка исходного файла..."
ls -la ~/Lunch_bot/telegram-food-bot/backend/src/config/redis.config.ts

# Проверяем скомпилированный файл
echo "2. Проверка скомпилированного файла..."
ls -la ~/Lunch_bot/telegram-food-bot/backend/dist/config/redis.config.js || echo "ФАЙЛ НЕ НАЙДЕН!"

# Переходим в backend
cd ~/Lunch_bot/telegram-food-bot/backend

# Очищаем старую сборку
echo "3. Очистка старой сборки..."
rm -rf dist/

# Пересборка с нуля
echo "4. Пересборка backend..."
npm run build

# Проверяем результат
echo "5. Проверка результата сборки..."
if [ -f dist/config/redis.config.js ]; then
    echo "✅ redis.config.js создан успешно!"
else
    echo "❌ ОШИБКА: redis.config.js НЕ создан!"
    exit 1
fi

# Перезапуск PM2
echo "6. Перезапуск PM2..."
pm2 restart rocket-lunch-bot

# Ждём 3 секунды
sleep 3

# Проверка логов
echo "7. Проверка логов (последние 30 строк)..."
pm2 logs rocket-lunch-bot --lines 30 --nostream

echo ""
echo "=== ГОТОВО! ==="
echo "Проверьте, нет ли ошибки 'Cannot find module redis.config' в логах выше."

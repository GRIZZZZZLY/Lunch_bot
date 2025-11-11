#!/usr/bin/env node

/**
 * Универсальный скрипт для обновления Menu Button в Telegram
 *
 * Использует:
 * - ✅ dotenv для парсинга .env файлов
 * - ✅ Grammy API для работы с Telegram Bot API
 *
 * Преимущества:
 * - Нет самописного .env парсинга
 * - Нет низкоуровневых https.request
 * - Автоматическая обработка ошибок
 * - Поддержка всех edge cases
 */

require('dotenv').config({ path: './backend/.env' });
const { Bot } = require('grammy');

// Константы
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

/**
 * Главная функция
 */
async function updateMenuButton() {
  console.log('');
  console.log('========================================');
  console.log('  UPDATE TELEGRAM MENU BUTTON');
  console.log('========================================');
  console.log('');

  // Валидация переменных окружения
  if (!BOT_TOKEN) {
    console.error('❌ ERROR: BOT_TOKEN not found in backend/.env');
    console.error('📂 Check file: ./backend/.env');
    process.exit(1);
  }

  if (!WEBAPP_URL) {
    console.error('❌ ERROR: WEBAPP_URL not found in backend/.env');
    console.error('📂 Check file: ./backend/.env');
    process.exit(1);
  }

  console.log(`🔑 Bot Token: ${BOT_TOKEN.substring(0, 15)}...`);
  console.log(`🌐 WebApp URL: ${WEBAPP_URL}`);
  console.log('');

  try {
    // Создаём bot instance
    const bot = new Bot(BOT_TOKEN);

    console.log('🔄 Updating menu button...');

    // Обновляем menu button через Grammy API
    await bot.api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: 'Открыть меню',
        web_app: {
          url: WEBAPP_URL
        }
      }
    });

    console.log('');
    console.log('✅ SUCCESS: Menu button updated!');
    console.log('');
    console.log('📱 Users can now access the app via:');
    console.log('   - Menu button (bottom left)');
    console.log('   - /app command');
    console.log('   - Deep links from group messages');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ ERROR: Failed to update menu button');
    console.error('');

    if (error.error_code === 401) {
      console.error('🔐 Authentication failed:');
      console.error('   - Check if BOT_TOKEN is valid');
      console.error('   - Token format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
    } else if (error.error_code === 400) {
      console.error('⚠️  Invalid request:');
      console.error('   - Check if WEBAPP_URL is a valid HTTPS URL');
      console.error('   - Telegram requires HTTPS for WebApps');
    } else {
      console.error('📋 Error details:');
      console.error(`   Code: ${error.error_code || 'unknown'}`);
      console.error(`   Message: ${error.description || error.message}`);
    }

    console.error('');
    process.exit(1);
  }
}

// Запуск
updateMenuButton();

#!/usr/bin/env node

/**
 * Универсальный скрипт для обновления Menu Button в Telegram
 *
 * ПРИМЕЧАНИЕ: Этот скрипт идентичен update-menu-button.js
 * Оставлен для обратной совместимости со старыми PowerShell скриптами.
 *
 * Использует:
 * - ✅ dotenv для парсинга .env файлов
 * - ✅ Grammy API для работы с Telegram Bot API
 */

require('dotenv').config({ path: './backend/.env' });
const { Bot } = require('grammy');

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

async function updateMenuButton() {
  console.log('');
  console.log('========================================');
  console.log('  UPDATE TELEGRAM MENU BUTTON (NGROK)');
  console.log('========================================');
  console.log('');
  console.log('💡 TIP: This script reads WEBAPP_URL from backend/.env');
  console.log('   Make sure it points to your ngrok URL!');
  console.log('');

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

  // Проверка что URL похож на ngrok
  const isNgrokUrl = WEBAPP_URL.includes('ngrok');
  if (!isNgrokUrl) {
    console.warn('⚠️  WARNING: WEBAPP_URL does not contain "ngrok"');
    console.warn('   Expected format: https://xxxx-xx-xx-xxx-xx.ngrok-free.app');
    console.warn('   Current value: ' + WEBAPP_URL);
    console.warn('');
  }

  try {
    const bot = new Bot(BOT_TOKEN);

    console.log('🔄 Updating menu button...');

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
    console.log('📱 Test the button:');
    console.log('   1. Open your bot in Telegram');
    console.log('   2. Click menu button (bottom left)');
    console.log('   3. App should open with ngrok URL');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ ERROR: Failed to update menu button');
    console.error('');

    if (error.error_code === 401) {
      console.error('🔐 Authentication failed:');
      console.error('   - Check if BOT_TOKEN is valid');
    } else if (error.error_code === 400) {
      console.error('⚠️  Invalid request:');
      console.error('   - Check if WEBAPP_URL is a valid HTTPS URL');
      console.error('   - Telegram requires HTTPS (ngrok provides this automatically)');
    } else {
      console.error('📋 Error details:');
      console.error(`   Code: ${error.error_code || 'unknown'}`);
      console.error(`   Message: ${error.description || error.message}`);
    }

    console.error('');
    process.exit(1);
  }
}

updateMenuButton();

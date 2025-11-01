// Скрипт для обновления Menu Button с новым URL
const fs = require('fs');
const https = require('https');

// Читаем .env файл
const envPath = require('path').join(__dirname, 'backend', '.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};

// Улучшенный парсер .env
envFile.split(/\r?\n/).forEach(line => {
  // Удаляем пробелы по краям
  line = line.trim();

  // Пропускаем пустые строки и комментарии
  if (!line || line.startsWith('#')) {
    return;
  }

  // Ищем знак =
  const equalIndex = line.indexOf('=');
  if (equalIndex === -1) {
    return;
  }

  const key = line.substring(0, equalIndex).trim();
  const value = line.substring(equalIndex + 1).trim();

  if (key && value) {
    envVars[key] = value;
  }
});

const BOT_TOKEN = envVars.BOT_TOKEN;
const WEBAPP_URL = envVars.WEBAPP_URL;

console.log('🔍 Найденные переменные:');
console.log('   BOT_TOKEN:', BOT_TOKEN ? `${BOT_TOKEN.substring(0, 10)}...` : '❌ НЕ НАЙДЕН');
console.log('   WEBAPP_URL:', WEBAPP_URL || '❌ НЕ НАЙДЕН');
console.log('');

if (!BOT_TOKEN || !WEBAPP_URL) {
  console.error('❌ BOT_TOKEN или WEBAPP_URL не установлены');
  console.error('📂 Проверьте файл:', envPath);
  process.exit(1);
}

// Удаляем старый menu button
const deleteOptions = {
  hostname: 'api.telegram.org',
  path: `/bot${BOT_TOKEN}/setChatMenuButton`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const deleteData = JSON.stringify({
  menu_button: { type: 'default' }
});

console.log('🔄 Сброс menu button...');

const deleteReq = https.request(deleteOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('✅ Menu button сброшен');
    
    // Устанавливаем новый
    setTimeout(() => {
      const setOptions = {
        hostname: 'api.telegram.org',
        path: `/bot${BOT_TOKEN}/setChatMenuButton`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      };

      const setData = JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: 'Выбрать обед',
          web_app: {
            url: WEBAPP_URL
          }
        }
      });

      console.log('🔄 Установка нового menu button...');
      console.log('📍 URL:', WEBAPP_URL);

      const setReq = https.request(setOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log('✅ Menu button обновлен!');
          console.log('📱 Теперь:');
          console.log('   1. Закройте чат с ботом полностью');
          console.log('   2. Откройте снова');
          console.log('   3. Нажмите на иконку меню');
        });
      });

      setReq.write(setData);
      setReq.end();
    }, 1000);
  });
});

deleteReq.write(deleteData);
deleteReq.end();

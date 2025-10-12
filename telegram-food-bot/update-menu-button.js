// Скрипт для обновления Menu Button с новым URL
const fs = require('fs');
const https = require('https');

// Читаем .env файл
const envFile = fs.readFileSync('./backend/.env', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const BOT_TOKEN = envVars.BOT_TOKEN;
const WEBAPP_URL = envVars.WEBAPP_URL;

if (!BOT_TOKEN || !WEBAPP_URL) {
  console.error('❌ BOT_TOKEN или WEBAPP_URL не установлены');
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
          text: '📋 Мои группы',
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

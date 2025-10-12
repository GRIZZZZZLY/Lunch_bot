// Тест подключения к Telegram API
const https = require('https');

console.log('Testing Telegram API connection...\n');

// Тест 1: Простой запрос
https.get('https://api.telegram.org/', (res) => {
  console.log('✅ Test 1: HTTPS connection successful');
  console.log('Status:', res.statusCode);
  console.log('');
  
  // Тест 2: Запрос к боту
  const BOT_TOKEN = process.env.BOT_TOKEN || '8298516078:AAF3QAaoVURt634PcNtwMKiExF2nILnziGk';
  
  https.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, (res2) => {
    console.log('✅ Test 2: Bot API request successful');
    console.log('Status:', res2.statusCode);
    
    let data = '';
    res2.on('data', (chunk) => { data += chunk; });
    res2.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.ok) {
          console.log('✅ Test 3: Bot authenticated');
          console.log('Bot:', json.result.username);
          console.log('\n🎉 All tests passed! Telegram API is accessible.');
        } else {
          console.log('❌ Test 3 failed:', json.description);
        }
      } catch (err) {
        console.log('❌ Parse error:', err.message);
      }
    });
  }).on('error', (err) => {
    console.log('❌ Test 2 failed:', err.message);
    console.log('Code:', err.code);
  });
  
}).on('error', (err) => {
  console.log('❌ Test 1 failed:', err.message);
  console.log('Code:', err.code);
  console.log('\nPossible solutions:');
  console.log('1. Check internet connection');
  console.log('2. Check firewall/antivirus settings');
  console.log('3. Try using a VPN if Telegram is blocked');
  console.log('4. Set NODE_TLS_REJECT_UNAUTHORIZED=0 (NOT recommended for production)');
});

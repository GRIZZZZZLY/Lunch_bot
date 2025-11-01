#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, 'backend', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const botToken = envContent.match(/^BOT_TOKEN=(.+)$/m)?.[1]?.trim();
const webappUrl = envContent.match(/^WEBAPP_URL=(.+)$/m)?.[1]?.trim();

if (!botToken || !webappUrl) {
  console.error('❌ ERROR: BOT_TOKEN or WEBAPP_URL not found in backend/.env');
  process.exit(1);
}

console.log('');
console.log('========================================');
console.log('  UPDATE TELEGRAM MENU BUTTON');
console.log('========================================');
console.log('');
console.log(`🔑 Bot Token: ${botToken.substring(0, 15)}...`);
console.log(`🌐 WebApp URL: ${webappUrl}`);
console.log('');

// Prepare request data
const data = JSON.stringify({
  menu_button: {
    type: 'web_app',
    text: 'Открыть меню',
    web_app: {
      url: webappUrl
    }
  }
});

const options = {
  hostname: 'api.telegram.org',
  port: 443,
  path: `/bot${botToken}/setChatMenuButton`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('🔄 Updating menu button...');

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(responseData);

      if (response.ok) {
        console.log('✅ SUCCESS: Menu button updated!');
        console.log('');
        console.log(`📱 Menu button now opens: ${webappUrl}`);
        console.log('');
        console.log('✨ You can now test the bot in Telegram!');
      } else {
        console.error('❌ ERROR: Failed to update menu button');
        console.error('Response:', JSON.stringify(response, null, 2));
      }
    } catch (err) {
      console.error('❌ ERROR: Failed to parse response');
      console.error('Raw response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ ERROR: Request failed');
  console.error(error.message);
});

req.write(data);
req.end();

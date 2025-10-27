const crypto = require('crypto');

// Из логов
const botToken = '8298516078:AAF3QAaoVURt634PcNtwMKiExF2nILnziGk';
const dataCheckString = 'auth_date=1761554164\nquery_id=AAEgTRwhAAAAACBNHCHd9J85\nuser={"id":555502880,"first_name":"Игорь","last_name":"","username":"igo_kravts","language_code":"ru","is_premium":true,"allows_write_to_pm":true,"photo_url":"https://t.me/i/userpic/320/MBilWOD5D8SWpocN4gcDd_hBAHftHOccZKDOfCA91Ls.svg"}';
const receivedSignature = 'ko2JQyZDh13v4J_833JQqLAImRQsOTNInNeyg1yU2BGKBUb6keJe6R98VzWdi56NPQLSjeSjO9cXmPFkZ3AVCA';

console.log('=== TESTING SIGNATURE VALIDATION ===\n');

// 1. Создаём промежуточный ключ
const secretKey = crypto
  .createHmac('sha256', 'WebAppData')
  .update(botToken)
  .digest();

console.log('1. Secret key (hex):', secretKey.toString('hex'));
console.log('2. Secret key (base64):', secretKey.toString('base64'), '\n');

// 2. Вычисляем HMAC
const hmac = crypto
  .createHmac('sha256', secretKey)
  .update(dataCheckString)
  .digest();

console.log('3. HMAC (hex):', hmac.toString('hex'));
console.log('4. HMAC (base64):', hmac.toString('base64'));

// 3. Конвертируем в base64url
const base64 = hmac.toString('base64');
const base64url = base64
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

console.log('5. HMAC (base64url):', base64url);
console.log('6. Received signature:', receivedSignature);
console.log('7. Match:', base64url === receivedSignature, '\n');

// 4. Попробуем конвертировать полученную signature обратно
const receivedBase64 = receivedSignature
  .replace(/-/g, '+')
  .replace(/_/g, '/');
// Добавляем padding если нужно
const padding = (4 - (receivedBase64.length % 4)) % 4;
const receivedBase64Padded = receivedBase64 + '='.repeat(padding);

console.log('8. Received as base64:', receivedBase64Padded);
console.log('9. Our base64:', base64);
console.log('10. Base64 match:', receivedBase64Padded === base64);

// 5. Сравниваем как Buffer
const receivedBuffer = Buffer.from(receivedBase64Padded, 'base64');
console.log('\n11. Received buffer (hex):', receivedBuffer.toString('hex'));
console.log('12. Our buffer (hex):', hmac.toString('hex'));
console.log('13. Buffer match:', receivedBuffer.equals(hmac));

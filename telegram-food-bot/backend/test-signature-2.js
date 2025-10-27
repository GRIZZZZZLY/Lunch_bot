const crypto = require('crypto');

// Из логов - исходный initData
const initDataRaw = 'query_id=AAEgTRwhAAAAACBNHCHd9J85&user=%7B%22id%22%3A555502880%2C%22first_name%22%3A%22%D0%98%D0%B3%D0%BE%D1%80%D1%8C%22%2C%22last_name%22%3A%22%22%2C%22username%22%3A%22igo_kravts%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2FMBilWOD5D8SWpocN4gcDd_hBAHftHOccZKDOfCA91Ls.svg%22%7D&auth_date=1761554164&signature=ko2JQyZDh13v4J_833JQqLAImRQsOTNInNeyg1yU2BGKBUb6keJe6R98VzWdi56NPQLSjeSjO9cXmPFkZ3AVCA&hash=a0d2df78ae5d5d2e5d2e5d2e5d2e5d2e5d2e5d2e5d2e5d2e5d2e5d2e5d2e5d2e';

const botToken = '8298516078:AAF3QAaoVURt634PcNtwMKiExF2nILnziGk';

console.log('=== TESTING WITH URLSearchParams ===\n');

// Парсим как URLSearchParams
const params = new URLSearchParams(initDataRaw);
const signature = params.get('signature');
const hash = params.get('hash');

console.log('Received signature:', signature);
console.log('Received hash:', hash, '\n');

// Удаляем signature и hash
params.delete('signature');
params.delete('hash');

// Создаём dataCheckString
const sortedKeys = Array.from(params.keys()).sort();
console.log('Sorted keys:', sortedKeys);

const dataCheckString = sortedKeys
  .map(key => `${key}=${params.get(key)}`)
  .join('\n');

console.log('\n=== DATA CHECK STRING ===');
console.log(dataCheckString);
console.log('\n=== LENGTH:', dataCheckString.length, '===\n');

// Вычисляем подпись
const secretKey = crypto
  .createHmac('sha256', 'WebAppData')
  .update(botToken)
  .digest();

const hmac = crypto
  .createHmac('sha256', secretKey)
  .update(dataCheckString)
  .digest();

const base64 = hmac.toString('base64');
const base64url = base64
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

console.log('Calculated base64url:', base64url);
console.log('Received signature:', signature);
console.log('Match:', base64url === signature);

import crypto from 'crypto';

/**
 * Генерирует валидный Telegram initData для тестов
 */
export function generateTelegramInitData(userId: number = 123456789): string {
  const authDate = Math.floor(Date.now() / 1000);
  
  const user = {
    id: userId,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'ru',
  };

  const dataCheckString = `auth_date=${authDate}\nuser=${JSON.stringify(user)}`;
  
  // Для тестов используем тестовый токен или пропускаем валидацию
  const botToken = process.env.TELEGRAM_BOT_TOKEN || 'test_token';
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return `auth_date=${authDate}&hash=${hash}&user=${encodeURIComponent(JSON.stringify(user))}`;
}

/**
 * Генерирует невалидный initData для негативных тестов
 */
export function generateInvalidInitData(): string {
  return 'invalid_data=true&hash=invalid_hash';
}

/**
 * Парсит initData обратно в объект
 */
export function parseInitData(initData: string): Record<string, any> {
  const params = new URLSearchParams(initData);
  const result: Record<string, any> = {};
  
  params.forEach((value, key) => {
    if (key === 'user') {
      result[key] = JSON.parse(value);
    } else {
      result[key] = value;
    }
  });
  
  return result;
}

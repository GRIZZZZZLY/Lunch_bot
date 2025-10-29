import crypto from 'crypto';
import { logger } from './logger';

/**
 * Валидация initData от Telegram WebApp
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string
): { isValid: boolean; data?: any } {
  try {
    // Парсим данные
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      logger.warn('Отсутствует hash в initData');
      return { isValid: false };
    }

    // Удаляем hash для проверки
    urlParams.delete('hash');
    
    // Сортируем параметры по ключу
    const sortedParams = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Создаем secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Вычисляем hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex');

    const isValid = calculatedHash === hash;

    if (!isValid) {
      logger.warn('Невалидный hash в initData', {
        calculated: calculatedHash,
        received: hash,
      });
      return { isValid: false };
    }

    // Парсим данные пользователя
    const userData = urlParams.get('user');
    const authDate = urlParams.get('auth_date');
    
    if (!userData || !authDate) {
      logger.warn('Отсутствуют обязательные данные в initData');
      return { isValid: false };
    }

    // Проверяем время жизни данных (24 часа)
    const authTimestamp = parseInt(authDate) * 1000;
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 часа
    
    if (now - authTimestamp > maxAge) {
      logger.warn('InitData устарел', {
        authDate: new Date(authTimestamp),
        now: new Date(now),
        ageHours: Math.round((now - authTimestamp) / (60 * 60 * 1000)),
      });
      return { isValid: false };
    }

    // Возвращаем валидные данные
    const parsedUserData = JSON.parse(decodeURIComponent(userData));
    
    return {
      isValid: true,
      data: {
        user: parsedUserData,
        auth_date: parseInt(authDate),
        query_id: urlParams.get('query_id'),
        chat: urlParams.get('chat') ? JSON.parse(decodeURIComponent(urlParams.get('chat')!)) : undefined,
        chat_type: urlParams.get('chat_type'),
        chat_instance: urlParams.get('chat_instance'),
        start_param: urlParams.get('start_param'),
        can_send_after: urlParams.get('can_send_after') ? parseInt(urlParams.get('can_send_after')!) : undefined,
      }
    };

  } catch (error) {
    logger.error('Ошибка валидации initData:', error);
    return { isValid: false };
  }
}

/**
 * Извлечение Authorization заголовка
 */
export function extractAuthHeader(authHeader: string): string | null {
  if (!authHeader || !authHeader.startsWith('tma ')) {
    return null;
  }
  
  return authHeader.substring(4); // Убираем 'tma '
}

/**
 * Генерация случайного токена
 */
export function generateRandomToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Хеширование пароля (для будущего использования)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Проверка пароля (для будущего использования)
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
  return testHash === hash;
}

/**
 * Создание подписи для webhook
 */
export function createWebhookSignature(body: string, secretToken: string): string {
  return crypto
    .createHmac('sha256', secretToken)
    .update(body)
    .digest('hex');
}

/**
 * Проверка подписи webhook
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secretToken: string
): boolean {
  try {
    // ✅ FIX: Проверяем формат подписи перед созданием буфера
    // Подпись должна быть hex строкой чётной длины (64 символа для SHA-256)
    if (!signature || signature.length !== 64 || !/^[0-9a-fA-F]+$/.test(signature)) {
      logger.warn('Invalid webhook signature format', {
        signatureLength: signature?.length,
        expectedLength: 64,
        isHex: /^[0-9a-fA-F]+$/.test(signature || ''),
      });
      return false;
    }

    const expectedSignature = createWebhookSignature(body, secretToken);
    
    // Теперь безопасно создаём буферы одинаковой длины
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return false;
  }
}

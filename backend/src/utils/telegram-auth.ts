import crypto from 'crypto';
import { logger } from './logger';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
}

interface TelegramInitData {
  user?: TelegramUser;
  auth_date: number;
  hash: string;
  [key: string]: any;
}

/**
 * Валидация initData от Telegram WebApp
 * @param initData Строка с данными от Telegram
 * @returns Данные пользователя или null если валидация не прошла
 */
export function validateTelegramInitData(initData: string): TelegramUser | null {
  try {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      logger.error('BOT_TOKEN not found in environment variables');
      return null;
    }

    // Парсим initData
    const parsed = parseInitData(initData);
    if (!parsed) {
      logger.warn('Failed to parse initData');
      return null;
    }

    // Проверяем подпись
    const isValid = verifyTelegramHash(parsed, botToken);
    if (!isValid) {
      logger.warn('Invalid Telegram hash');
      return null;
    }

    // Проверяем время (не старше 1 часа)
    const authDate = parsed.auth_date * 1000; // Конвертируем в миллисекунды
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 час

    if (now - authDate > maxAge) {
      logger.warn('InitData is too old', {
        authDate: new Date(authDate),
        now: new Date(now),
        ageMs: now - authDate,
      });
      return null;
    }

    return parsed.user || null;

  } catch (error) {
    logger.error('Error validating Telegram initData:', error);
    return null;
  }
}

/**
 * Парсинг строки initData в объект
 */
function parseInitData(initData: string): TelegramInitData | null {
  try {
    const params = new URLSearchParams(initData);
    const result: any = {};

    for (const [key, value] of params.entries()) {
      if (key === 'user') {
        try {
          result[key] = JSON.parse(value);
        } catch {
          logger.warn('Failed to parse user data from initData');
          return null;
        }
      } else if (key === 'auth_date') {
        result[key] = parseInt(value);
      } else {
        result[key] = value;
      }
    }

    if (!result.hash || !result.auth_date) {
      logger.warn('Missing required fields in initData');
      return null;
    }

    return result as TelegramInitData;

  } catch (error) {
    logger.error('Error parsing initData:', error);
    return null;
  }
}

/**
 * Проверка подписи Telegram
 */
function verifyTelegramHash(data: TelegramInitData, botToken: string): boolean {
  try {
    const { hash, ...params } = data;

    // Создаем строку для проверки
    const dataCheckString = Object.keys(params)
      .filter(key => key !== 'hash')
      .sort()
      .map(key => {
        const value = params[key];
        if (typeof value === 'object') {
          return `${key}=${JSON.stringify(value)}`;
        }
        return `${key}=${value}`;
      })
      .join('\n');

    // Создаем ключ для HMAC
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Создаем HMAC подпись
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Сравниваем подписи
    return calculatedHash === hash;

  } catch (error) {
    logger.error('Error verifying Telegram hash:', error);
    return false;
  }
}

/**
 * Генерация тестового initData для разработки
 * ТОЛЬКО ДЛЯ РАЗРАБОТКИ! НЕ ИСПОЛЬЗОВАТЬ В ПРОДАКШЕНЕ!
 */
export function generateTestInitData(userId: number, firstName: string, username?: string): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('generateTestInitData should not be used in production');
  }

  const user = {
    id: userId,
    first_name: firstName,
    username: username,
    language_code: 'ru',
  };

  const authDate = Math.floor(Date.now() / 1000);
  
  const params = {
    user: JSON.stringify(user),
    auth_date: authDate.toString(),
  };

  // Создаем тестовую подпись (в реальности её создает Telegram)
  const dataCheckString = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key as keyof typeof params]}`)
    .join('\n');

  const botToken = process.env.BOT_TOKEN || 'test_token';
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const initData = new URLSearchParams({
    ...params,
    hash,
  }).toString();

  logger.info('Generated test initData', {
    userId,
    firstName,
    username,
    authDate: new Date(authDate * 1000),
  });

  return initData;
}

/**
 * Извлечение данных пользователя из валидированного initData
 */
export function extractUserFromInitData(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    
    if (!userStr) {
      return null;
    }

    return JSON.parse(userStr) as TelegramUser;
  } catch (error) {
    logger.error('Error extracting user from initData:', error);
    return null;
  }
}

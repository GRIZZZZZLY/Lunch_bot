import crypto from 'crypto';
import { logger } from './logger';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
}

const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 5 * 60;
const MAX_CLOCK_SKEW_SECONDS = 30;

function getInitDataMaxAgeSeconds(): number {
  const parsed = Number(
    process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS ??
      DEFAULT_INIT_DATA_MAX_AGE_SECONDS
  );

  return Number.isInteger(parsed) && parsed >= 30 && parsed <= 86400
    ? parsed
    : DEFAULT_INIT_DATA_MAX_AGE_SECONDS;
}

function parseTelegramUser(value: string | null): TelegramUser | null {
  if (!value || value.length > 4096) {
    return null;
  }

  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const raw = parsed as Record<string, unknown>;
  if (
    !Number.isSafeInteger(raw.id) ||
    Number(raw.id) <= 0 ||
    typeof raw.first_name !== 'string' ||
    raw.first_name.trim().length === 0 ||
    raw.first_name.length > 128
  ) {
    return null;
  }

  const optionalString = (
    key: string,
    maxLength: number
  ): string | undefined => {
    const field = raw[key];
    if (field === undefined || field === null) {
      return undefined;
    }
    if (typeof field !== 'string' || field.length > maxLength) {
      throw new Error(`Invalid Telegram user field: ${key}`);
    }
    return field;
  };

  const optionalBoolean = (key: string): boolean | undefined => {
    const field = raw[key];
    if (field === undefined || field === null) {
      return undefined;
    }
    if (typeof field !== 'boolean') {
      throw new Error(`Invalid Telegram user field: ${key}`);
    }
    return field;
  };

  return {
    id: Number(raw.id),
    first_name: raw.first_name.trim(),
    last_name: optionalString('last_name', 128),
    username: optionalString('username', 64),
    photo_url: optionalString('photo_url', 2048),
    language_code: optionalString('language_code', 16),
    is_premium: optionalBoolean('is_premium'),
    allows_write_to_pm: optionalBoolean('allows_write_to_pm'),
  };
}

/**
 * Валидация initData от Telegram WebApp
 * @param initData Строка с данными от Telegram
 * @returns Данные пользователя или null если валидация не прошла
 */
export function validateTelegramInitData(initData: string): TelegramUser | null {
  try {
    logger.info('Validating Telegram initData', {
      initDataLength: initData?.length || 0,
    });

    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
      logger.error('BOT_TOKEN not found in environment variables');
      return null;
    }

    const skipValidation = process.env.SKIP_TELEGRAM_VALIDATION === 'true';

    if (skipValidation) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('SKIP_TELEGRAM_VALIDATION is forbidden in production');
        return null;
      }

      logger.warn('SKIP_TELEGRAM_VALIDATION enabled in development');
      try {
        const skipParams = new URLSearchParams(initData);
        const userStr = skipParams.get('user');
        if (!userStr) {
          logger.warn('No user field in initData (skip mode)');
          return null;
        }
        const user = parseTelegramUser(userStr);

        logger.info('initData parsed (validation skipped)', {
          hasUser: Boolean(user),
        });

        return user;
      } catch (parseError) {
        logger.error('Failed to parse initData even without validation:', parseError);
        return null;
      }
    }

    const params = new URLSearchParams(initData);
    if (!params.has('hash')) {
      logger.error('InitData is missing the hash field');
      return null;
    }

    if (!validateTelegramHmac(initData, botToken)) {
      logger.warn('Telegram initData signature or timestamp is invalid');
      return null;
    }

    const user = parseTelegramUser(params.get('user'));
    logger.info('Telegram initData validated', { hasUser: Boolean(user) });
    return user;
  } catch (error) {
    logger.warn('Telegram initData validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Генерация тестового initData для разработки
 * ТОЛЬКО ДЛЯ РАЗРАБОТКИ! НЕ ИСПОЛЬЗОВАТЬ В ПРОДАКШЕНЕ!
 */
export function generateTestInitData(
  userId: number,
  firstName: string,
  username?: string
): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('generateTestInitData should not be used in production');
  }

  const user = {
    id: userId,
    first_name: firstName,
    username,
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

  logger.info('Generated test initData');

  return initData;
}

/**
 * Извлечение данных пользователя из валидированного initData
 */
export function extractUserFromInitData(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    return parseTelegramUser(params.get('user'));
  } catch (error) {
    logger.error('Error extracting user from initData:', error);
    return null;
  }
}

/**
 * Валидация initData Telegram WebApp (HMAC-SHA256 с полем hash).
 *
 * Алгоритм: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateTelegramHmac(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
      return false;
    }

    const authDateRaw = params.get('auth_date');
    if (!authDateRaw || !/^\d{1,12}$/.test(authDateRaw)) {
      return false;
    }

    const authDate = Number(authDateRaw);
    const now = Math.floor(Date.now() / 1000);
    const age = now - authDate;
    if (
      !Number.isSafeInteger(authDate) ||
      age < -MAX_CLOCK_SKEW_SECONDS ||
      age > getInitDataMaxAgeSeconds()
    ) {
      logger.warn('Telegram initData timestamp is outside the allowed window');
      return false;
    }

    // Строим data-check-string: все поля кроме hash, отсортированные по ключу
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // Вычисляем HMAC
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    const receivedBuffer = Buffer.from(hash, 'hex');
    const isValid =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    if (!isValid) {
      logger.warn('Telegram initData HMAC mismatch');
    }
    return isValid;
  } catch (error) {
    logger.error('Error validating Telegram initData HMAC', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Парсинг initData БЕЗ валидации подписи (только для development!)
 * В dev режиме извлекает реальные данные пользователя из Telegram initData,
 * но пропускает проверку HMAC подписи для удобства разработки.
 * 
 * ⚠️ ВНИМАНИЕ: Использовать ТОЛЬКО в development режиме!
 * В production ВСЕГДА должна использоваться полная валидация.
 * 
 * @throws {Error} Если вызвана в production окружении
 */
export function parseInitDataUnsafe(initData: string): TelegramUser | null {
  if (process.env.NODE_ENV === 'production') {
    logger.error('🚨 parseInitDataUnsafe is not allowed in production');
    throw new Error('parseInitDataUnsafe should not be used in production');
  }

  // ⚠️ SKIP_TELEGRAM_VALIDATION - позволяет использовать parseInitDataUnsafe
  // Извлекает данные пользователя из initData без проверки подписи
  logger.info('parseInitDataUnsafe called', {
    environment: process.env.NODE_ENV,
    skipValidation: process.env.SKIP_TELEGRAM_VALIDATION,
  });

  try {
    logger.info('Parsing initData in UNSAFE mode (dev only)', {
      initDataLength: initData?.length || 0,
    });

    // Пустой или невалидный initData - возвращаем null
    if (!initData || initData.trim().length === 0 || initData === 'mock_jwt_token_12345678') {
      logger.warn('Empty or mock initData - returning null');
      return null;
    }

    const params = new URLSearchParams(initData);
    const userStr = params.get('user');

    logger.info('Parsed initData parameters in unsafe mode', {
      hasUser: !!userStr,
    });

    if (!userStr) {
      logger.warn('No user data in initData');
      return null;
    }

    const user = parseTelegramUser(userStr);

    return user;
  } catch (error) {
    logger.error('Error parsing initData in unsafe mode', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

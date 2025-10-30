import crypto from 'crypto';
import { validate, parse } from '@telegram-apps/init-data-node';
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

/**
 * Валидация initData от Telegram WebApp
 * Использует официальную библиотеку @telegram-apps/init-data-node
 * @param initData Строка с данными от Telegram
 * @returns Данные пользователя или null если валидация не прошла
 */
export function validateTelegramInitData(initData: string): TelegramUser | null {
  try {
    logger.info('🔐 Validating Telegram initData with @telegram-apps/init-data-node', {
      initDataLength: initData?.length || 0,
      initDataPreview: initData?.substring(0, 50) + '...'
    });

    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
      logger.error('BOT_TOKEN not found in environment variables');
      return null;
    }

    // В development режиме с SKIP_TELEGRAM_VALIDATION можем пропустить проверку подписи
    const skipValidation = process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true';

    if (skipValidation) {
      logger.warn('⚠️ SKIP_TELEGRAM_VALIDATION enabled - parsing without validation');
      try {
        const parsed = parse(initData);
        const rawUser = parsed.user as any;

        logger.info('✅ initData parsed (validation skipped)', {
          userId: rawUser?.id,
          username: rawUser?.username,
          firstName: rawUser?.first_name,
        });

        // Библиотека возвращает поля в snake_case (как от Telegram)
        return rawUser ? {
          id: rawUser.id as number,
          first_name: rawUser.first_name as string,
          last_name: rawUser.last_name as string | undefined,
          username: rawUser.username as string | undefined,
          photo_url: rawUser.photo_url as string | undefined,
          language_code: rawUser.language_code as string | undefined,
          is_premium: rawUser.is_premium as boolean | undefined,
          allows_write_to_pm: rawUser.allows_write_to_pm as boolean | undefined,
        } : null;
      } catch (parseError) {
        logger.error('Failed to parse initData even without validation:', parseError);
        return null;
      }
    }

    // ✅ Валидация с помощью официальной библиотеки
    // expiresIn: 86400 секунд = 24 часа (Telegram официальный TTL)
    validate(initData, botToken, { expiresIn: 86400 });

    // Если validate не выбросила ошибку, парсим данные
    const parsed = parse(initData);

    logger.info('✅ Telegram initData validated successfully', {
      userId: parsed.user?.id,
      username: parsed.user?.username,
      firstName: (parsed.user as any)?.first_name,
    });

    // Библиотека возвращает поля в snake_case (как от Telegram), а не camelCase
    // Приводим к нашему формату TelegramUser
    const rawUser = parsed.user as any;
    return rawUser ? {
      id: rawUser.id as number,
      first_name: rawUser.first_name as string,
      last_name: rawUser.last_name as string | undefined,
      username: rawUser.username as string | undefined,
      photo_url: rawUser.photo_url as string | undefined,
      language_code: rawUser.language_code as string | undefined,
      is_premium: rawUser.is_premium as boolean | undefined,
      allows_write_to_pm: rawUser.allows_write_to_pm as boolean | undefined,
    } : null;

  } catch (error) {
    logger.error('❌ Error validating Telegram initData:', error);
    return null;
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
  // CRITICAL: Блокировать в production на уровне процесса
  if (process.env.NODE_ENV === 'production') {
    const error = new Error(
      'SECURITY ERROR: parseInitDataUnsafe MUST NOT be used in production! ' +
      'This function bypasses cryptographic signature validation and poses a critical security risk.'
    );
    logger.error('🚨 CRITICAL SECURITY VIOLATION:', {
      function: 'parseInitDataUnsafe',
      environment: process.env.NODE_ENV,
      stack: error.stack,
    });
    throw error; // Выбрасываем исключение вместо возврата null
  }

  try {
    logger.info('🔓 Parsing initData in UNSAFE mode (dev only)', {
      initDataLength: initData?.length || 0,
      initDataPreview: initData?.substring(0, 100),
      looksLikeJWT: initData?.startsWith('eyJ'),
    });

    // Пустой или невалидный initData - возвращаем null
    if (!initData || initData.trim().length === 0 || initData === 'mock_jwt_token_12345678') {
      logger.warn('⚠️ Empty or mock initData - returning null');
      return null;
    }

    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    
    logger.info('🔍 DEBUG: Parsed URLSearchParams', {
      hasUser: !!userStr,
      allKeys: Array.from(params.keys()),
      userStrPreview: userStr?.substring(0, 50),
    });
    
    if (!userStr) {
      logger.warn('⚠️ No user data in initData');
      return null;
    }

    const user = JSON.parse(userStr) as TelegramUser;
    
    logger.info('✅ Extracted user from initData (UNSAFE mode)', {
      userId: user.id,
      username: user.username,
      firstName: user.first_name,
    });

    return user;
  } catch (error) {
    logger.error('❌ Error parsing initData in unsafe mode:', error);
    return null;
  }
}

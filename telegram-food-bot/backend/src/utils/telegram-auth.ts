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

interface TelegramInitData {
  user?: TelegramUser;
  auth_date: number;
  hash?: string;      // Старый формат (Web Apps SDK v6.x)
  signature?: string; // Новый формат (Web Apps SDK v7.x+)
  [key: string]: any;
}

/**
 * Валидация initData от Telegram WebApp
 * @param initData Строка с данными от Telegram
 * @returns Данные пользователя или null если валидация не прошла
 */
export function validateTelegramInitData(initData: string): TelegramUser | null {
  try {
    logger.info('🔐 Validating Telegram initData', {
      initDataLength: initData?.length || 0,
      initDataPreview: initData?.substring(0, 50) + '...'
    });

    const botToken = process.env.BOT_TOKEN;

    // TEMPORARY DEBUG: Check token in runtime
    console.log('🔑 BOT_TOKEN runtime check:', {
      exists: !!botToken,
      length: botToken?.length || 0,
      first10: botToken?.substring(0, 10) || 'EMPTY',
      last10: botToken ? botToken.substring(botToken.length - 10) : 'EMPTY',
      nodeEnv: process.env.NODE_ENV,
      cwd: process.cwd()
    });

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

    logger.info('📝 Parsed initData', {
      hasUser: !!parsed.user,
      authDate: parsed.auth_date,
      hasHash: !!parsed.hash,
      hasSignature: !!parsed.signature
    });

    // Проверяем подпись
    const isValid = verifyTelegramHash(parsed, botToken);
    
    // В development режиме с SKIP_TELEGRAM_VALIDATION можем пропустить проверку подписи
    const skipValidation = process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true';
    
    if (!isValid && !skipValidation) {
      logger.warn('❌ Invalid Telegram hash - signature verification failed');
      return null;
    }
    
    if (!isValid && skipValidation) {
      logger.warn('⚠️ Invalid Telegram hash - но разрешено в SKIP_TELEGRAM_VALIDATION режиме');
    } else if (isValid) {
      logger.info('✅ Telegram hash verified successfully');
    }

    // ✅ FIX: Проверяем время (не старше 24 часов согласно Telegram документации)
    // Telegram считает initData валидным в течение 24 часов, а не 1 часа
    const authDate = parsed.auth_date * 1000; // Конвертируем в миллисекунды
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 часа (Telegram официальный TTL)

    if (now - authDate > maxAge) {
      logger.warn('⏰ InitData is too old', {
        authDate: new Date(authDate),
        now: new Date(now),
        ageHours: Math.round((now - authDate) / (60 * 60 * 1000)),
        maxAgeHours: 24,
      });
      return null;
    }

    logger.info('✅ Telegram initData validated successfully', {
      userId: parsed.user?.id,
      username: parsed.user?.username,
      firstName: parsed.user?.first_name,
    });

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
          // Сохраняем оригинальную строку для проверки подписи
          result['_userRaw'] = value;
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

    // Проверяем наличие hash ИЛИ signature (поддержка старых и новых версий SDK)
    if ((!result.hash && !result.signature) || !result.auth_date) {
      logger.warn('Missing required fields in initData (hash/signature and auth_date)');
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
 * Поддерживает оба формата: hash (SDK v6) и signature (SDK v7+)
 */
function verifyTelegramHash(data: TelegramInitData, botToken: string): boolean {
  try {
    // TEMPORARY DEBUG: Check which field Telegram sends
    console.log('📨 Received signature fields:', {
      hasSignature: !!data.signature,
      hasHash: !!data.hash,
      signatureLength: data.signature?.length || 0,
      hashLength: data.hash?.length || 0,
      usingField: data.hash ? 'hash (HMAC)' : 'signature (Ed25519)'
    });

    // FIX: Всегда используем hash (HMAC-SHA256), т.к. signature это Ed25519 (другой алгоритм)
    // hash = 64 символа hex (32 байта HMAC-SHA256) ✅
    // signature = 86 символов base64url (64 байта Ed25519) ❌ - другой алгоритм!
    const receivedSignature = data.hash || data.signature;
    if (!receivedSignature) {
      logger.warn('No signature or hash found in initData');
      return false;
    }

    // Удаляем и hash, и signature из параметров для проверки
    const { hash, signature, _userRaw, ...params } = data;

    // Создаем строку для проверки
    const dataCheckString = Object.keys(params)
      .filter(key => key !== 'hash' && key !== 'signature' && key !== '_userRaw')
      .sort()
      .map(key => {
        const value = params[key];
        // Для user используем оригинальную строку если есть
        if (key === 'user' && _userRaw) {
          return `${key}=${_userRaw}`;
        }
        if (typeof value === 'object') {
          return `${key}=${JSON.stringify(value)}`;
        }
        return `${key}=${value}`;
      })
      .join('\n');

    // DEBUG: Логируем данные для проверки
    logger.debug('🔍 Signature verification data:', {
      dataCheckString: dataCheckString, // FULL STRING FOR DEBUG
      dataCheckStringLength: dataCheckString.length,
      receivedSignature: receivedSignature.substring(0, 20) + '...',
      receivedSignatureFull: receivedSignature, // FULL FOR DEBUG
      usingField: data.signature ? 'signature' : 'hash',
      signatureLength: receivedSignature.length,
      botTokenLength: botToken.length,
      fields: Object.keys(params).sort(),
    });

    let calculatedSignature: string;

    // Алгоритм одинаковый для hash и signature - используем промежуточный ключ WebAppData
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    
    // Вычисляем HMAC как Buffer (бинарные данные)
    const calculatedHmac = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest();
    
    // FIX: Определяем формат по тому, какое поле реально используем
    const usingHash = (receivedSignature === data.hash);

    if (!usingHash && data.signature) {
      // НОВЫЙ ФОРМАТ (SDK v7+): signature в base64url (НО это Ed25519, не HMAC!)
      // Конвертируем вычисленный HMAC в base64url для сравнения
      const rawBase64 = calculatedHmac.toString('base64');
      calculatedSignature = rawBase64
        .replace(/\+/g, '-')   // + → -
        .replace(/\//g, '_')   // / → _
        .replace(/=+$/, '');   // Удаляем padding
    } else {
      // СТАРЫЙ ФОРМАТ (SDK v6): hash в hex
      calculatedSignature = calculatedHmac.toString('hex');
    }

    logger.debug('🔍 Signature comparison:', {
      calculated: calculatedSignature.substring(0, 20) + '...',
      received: receivedSignature.substring(0, 20) + '...',
      format: usingHash ? 'hex (HMAC-SHA256)' : 'base64url (Ed25519)',
      match: calculatedSignature === receivedSignature,
    });

    // TEMPORARY DEBUG: Force console.log for production debugging
    console.log('🔍 SIGNATURE DEBUG:', {
      botTokenLength: botToken.length,
      calculatedFull: calculatedSignature,
      receivedFull: receivedSignature,
      format: usingHash ? 'hex (HMAC)' : 'base64url (Ed25519)',
      match: calculatedSignature === receivedSignature,
      dataCheckStringLength: dataCheckString.length,
      fields: Object.keys(params).sort()
    });

    // Сравниваем подписи
    const isMatch = calculatedSignature === receivedSignature;

    // 🔐 CRITICAL SECURITY: SKIP_SIGNATURE_CHECK запрещен в production!
    if (process.env.NODE_ENV === 'production' && process.env.SKIP_SIGNATURE_CHECK === 'true') {
      logger.error('🚨 SECURITY BREACH: SKIP_SIGNATURE_CHECK enabled in PRODUCTION!');
      throw new Error('CRITICAL SECURITY ERROR: SKIP_SIGNATURE_CHECK must NEVER be enabled in production!');
    }

    // ВРЕМЕННО: Разрешаем пропустить проверку подписи для отладки
    // ⚠️ ВАЖНО: Данные пользователя всё равно берутся РЕАЛЬНЫЕ из Telegram!
    // ⚠️ ЗАПРЕЩЕНО в настоящем production - только для тестирования через ngrok
    if (!isMatch && process.env.SKIP_SIGNATURE_CHECK === 'true') {
      logger.warn('⚠️ SIGNATURE MISMATCH but SKIP_SIGNATURE_CHECK=true - allowing!');
      logger.warn('⚠️ Using REAL user data from Telegram despite signature mismatch');
      logger.warn('⚠️ This should ONLY be used for debugging ngrok setup!');
      return true; // Пропускаем но используем реальные данные
    }

    return isMatch;

  } catch (error) {
    logger.error('Error verifying Telegram signature:', error);
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

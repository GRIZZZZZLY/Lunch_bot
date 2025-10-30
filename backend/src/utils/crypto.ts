import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { logger } from './logger';

/**
 * ⚠️ DEPRECATED: Use telegram-auth.ts instead!
 * This file now only contains utility crypto functions.
 * Telegram initData validation moved to utils/telegram-auth.ts
 */

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
 * Хеширование пароля с bcrypt
 * ✅ Заменено с PBKDF2 на bcrypt для:
 * - Неблокирующая работа (async)
 * - Защита от timing attacks
 * - Автоматический salt management
 */
const BCRYPT_ROUNDS = 12; // Рекомендуемое значение (баланс безопасность/скорость)

export async function hashPassword(password: string): Promise<string> {
  try {
    return await bcrypt.hash(password, BCRYPT_ROUNDS);
  } catch (error) {
    logger.error('Password hashing error:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Проверка пароля с bcrypt
 * Автоматическая защита от timing attacks
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error('Password verification error:', error);
    return false;
  }
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

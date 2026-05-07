/**
 * JWT Service - Безопасная генерация и валидация токенов
 * 
 * Заменяет небезопасный base64 на настоящий JWT с подписью
 * 
 * SECURITY FEATURES:
 * - HMAC SHA256 подпись
 * - Token expiration (7 дней)
 * - Refresh token support
 * - Безопасное хранение в payload
 */

import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

/**
 * JWT Payload структура
 */
export interface JwtPayload {
  userId: number;
  telegramId: string;
  username?: string;
  isAdmin: boolean;
  type: 'access' | 'refresh';
}

/**
 * JWT Configuration
 */
const JWT_SECRET = process.env.JWT_SECRET?.trim() || '';
const JWT_EXPIRATION = '1h'; // Access token - 1 час (короткое окно при XSS/leak)
const JWT_REFRESH_EXPIRATION = '30d'; // Refresh token - 30 дней (frontend renews via /auth/refresh)

if (!JWT_SECRET) {
  logger.error('🚨 CRITICAL SECURITY ERROR: JWT_SECRET is not configured');
  throw new Error('CRITICAL: JWT_SECRET is required');
}

// 🔐 SECURITY: В production требуем сильный секрет (>=64 символов).
// Слабый секрет позволяет brute-force подделку токенов.
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && JWT_SECRET.length < 64) {
  logger.error(`🚨 CRITICAL: JWT_SECRET too weak in production (${JWT_SECRET.length} chars, need >=64)`);
  throw new Error('CRITICAL: JWT_SECRET must be >=64 characters in production');
}
if (!isProduction && JWT_SECRET.length < 32) {
  logger.warn('⚠️ WARNING: JWT_SECRET is too short! Recommended: 64+ characters');
}

/**
 * Генерация Access Token
 * 
 * @param payload - Данные для токена
 * @returns JWT токен (валиден 7 дней)
 */
export function generateAccessToken(payload: Omit<JwtPayload, 'type'>): string {
  try {
    const tokenPayload: JwtPayload = {
      ...payload,
      type: 'access',
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRATION,
      algorithm: 'HS256',
    });

    logger.debug('🔐 Access token generated', {
      userId: payload.userId,
      telegramId: payload.telegramId,
      expiresIn: JWT_EXPIRATION,
    });

    return token;
  } catch (error) {
    logger.error('Failed to generate access token', error);
    throw new Error('Token generation failed');
  }
}

/**
 * Генерация Refresh Token
 * 
 * @param payload - Данные для токена
 * @returns JWT refresh токен (валиден 30 дней)
 */
export function generateRefreshToken(payload: Omit<JwtPayload, 'type'>): string {
  try {
    const tokenPayload: JwtPayload = {
      ...payload,
      type: 'refresh',
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRATION,
      algorithm: 'HS256',
    });

    logger.debug('🔐 Refresh token generated', {
      userId: payload.userId,
      expiresIn: JWT_REFRESH_EXPIRATION,
    });

    return token;
  } catch (error) {
    logger.error('Failed to generate refresh token', error);
    throw new Error('Refresh token generation failed');
  }
}

/**
 * Валидация и декодирование токена
 * 
 * @param token - JWT токен
 * @returns Payload или null если невалиден
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as JwtPayload;

    logger.debug('✅ Token verified successfully', {
      userId: decoded.userId,
      type: decoded.type,
    });

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('⏰ Token expired', {
        expiredAt: error.expiredAt,
      });
      return null;
    }

    if (error.name === 'JsonWebTokenError') {
      logger.warn('❌ Invalid token signature', {
        message: error.message,
      });
      return null;
    }

    logger.error('Token verification error', error);
    return null;
  }
}

/**
 * Декодирование токена БЕЗ валидации (для debugging)
 * ⚠️ НЕ ИСПОЛЬЗОВАТЬ для проверки подлинности!
 * 
 * @param token - JWT токен
 * @returns Payload (может быть подделан!)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.decode(token) as JwtPayload;
    return decoded;
  } catch (error) {
    logger.error('Token decode error', error);
    return null;
  }
}

/**
 * Проверка что токен скоро истечет
 * 
 * @param token - JWT токен
 * @returns true если истекает через < 24 часа
 */
export function isTokenExpiringSoon(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as any;
    
    if (!decoded || !decoded.exp) {
      return false;
    }

    const expiresAt = decoded.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);

    return hoursUntilExpiry < 24;
  } catch (error) {
    return false;
  }
}

/**
 * Получение времени истечения токена
 * 
 * @param token - JWT токен
 * @returns Date или null
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as any;
    
    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  } catch (error) {
    return null;
  }
}

/**
 * Создание пары токенов (access + refresh)
 * 
 * @param payload - Данные для токенов
 * @returns { accessToken, refreshToken }
 */
export function generateTokenPair(payload: Omit<JwtPayload, 'type'>): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

/**
 * 🔐 SECURITY: Валидация что это access токен (не refresh)
 */
export function isAccessToken(token: string): boolean {
  const payload = verifyToken(token);
  return payload?.type === 'access';
}

/**
 * 🔐 SECURITY: Валидация что это refresh токен (не access)
 */
export function isRefreshToken(token: string): boolean {
  const payload = verifyToken(token);
  return payload?.type === 'refresh';
}

// Export для удобства
export const JwtService = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyToken,
  decodeToken,
  isTokenExpiringSoon,
  getTokenExpiration,
  isAccessToken,
  isRefreshToken,
};

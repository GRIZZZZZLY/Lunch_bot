import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types/api.types';
import { extractAuthHeader } from '../../utils/crypto';
import { validateTelegramInitData } from '../../utils/telegram-auth';
import { UserService } from '../../services/user.service';
import { botConfig } from '../../config/bot.config';
import { logger } from '../../utils/logger';
import { AuthenticationError } from '../../utils/error';

const userService = new UserService();

/**
 * Middleware для валидации Telegram WebApp initData
 */
export async function validateInitDataMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
      if (
        process.env.NODE_ENV === 'production' &&
        process.env.ALLOW_SKIP_VALIDATION_IN_PROD !== 'true'
      ) {
        logger.error('🚨 SKIP_TELEGRAM_VALIDATION blocked in production');
        throw new Error(
          'SECURITY: SKIP_TELEGRAM_VALIDATION cannot be used in production'
        );
      }

      logger.warn('⚠️  SKIP_TELEGRAM_VALIDATION active - signature validation disabled');

      if (!authHeader) {
        throw new AuthenticationError(
          'Telegram authentication required. Open the app via Telegram.'
        );
      }

      const initData = extractAuthHeader(authHeader);
      if (!initData) {
        throw new AuthenticationError('Неверный формат заголовка Authorization');
      }

      let telegramUser = validateTelegramInitData(initData);
      if (!telegramUser) {
        const { parseInitDataUnsafe } = await import('../../utils/telegram-auth');
        const unsafeUser = parseInitDataUnsafe(initData);
        if (!unsafeUser?.id) {
          throw new AuthenticationError(
            'Cannot extract Telegram user from initData (SKIP mode requires real initData)'
          );
        }
        telegramUser = unsafeUser;
      }

      const dbUser = await userService.createOrUpdate({
        telegramId: telegramUser.id.toString(),
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
      });

      req.user = dbUser;
      req.telegramInitData = { user: telegramUser };

      logger.info('✅ SKIP mode: authenticated with REAL Telegram ID', {
        userId: dbUser.id,
        telegramId: dbUser.telegramId.toString(),
      });

      return next();
    }

    if (!authHeader) {
      throw new AuthenticationError('Отсутствует заголовок Authorization');
    }

    const initData = extractAuthHeader(authHeader);
    
    if (!initData) {
      throw new AuthenticationError('Неверный формат заголовка Authorization');
    }

    // Валидируем initData
    const telegramUser = validateTelegramInitData(initData);

    if (!telegramUser) {
      throw new AuthenticationError('Невалидные данные Telegram');
    }

    // Создаем или обновляем пользователя в БД
    const dbUser = await userService.createOrUpdate({
      telegramId: telegramUser.id.toString(),
      username: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
    });

    // Добавляем данные в request
    req.user = dbUser;
    req.telegramInitData = { user: telegramUser };

    logger.debug('API пользователь аутентифицирован', {
      userId: dbUser.id,
      telegramId: dbUser.telegramId.toString(),
      username: dbUser.username,
    });

    next();
  } catch (error) {
    logger.error('Ошибка валидации initData:', error);
    
    if (error instanceof AuthenticationError) {
      res.status(401).json({
        success: false,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

/**
 * Middleware для проверки прав администратора через API
 */
export async function requireAdminMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AuthenticationError('Пользователь не аутентифицирован');
    }

    const telegramId = req.user?.telegramId;
    if (!telegramId) {
      res.status(401).json({
        success: false,
        error: 'Telegram ID not found',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    const isAdmin = await userService.isAdmin(BigInt(telegramId));
    
    if (!isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Недостаточно прав доступа',
        code: 'INSUFFICIENT_PERMISSIONS',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.debug('API администратор подтвержден', {
      userId: req.user.id,
      telegramId: req.user.telegramId?.toString(),
    });

    next();
  } catch (error) {
    logger.error('Ошибка проверки прав администратора:', error);
    
    res.status(403).json({
      success: false,
      error: 'Ошибка проверки прав доступа',
      code: 'AUTHORIZATION_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Опциональная аутентификация - не выбрасывает ошибку если не авторизован
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      next();
      return;
    }

    const initData = extractAuthHeader(authHeader);
    
    if (!initData) {
      next();
      return;
    }

    const telegramUser = validateTelegramInitData(initData);

    if (telegramUser) {
      const dbUser = await userService.createOrUpdate({
        telegramId: telegramUser.id.toString(),
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
      });

      req.user = dbUser;
      req.telegramInitData = { user: telegramUser };
    }

    next();
  } catch (error) {
    logger.error('Ошибка в опциональной аутентификации:', error);
    next(); // Продолжаем даже при ошибке
  }
}

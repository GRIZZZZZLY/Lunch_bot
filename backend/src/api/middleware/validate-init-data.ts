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
    
    // В development режиме можно пропустить валидацию ПОЛНОСТЬЮ
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
      // Если нет заголовка авторизации вообще - создаём тестового пользователя
      if (!authHeader) {
        logger.warn('⚠️  SKIP_TELEGRAM_VALIDATION: No auth header - using test user');
        
        const testUserId = process.env.TEST_USER_ID || '123456789';
        const dbUser = await userService.createOrUpdate({
          telegramId: BigInt(testUserId).toString(),
          username: 'dev_user',
          firstName: 'Dev',
          lastName: 'User',
        });
        
        req.user = dbUser;
        req.telegramInitData = {
          user: {
            id: Number(testUserId),
            first_name: 'Dev',
            last_name: 'User',
            username: 'dev_user',
          },
        } as any;
        
        logger.info('✅ Dev user authenticated via SKIP_TELEGRAM_VALIDATION (no auth header)', {
          userId: dbUser.id,
          telegramId: testUserId
        });
        
        return next();
      }
      
      // Если заголовок есть - пробуем распарсить, но не валидируем хэш
      logger.warn('⚠️  SKIP_TELEGRAM_VALIDATION активен - валидация отключена!');
      logger.debug('Request from:', {
        origin: req.headers.origin,
        userAgent: req.headers['user-agent'],
        authorization: 'present'
      });
      
      const initData = extractAuthHeader(authHeader);
      
      if (initData) {
        // Пробуем распарсить данные (без проверки хэша)
        const telegramUser = validateTelegramInitData(initData);

        if (telegramUser) {
          // Используем реальные данные Telegram если есть
          const dbUser = await userService.createOrUpdate({
            telegramId: telegramUser.id.toString(),
            username: telegramUser.username,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
          });

          req.user = dbUser;
          req.telegramInitData = { user: telegramUser };

          logger.info('✅ Real Telegram user (validation skipped)', {
            userId: dbUser.id,
            telegramId: dbUser.telegramId.toString(),
            username: dbUser.username
          });

          return next();
        }
      }
      
      // Если не смогли распарсить - используем тестового пользователя
      const testUserId = process.env.TEST_USER_ID || '123456789';
      const dbUser = await userService.createOrUpdate({
        telegramId: BigInt(testUserId).toString(),
        username: 'dev_user',
        firstName: 'Dev',
        lastName: 'User',
      });
      
      req.user = dbUser;
      req.telegramInitData = {
        user: {
          id: Number(testUserId),
          first_name: 'Dev',
          last_name: 'User',
          username: 'dev_user',
        },
      } as any;
      
      logger.info('✅ Dev user authenticated via SKIP_TELEGRAM_VALIDATION (fallback)', {
        userId: dbUser.id,
        telegramId: testUserId
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

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types/api.types';
import { validateTelegramInitData, extractAuthHeader } from '../../utils/crypto';
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
    
    if (!authHeader) {
      throw new AuthenticationError('Отсутствует заголовок Authorization');
    }

    const initData = extractAuthHeader(authHeader);
    
    if (!initData) {
      throw new AuthenticationError('Неверный формат заголовка Authorization');
    }

    // Валидируем initData
    const validation = validateTelegramInitData(initData, botConfig.token);
    
    if (!validation.isValid || !validation.data) {
      throw new AuthenticationError('Невалидные данные Telegram');
    }

    const { user: telegramUser } = validation.data;
    
    if (!telegramUser) {
      throw new AuthenticationError('Отсутствуют данные пользователя');
    }

    // Создаем или обновляем пользователя в БД
    const dbUser = await userService.createOrUpdate({
      telegramId: telegramUser.id,
      username: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
    });

    // Добавляем данные в request
    req.user = dbUser;
    req.telegramInitData = validation.data;

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

    const isAdmin = await userService.isAdmin(BigInt(req.user.telegramId));
    
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
      telegramId: req.user.telegramId.toString(),
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

    const validation = validateTelegramInitData(initData, botConfig.token);
    
    if (validation.isValid && validation.data?.user) {
      const dbUser = await userService.createOrUpdate({
        telegramId: validation.data.user.id,
        username: validation.data.user.username,
        firstName: validation.data.user.first_name,
        lastName: validation.data.user.last_name,
      });

      req.user = dbUser;
      req.telegramInitData = validation.data;
    }

    next();
  } catch (error) {
    logger.error('Ошибка в опциональной аутентификации:', error);
    next(); // Продолжаем даже при ошибке
  }
}

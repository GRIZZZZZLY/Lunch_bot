import { Request, Response, NextFunction } from 'express';
import { UserService } from '../../services/user.service';
import { validateTelegramInitData } from '../../utils/telegram-auth';
import { logger } from '../../utils/logger';

/**
 * Middleware для аутентификации через Telegram WebApp
 */
export async function telegramAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Получаем токен из заголовка Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
        code: 'MISSING_TOKEN'
      });
      return;
    }

    const token = authHeader.substring(7); // Убираем 'Bearer '

    // В упрощенной версии токен - это закодированный initData
    let userData;
    try {
      // Декодируем токен (в реальности это будет JWT)
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
      // Проверяем пользователя в БД
      const user = await UserService.getUserById(decoded.userId);
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: 'User not found or inactive',
          code: 'USER_NOT_ACTIVE'
        });
        return;
      }

      userData = user;
    } catch {
      // Если это не наш токен, пробуем как initData
      userData = validateTelegramInitData(token);
      if (!userData) {
        res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
        return;
      }

      // Получаем пользователя из БД
      const dbUser = await UserService.getUserByTelegramId(BigInt(userData.id));
      if (!dbUser || !dbUser.isActive) {
        res.status(401).json({
          success: false,
          error: 'User not found or inactive',
          code: 'USER_NOT_ACTIVE'
        });
        return;
      }

      userData = dbUser;
    }

    // Добавляем пользователя в request
    (req as any).user = userData;
    next();

  } catch (error) {
    logger.error('Telegram auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Middleware для проверки админских прав
 */
export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    if (!user.isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'ACCESS_DENIED'
      });
      return;
    }

    next();

  } catch (error) {
    logger.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Middleware для валидации Telegram initData в теле запроса
 */
export async function validateInitDataMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { initData } = req.body;

    if (!initData) {
      res.status(400).json({
        success: false,
        error: 'Missing initData in request body',
        code: 'MISSING_INIT_DATA'
      });
      return;
    }

    const userData = validateTelegramInitData(initData);
    if (!userData) {
      res.status(400).json({
        success: false,
        error: 'Invalid initData',
        code: 'INVALID_INIT_DATA'
      });
      return;
    }

    // Добавляем данные пользователя в request
    (req as any).telegramUser = userData;
    next();

  } catch (error) {
    logger.error('InitData validation middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Опциональная аутентификация - не требует токена, но проверяет если он есть
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Токена нет - продолжаем без авторизации
      next();
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      const user = await UserService.getUserById(decoded.userId);
      
      if (user && user.isActive) {
        (req as any).user = user;
      }
    } catch {
      // Игнорируем ошибки токена в опциональной авторизации
    }

    next();

  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next(); // Продолжаем выполнение даже при ошибке
  }
}

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

/**
 * Middleware для проверки админ-прав
 * Должен использоваться ПОСЛЕ telegramAuthMiddleware
 */
export const adminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = (req as any).user;

  if (!user) {
    logger.warn('[AdminAuth] User not found in request');
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  if (!user.isAdmin) {
    logger.warn(`[AdminAuth] Access denied for user ${user.telegramId} - not an admin`);
    res.status(403).json({
      success: false,
      error: 'Требуются права администратора',
      code: 'FORBIDDEN',
    });
    return;
  }

  logger.info(`[AdminAuth] Admin access granted for user ${user.telegramId}`);
  next();
};

import { Request, Response } from 'express';
import { UserService } from '../../services/user.service';
import { validateTelegramInitData } from '../../utils/telegram-auth';
import { logger } from '../../utils/logger';

export class AuthController {
  /**
   * POST /api/auth/validate
   * Валидация initData от Telegram WebApp
   */
  static async validateInitData(req: Request, res: Response): Promise<void> {
    try {
      const { initData } = req.body;

      // В development режиме с SKIP_TELEGRAM_VALIDATION - создаём test user
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
        if (!initData || initData.trim().length === 0 || initData === 'mock_jwt_token_12345678') {
          logger.warn('⚠️  SKIP_TELEGRAM_VALIDATION: Empty initData - creating test user');
          
          const testUserId = process.env.TEST_USER_ID || '123456789';
          const user = await UserService.upsertUser({
            telegramId: testUserId,
            username: 'dev_user',
            firstName: 'Dev',
            lastName: 'User',
          });

          logger.info('✅ Test user created via SKIP_TELEGRAM_VALIDATION', {
            userId: user.id,
            telegramId: testUserId
          });

          res.json({
            success: true,
            user: {
              id: typeof user.id === 'bigint' ? Number(user.id) : user.id,
              telegramId: typeof user.telegramId === 'bigint' ? user.telegramId.toString() : user.telegramId,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              isAdmin: user.isAdmin,
              isActive: user.isActive,
              createdAt: user.createdAt,
            },
            token: generateJWT(user),
          });
          return;
        }
      }

      if (!initData) {
        res.status(400).json({
          success: false,
          error: 'Missing initData',
          code: 'INVALID_REQUEST'
        });
        return;
      }

      // Валидируем initData от Telegram
      const userData = validateTelegramInitData(initData);
      if (!userData) {
        res.status(401).json({
          success: false,
          error: 'Invalid initData',
          code: 'INVALID_INIT_DATA'
        });
        return;
      }

      // Создаем или обновляем пользователя в БД
      const user = await UserService.upsertUser({
        telegramId: userData.id.toString(),
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
      });

      logger.info('User validated via initData', {
        userId: user.id,
        telegramId: userData.id.toString(),
        username: userData.username
      });

      res.json({
        success: true,
        user: {
          id: typeof user.id === 'bigint' ? Number(user.id) : user.id,
          telegramId: typeof user.telegramId === 'bigint' ? user.telegramId.toString() : user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        token: generateJWT(user),
      });

    } catch (error) {
      logger.error('Error validating initData:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/auth/me
   * Получение информации о текущем пользователе
   */
  static async getCurrentUser(req: Request, res: Response): Promise<void> {
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

      res.json({
        success: true,
        data: {
          id: typeof user.id === 'bigint' ? Number(user.id) : user.id,
          telegramId: typeof user.telegramId === 'bigint' ? user.telegramId.toString() : user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }
      });

    } catch (error) {
      logger.error('Error getting current user:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/auth/status
   * Проверка статуса авторизации
   */
  static async getAuthStatus(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      res.json({
        success: true,
        authenticated: !!user,
        user: user ? {
          id: typeof user.id === 'bigint' ? Number(user.id) : user.id,
          telegramId: typeof user.telegramId === 'bigint' ? user.telegramId.toString() : user.telegramId,
          firstName: user.firstName,
          isAdmin: user.isAdmin,
          isActive: user.isActive,
        } : null,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error checking auth status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * POST /api/auth/refresh
   * Обновление токена авторизации
   */
  static async refreshAuth(req: Request, res: Response): Promise<void> {
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

      // Получаем актуальную информацию пользователя из БД
      const freshUser = await UserService.getUserById(user.id);
      if (!freshUser || !freshUser.isActive) {
        res.status(401).json({
          success: false,
          error: 'User not found or inactive',
          code: 'USER_NOT_ACTIVE'
        });
        return;
      }

      res.json({
        success: true,
        user: {
          id: typeof freshUser.id === 'bigint' ? Number(freshUser.id) : freshUser.id,
          telegramId: typeof freshUser.telegramId === 'bigint' ? freshUser.telegramId.toString() : freshUser.telegramId,
          username: freshUser.username,
          firstName: freshUser.firstName,
          lastName: freshUser.lastName,
          isAdmin: freshUser.isAdmin,
          isActive: freshUser.isActive,
          updatedAt: freshUser.updatedAt,
        },
        token: generateJWT(freshUser),
      });

    } catch (error) {
      logger.error('Error refreshing auth:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

/**
 * Генерация JWT токена (упрощенная версия)
 * В продакшене следует использовать полноценную JWT библиотеку
 */
function generateJWT(user: any): string {
  // Упрощенная версия токена для демонстрации
  const payload = {
    userId: typeof user.id === 'bigint' ? Number(user.id) : user.id,
    telegramId: typeof user.telegramId === 'bigint' ? user.telegramId.toString() : user.telegramId,
    isAdmin: user.isAdmin,
    timestamp: Date.now(),
  };
  
  // В реальном проекте использовать jsonwebtoken
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export const authController = AuthController;

import { Request, Response } from 'express';
import { UserService } from '../../services/user.service';
import { validateTelegramInitData } from '../../utils/telegram-auth';
import { logger } from '../../utils/logger';
import { JwtService } from '../../services/jwt.service';

export class AuthController {
  /**
   * POST /api/auth/validate
   * Валидация initData от Telegram WebApp
   */
  static async validateInitData(req: Request, res: Response): Promise<void> {
    try {
      const { initData } = req.body;

      // В development режиме с SKIP_TELEGRAM_VALIDATION - пропускаем проверку подписи,
      // но используем РЕАЛЬНЫЙ ID пользователя из initData для конфиденциальности
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
        logger.info('🔓 SKIP_TELEGRAM_VALIDATION: extracting REAL user from initData');
        
        // Пробуем извлечь реальные данные пользователя
        if (initData && initData.trim().length > 0 && initData !== 'mock_jwt_token_12345678') {
          const { parseInitDataUnsafe } = await import('../../utils/telegram-auth');
          const telegramUser = parseInitDataUnsafe(initData);
          
          if (telegramUser) {
            // Создаём/обновляем пользователя с РЕАЛЬНЫМ ID из Telegram
            const user = await UserService.upsertUser({
              telegramId: telegramUser.id.toString(),
              username: telegramUser.username || `user_${telegramUser.id}`,
              firstName: telegramUser.first_name,
              lastName: telegramUser.last_name,
              photoUrl: telegramUser.photo_url,
            });

            logger.info('✅ SKIP mode: authenticated with REAL Telegram user', {
              userId: user.id,
              telegramId: telegramUser.id,
              username: telegramUser.username
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
              ...generateJWT(user),
            });
            return;
          }
        }
        
        // Fallback: используем TEST_USER_ID только если нет реальных данных
        logger.warn('⚠️ SKIP_TELEGRAM_VALIDATION: No real initData - using TEST_USER_ID fallback');
        const testUserId = process.env.TEST_USER_ID || '123456789';
        const user = await UserService.upsertUser({
          telegramId: testUserId,
          username: 'dev_user',
          firstName: 'Dev',
          lastName: 'User',
        });

        logger.info('✅ SKIP mode: fallback test user', {
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
          ...generateJWT(user),
        });
        return;
      }

      // В production режиме initData обязателен
      if (!initData) {
        logger.warn('❌ No initData provided');
        res.status(400).json({
          success: false,
          error: 'Missing initData',
          code: 'INVALID_REQUEST'
        });
        return;
      }

      logger.info('🔐 Validating initData...', {
        initDataLength: initData.length,
        nodeEnv: process.env.NODE_ENV,
      });

      // Валидируем initData от Telegram
      const userData = validateTelegramInitData(initData);
      if (!userData) {
        logger.error('❌ InitData validation failed');
        res.status(401).json({
          success: false,
          error: 'Invalid initData',
          code: 'INVALID_INIT_DATA'
        });
        return;
      }

      logger.info('✅ InitData validated successfully', {
        userId: userData.id,
        username: userData.username,
      });

      // Создаем или обновляем пользователя в БД
      const user = await UserService.upsertUser({
        telegramId: userData.id.toString(),
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        photoUrl: userData.photo_url,
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
          photoUrl: user.photoUrl,
          isAdmin: user.isAdmin,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        ...generateJWT(user),
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
        ...generateJWT(freshUser),
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
 * 🔐 Генерация пары токенов (access + refresh)
 * ✅ FIX: Возвращаем ОБА токена для правильной работы refresh механизма
 */
function generateJWT(user: any): { accessToken: string; refreshToken: string; expiresIn: number } {
  const payload = {
    userId: typeof user.id === 'bigint' ? Number(user.id) : user.id,
    telegramId: typeof user.telegramId === 'bigint' ? user.telegramId.toString() : user.telegramId,
    username: user.username,
    isAdmin: user.isAdmin,
  };
  
  // ✅ Генерируем ОБА токена: access (1 час) и refresh (7 дней)
  const tokens = JwtService.generateTokenPair(payload);
  return {
    ...tokens,
    expiresIn: 3600, // 1 час в секундах
  };
}

export const authController = AuthController;

import { Request, Response } from 'express';
import { User } from '@prisma/client';
import { UserService } from '../../services/user.service';
import { GroupService } from '../../services/group.service';
import { validateTelegramInitData } from '../../utils/telegram-auth';
import { logger } from '../../utils/logger';
import { JwtService } from '../../services/jwt.service';
import { prisma } from '../../database/client';

/**
 * Resolve Telegram WebApp start_param to internal group.id.
 * Accepts deep-link prefixes: vote_<pollId>, storerun_<id>, menu_<groupTgId>,
 * add_<groupTgId>, poll_<groupTgId>. Returns null if unrecognized or not found.
 */
async function resolveGroupIdFromStartParam(startParam: string): Promise<number | null> {
  try {
    if (startParam.startsWith('vote_')) {
      const pollId = parseInt(startParam.slice('vote_'.length), 10);
      if (!Number.isFinite(pollId)) return null;
      const poll = await prisma.poll.findUnique({ where: { id: pollId }, select: { groupId: true } });
      return poll?.groupId ?? null;
    }
    if (startParam.startsWith('storerun_')) {
      const runId = parseInt(startParam.slice('storerun_'.length), 10);
      if (!Number.isFinite(runId)) return null;
      const run = await prisma.storeRun.findUnique({ where: { id: runId }, select: { groupId: true } });
      return run?.groupId ?? null;
    }
    for (const prefix of ['menu_', 'add_', 'poll_']) {
      if (!startParam.startsWith(prefix)) continue;
      const raw = startParam.slice(prefix.length);
      if (!raw) return null;
      let telegramId: bigint;
      try {
        telegramId = BigInt(raw);
      } catch {
        return null;
      }
      const group = await prisma.group.findUnique({
        where: { telegramId },
        select: { id: true },
      });
      return group?.id ?? null;
    }
    return null;
  } catch (error) {
    logger.warn('Failed to resolve start_param to group', { startParam, error });
    return null;
  }
}

type JwtUserInput = Pick<User, 'id'>;

export class AuthController {
  /**
   * POST /api/auth/validate
   * Валидация initData от Telegram WebApp
   */
  static async validateInitData(req: Request, res: Response): Promise<void> {
    try {
      const { initData } = req.body;

      // 🔒 Базовая валидация формата (работает ВСЕГДА, даже в SKIP режиме)
      // 400 Bad Request - невалидный формат данных
      if (!initData) {
        logger.warn('❌ No initData provided');
        res.status(400).json({
          success: false,
          error: 'Missing initData',
          code: 'INVALID_REQUEST'
        });
        return;
      }

      if (typeof initData !== 'string') {
        logger.warn('❌ initData is not a string');
        res.status(400).json({
          success: false,
          error: 'initData must be a string',
          code: 'INVALID_REQUEST'
        });
        return;
      }

      if (initData.trim().length === 0) {
        logger.warn('❌ initData is empty');
        res.status(400).json({
          success: false,
          error: 'initData cannot be empty',
          code: 'INVALID_REQUEST'
        });
        return;
      }

      if (initData.length > 5000) {
        logger.warn('❌ initData is too long');
        res.status(400).json({
          success: false,
          error: 'initData is too long',
          code: 'INVALID_REQUEST'
        });
        return;
      }

      const isProduction = process.env.NODE_ENV === 'production';
      const skipTelegramValidation = process.env.SKIP_TELEGRAM_VALIDATION === 'true';

      // 🚨 SECURITY: hard-fail SKIP_TELEGRAM_VALIDATION in production unless explicitly allowed.
      // Without this, a misconfigured prod .env silently bypasses signature validation.
      if (isProduction && skipTelegramValidation) {
        logger.error('🚨 SKIP_TELEGRAM_VALIDATION blocked in production');
        res.status(500).json({
          success: false,
          error: 'Server misconfiguration',
          code: 'SECURITY_VIOLATION',
        });
        return;
      }

      // ⚠️ SKIP_TELEGRAM_VALIDATION - пропускаем проверку подписи (только не в production)
      // Используем РЕАЛЬНЫЙ ID пользователя из initData
      if (!isProduction && skipTelegramValidation) {
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
            isActive: user.isActive,
            createdAt: user.createdAt,
          },
          ...generateJWT(user),
        });
        return;
      }

      // 🔐 Production режим - валидация подписи Telegram
      logger.info('🔐 Validating initData signature...', {
        initDataLength: initData.length,
        nodeEnv: process.env.NODE_ENV,
      });

      // Проверяем наличие обязательных полей (hash или signature)
      const params = new URLSearchParams(initData);
      if (!params.has('hash') && !params.has('signature')) {
        logger.error('❌ InitData missing hash/signature field');
        res.status(400).json({
          success: false,
          error: 'Invalid initData format',
          code: 'INVALID_REQUEST'
        });
        return;
      }

      // Валидируем подпись (поддерживает оба формата: hash и signature)
      const userData = validateTelegramInitData(initData);
      if (!userData) {
        // Формат валиден, но подпись неправильная -> 401 Unauthorized
        logger.error('❌ InitData signature validation failed');
        res.status(401).json({
          success: false,
          error: 'Invalid initData signature',
          code: 'INVALID_INIT_DATA'
        });
        return;
      }

      logger.info('InitData validated successfully');

      // Создаем или обновляем пользователя в БД
      const user = await UserService.upsertUser({
        telegramId: userData.id.toString(),
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        photoUrl: userData.photo_url,
      });

      logger.info('User authenticated via Telegram', { userId: user.id });

      // Auto-add membership when launched via group deep-link — ONLY if Telegram
      // confirms the user is actually in that group (no self-granted membership).
      const startParam = params.get('start_param');
      if (startParam) {
        const groupId = await resolveGroupIdFromStartParam(startParam);
        if (groupId) {
          try {
            const group = await GroupService.getGroupById(groupId);
            if (group) {
              const added = await GroupService.addMemberFromStartParam(
                { id: group.id, telegramId: group.telegramId },
                { id: user.id, telegramId: user.telegramId },
              );
              if (added) {
                logger.info('Verified membership via start_param', { userId: user.id, groupId });
              }
            }
          } catch (err) {
            logger.warn('Membership auto-add failed', { userId: user.id, groupId, err });
          }
        }
      }

      res.json({
        success: true,
        user: {
          id: typeof user.id === 'bigint' ? Number(user.id) : user.id,
          telegramId: typeof user.telegramId === 'bigint' ? user.telegramId.toString() : user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          photoUrl: user.photoUrl,
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
function generateJWT(user: JwtUserInput): { accessToken: string; refreshToken: string; expiresIn: number } {
  const payload = {
    userId: user.id,
  };
  
  // ✅ Генерируем ОБА токена: access (1 час) и refresh (7 дней)
  const tokens = JwtService.generateTokenPair(payload);
  return {
    ...tokens,
    expiresIn: 3600, // 1 час в секундах
  };
}

export const authController = AuthController;

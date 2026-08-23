import { Request, Response, NextFunction } from 'express';
import { UserService } from '../../services/user.service';
import { validateTelegramInitData } from '../../utils/telegram-auth';
import { logger } from '../../utils/logger';
import { JwtService } from '../../services/jwt.service';
import { cacheService } from '../../services/cache.service';

/**
 * Middleware для аутентификации через Telegram WebApp
 */
export async function telegramAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // ⚠️ SKIP_TELEGRAM_VALIDATION - отключает проверку подписи Telegram
    // Используем РЕАЛЬНЫЙ ID пользователя из initData
    if (process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
      if (
        process.env.NODE_ENV === 'production' &&
        process.env.SKIP_TELEGRAM_VALIDATION === 'true'
      ) {
        logger.error('🚨 SKIP_TELEGRAM_VALIDATION blocked in production');
        throw new Error(
          'SECURITY: SKIP_TELEGRAM_VALIDATION cannot be used in production'
        );
      }
      logger.warn(
        '⚠️ SECURITY: SKIP_TELEGRAM_VALIDATION enabled - DEVELOPMENT ONLY!'
      );
      logger.info(
        '🔓 SKIP_TELEGRAM_VALIDATION mode - extracting REAL user from initData'
      );

      const authHeader = req.headers.authorization;
      let telegramUser = null;

      // Пробуем извлечь реальные данные из токена/initData
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        // Проверяем что это JWT токен (начинается с 'eyJ')
        const isJWT = token.startsWith('eyJ');

        logger.info('🔍 SKIP mode: analyzing token', {
          isJWT,
          tokenLength: token.length,
        });

        if (isJWT) {
          // Это JWT токен - используем JWT валидацию через JwtService
          try {
            const decoded = JwtService.verifyToken(token);

            if (decoded && decoded.type === 'access') {
              logger.info('✅ SKIP mode: decoded JWT token', {
                userId: decoded.userId,
              });

              const user = await UserService.getUserById(decoded.userId);

              if (user && user.isActive) {
                req.user = user;
                logger.info('✅ SKIP mode: authenticated via JWT token', {
                  userId: user.id,
                });
                next();
                return;
              }
            } else {
              logger.warn('⚠️ Invalid JWT token type or expired');
            }
          } catch (jwtError) {
            logger.warn('⚠️ Failed to verify JWT token', {
              jwtError:
                jwtError instanceof Error ? jwtError.message : String(jwtError),
            });
          }
        } else {
          // Это Telegram initData - парсим без валидации подписи
          try {
            const { parseInitDataUnsafe } = await import(
              '../../utils/telegram-auth'
            );
            telegramUser = parseInitDataUnsafe(token);

            if (telegramUser) {
              logger.info('SKIP mode extracted a Telegram user');
            }
          } catch (initDataError) {
            logger.warn('⚠️ Failed to parse initData', {
              initDataError:
                initDataError instanceof Error
                  ? initDataError.message
                  : String(initDataError),
            });
          }
        }
      }

      // Если нашли реального пользователя из initData - используем его
      if (telegramUser) {
        const dbUser = await UserService.getUserByTelegramId(
          BigInt(telegramUser.id)
        );

        if (!dbUser) {
          // Создаём пользователя с РЕАЛЬНЫМ ID из Telegram
          const newUser = await UserService.createUser({
            telegramId: BigInt(telegramUser.id).toString(),
            username: telegramUser.username || `user_${telegramUser.id}`,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
          });
          req.user = newUser;
          logger.info('✅ SKIP mode: created new user with REAL Telegram ID', {
            userId: newUser.id,
          });
        } else {
          req.user = dbUser;
          logger.info('✅ SKIP mode: authenticated with REAL Telegram ID', {
            userId: dbUser.id,
          });
        }

        next();
        return;
      }

      // Fallback: КРИТИЧНО - НЕ использовать TEST_USER_ID!
      // Это приведёт к смешиванию голосов разных пользователей
      logger.error('❌ CRITICAL: No real user data in initData!');
      logger.error(
        '❌ Cannot authenticate - this would mix votes from different users!'
      );

      res.status(401).json({
        success: false,
        error:
          'Telegram authentication required. Please open app inside Telegram.',
        code: 'MISSING_TELEGRAM_DATA',
      });
      return;
    }

    // Получаем токен из заголовка Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
        code: 'MISSING_TOKEN',
      });
      return;
    }

    const token = authHeader.substring(7); // Убираем 'Bearer '

    // 🔐 Валидируем JWT токен с проверкой подписи
    let userData;
    try {
      // ✅ Используем настоящий JWT вместо base64
      const decoded = JwtService.verifyToken(token);

      if (!decoded) {
        // Токен невалидный или expired
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          code: 'TOKEN_EXPIRED',
        });
        return;
      }

      // Проверяем что это access token (не refresh)
      if (decoded.type !== 'access') {
        res.status(401).json({
          success: false,
          error: 'Invalid token type. Use access token.',
          code: 'INVALID_TOKEN_TYPE',
        });
        return;
      }

      // Проверяем пользователя в БД
      const user = await UserService.getUserById(decoded.userId);
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: 'User not found or inactive',
          code: 'USER_NOT_ACTIVE',
        });
        return;
      }

      userData = user;

      logger.debug('✅ JWT token validated', {
        userId: decoded.userId,
      });
    } catch (error) {
      // Если JWT валидация не удалась, пробуем как initData (для обратной совместимости)
      logger.debug('JWT validation failed, trying as initData...');

      try {
        userData = validateTelegramInitData(token);
        if (!userData) {
          res.status(401).json({
            success: false,
            error: 'Invalid token',
            code: 'INVALID_TOKEN',
          });
          return;
        }

        // Получаем пользователя из БД
        const dbUser = await UserService.getUserByTelegramId(
          BigInt(userData.id)
        );
        if (!dbUser || !dbUser.isActive) {
          res.status(401).json({
            success: false,
            error: 'User not found or inactive',
            code: 'USER_NOT_ACTIVE',
          });
          return;
        }

        userData = dbUser;
        logger.debug('✅ InitData validated (legacy path)');
      } catch (initDataError) {
        res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN',
        });
        return;
      }
    }

    // Добавляем пользователя в request
    req.user = userData;
    next();
  } catch (error) {
    logger.error('Telegram auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/* adminMiddleware удалён вместе с понятием глобального администратора.
   Права на ресурс группы даёт роль в group_members — requireGroupAdmin;
   служебные операции уровня инстанса (метрики, сезоны, квесты) закрыты
   отдельным секретом — operationsApiMiddleware. Флаг users.is_admin больше не
   участвует ни в одной проверке доступа. */

/**
 * Middleware для валидации Telegram initData в теле запроса
 */
export async function validateInitDataMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 🔐 SECURITY: КРИТИЧЕСКАЯ ПРОВЕРКА
    // ⚠️ SKIP_TELEGRAM_VALIDATION - отключает проверку подписи Telegram
    // Используем РЕАЛЬНЫЕ данные пользователя из initData
    if (process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
      if (
        process.env.NODE_ENV === 'production' &&
        process.env.SKIP_TELEGRAM_VALIDATION === 'true'
      ) {
        logger.error('🚨 SKIP_TELEGRAM_VALIDATION blocked in production');
        throw new Error(
          'SECURITY: SKIP_TELEGRAM_VALIDATION cannot be used in production'
        );
      }
      logger.warn(
        '⚠️ SECURITY: SKIP_TELEGRAM_VALIDATION enabled - DEVELOPMENT ONLY!'
      );
      const { initData } = req.body;

      // Пробуем извлечь реальные данные пользователя из initData
      if (initData && initData.trim().length > 0) {
        try {
          const { parseInitDataUnsafe } = await import(
            '../../utils/telegram-auth'
          );
          const telegramUser = parseInitDataUnsafe(initData);

          if (telegramUser && telegramUser.id) {
            (req as any).telegramUser = telegramUser;
            logger.info('SKIP mode accepted a Telegram user');
            next();
            return;
          }
        } catch (parseError) {
          logger.error('❌ Failed to parse initData:', parseError);
        }
      }

      // Fallback: КРИТИЧНО - НЕ использовать TEST_USER_ID!
      // Это приведёт к смешиванию голосов разных пользователей
      logger.error(
        '❌ validateInitDataMiddleware: No real user data in initData!'
      );
      logger.error(
        '❌ Cannot authenticate - this would mix votes from different users!'
      );

      res.status(401).json({
        success: false,
        error:
          'Telegram authentication required. Please open app inside Telegram.',
        code: 'MISSING_TELEGRAM_DATA',
      });
      return;
    }

    const { initData } = req.body;

    if (!initData) {
      res.status(400).json({
        success: false,
        error: 'Missing initData in request body',
        code: 'MISSING_INIT_DATA',
      });
      return;
    }

    const userData = validateTelegramInitData(initData);
    if (!userData) {
      res.status(400).json({
        success: false,
        error: 'Invalid initData',
        code: 'INVALID_INIT_DATA',
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
      code: 'INTERNAL_ERROR',
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
      // ✅ FIX: Используем JwtService.verifyToken вместо base64 парсинга
      const decoded = JwtService.verifyToken(token);

      if (decoded && decoded.type === 'access') {
        const user = await UserService.getUserById(decoded.userId);

        if (user && user.isActive) {
          req.user = user;
        }
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

/**
 * Middleware для обновления токена через refresh token
 * ✅ FIX: Отдельный middleware который принимает refresh токены
 */
export async function refreshTokenMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
        code: 'MISSING_TOKEN',
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = JwtService.verifyToken(token);

      if (!decoded) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired refresh token',
          code: 'TOKEN_EXPIRED',
        });
        return;
      }

      // ✅ Принимаем только refresh токены
      if (decoded.type !== 'refresh') {
        res.status(401).json({
          success: false,
          error: 'Invalid token type. Use refresh token.',
          code: 'INVALID_TOKEN_TYPE',
        });
        return;
      }

      if (!decoded.jti || !decoded.exp) {
        res.status(401).json({
          success: false,
          error: 'Invalid refresh token claims',
          code: 'INVALID_TOKEN',
        });
        return;
      }

      const remainingTtl = Math.max(
        1,
        decoded.exp - Math.floor(Date.now() / 1000)
      );
      const replayGuard = await cacheService.setIfAbsent(
        `auth:refresh-used:${decoded.jti}`,
        true,
        remainingTtl
      );

      if (replayGuard === 'exists') {
        logger.warn('Refresh token replay rejected');
        res.status(401).json({
          success: false,
          error: 'Refresh token has already been used',
          code: 'REFRESH_TOKEN_REPLAY',
        });
        return;
      }

      if (
        replayGuard === 'unavailable' &&
        process.env.NODE_ENV === 'production'
      ) {
        res.setHeader('Retry-After', '5');
        res.status(503).json({
          success: false,
          error: 'Authentication service is temporarily unavailable',
          code: 'AUTH_SERVICE_UNAVAILABLE',
        });
        return;
      }

      // Проверяем пользователя в БД
      const user = await UserService.getUserById(decoded.userId);
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: 'User not found or inactive',
          code: 'USER_NOT_ACTIVE',
        });
        return;
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_TOKEN',
      });
      return;
    }
  } catch (error) {
    logger.error('Refresh token middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

import { Request, Response, NextFunction } from 'express';
import { UserService } from '../../services/user.service';
import { validateTelegramInitData } from '../../utils/telegram-auth';
import { logger } from '../../utils/logger';
import { JwtService } from '../../services/jwt.service';

/**
 * Middleware для аутентификации через Telegram WebApp
 */
export async function telegramAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 🔐 SECURITY: КРИТИЧЕСКАЯ ПРОВЕРКА
    // SKIP_TELEGRAM_VALIDATION ЗАПРЕЩЕН в production!
    if (process.env.NODE_ENV === 'production' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
      logger.error('🚨 SECURITY BREACH: SKIP_TELEGRAM_VALIDATION enabled in PRODUCTION! Shutting down...');
      throw new Error('CRITICAL SECURITY ERROR: SKIP_TELEGRAM_VALIDATION must NEVER be enabled in production!');
    }
    
    // В development режиме с SKIP_TELEGRAM_VALIDATION - пропускаем проверку подписи,
    // но используем РЕАЛЬНЫЙ ID пользователя из initData для конфиденциальности
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
      logger.warn('⚠️ SECURITY: SKIP_TELEGRAM_VALIDATION enabled - DEVELOPMENT ONLY!');
      logger.info('🔓 SKIP_TELEGRAM_VALIDATION mode - extracting REAL user from initData');
      
      const authHeader = req.headers.authorization;
      let telegramUser = null;
      
      // Пробуем извлечь реальные данные из токена/initData
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        try {
          // Пробуем как JWT токен
          const jwt = await import('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
          
          logger.info('✅ SKIP mode: decoded JWT token', {
            userId: decoded.userId,
            telegramId: decoded.telegramId,
          });
          
          const user = await UserService.getUserById(decoded.userId);
          
          if (user && user.isActive) {
            (req as any).user = user;
            logger.info('✅ SKIP mode: authenticated via JWT token', {
              userId: user.id,
              telegramId: user.telegramId.toString()
            });
            next();
            return;
          }
        } catch (jwtError) {
          // Если не JWT токен, пробуем как initData
          try {
            const { parseInitDataUnsafe } = await import('../../utils/telegram-auth');
            telegramUser = parseInitDataUnsafe(token);
          } catch (initDataError) {
            logger.warn('⚠️ Failed to parse as JWT or initData', {
              jwtError: jwtError instanceof Error ? jwtError.message : String(jwtError),
              initDataError: initDataError instanceof Error ? initDataError.message : String(initDataError),
            });
          }
        }
      }
      
      // Если нашли реального пользователя из initData - используем его
      if (telegramUser) {
        const dbUser = await UserService.getUserByTelegramId(BigInt(telegramUser.id));
        
        if (!dbUser) {
          // Создаём пользователя с РЕАЛЬНЫМ ID из Telegram
          const newUser = await UserService.createUser({
            telegramId: BigInt(telegramUser.id).toString(),
            username: telegramUser.username || `user_${telegramUser.id}`,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
          });
          (req as any).user = newUser;
          logger.info('✅ SKIP mode: created new user with REAL Telegram ID', {
            userId: newUser.id,
            telegramId: telegramUser.id
          });
        } else {
          (req as any).user = dbUser;
          logger.info('✅ SKIP mode: authenticated with REAL Telegram ID', {
            userId: dbUser.id,
            telegramId: telegramUser.id
          });
        }
        
        next();
        return;
      }
      
      // Fallback: если нет реальных данных - используем TEST_USER_ID как последнюю попытку
      logger.warn('⚠️ No real initData found - falling back to TEST_USER_ID (NOT RECOMMENDED!)');
      const testUserId = process.env.TEST_USER_ID || '123456789';
      const dbUser = await UserService.getUserByTelegramId(BigInt(testUserId));
      
      if (!dbUser) {
        const newUser = await UserService.createUser({
          telegramId: BigInt(testUserId).toString(),
          username: 'dev_user',
          firstName: 'Dev',
          lastName: 'User',
        });
        (req as any).user = newUser;
      } else {
        (req as any).user = dbUser;
      }
      
      logger.info('✅ SKIP mode: fallback test user', {
        userId: (req as any).user.id,
        telegramId: testUserId
      });
      
      next();
      return;
    }
    
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
          code: 'TOKEN_EXPIRED'
        });
        return;
      }

      // Проверяем что это access token (не refresh)
      if (decoded.type !== 'access') {
        res.status(401).json({
          success: false,
          error: 'Invalid token type. Use access token.',
          code: 'INVALID_TOKEN_TYPE'
        });
        return;
      }
      
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
      
      logger.debug('✅ JWT token validated', {
        userId: decoded.userId,
        telegramId: decoded.telegramId,
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
        logger.debug('✅ InitData validated (legacy path)');
      } catch (initDataError) {
        res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
        return;
      }
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
    // 🔐 SECURITY: КРИТИЧЕСКАЯ ПРОВЕРКА
    if (process.env.NODE_ENV === 'production' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
      logger.error('🚨 SECURITY BREACH: SKIP_TELEGRAM_VALIDATION in PRODUCTION!');
      throw new Error('CRITICAL SECURITY ERROR: SKIP_TELEGRAM_VALIDATION forbidden in production!');
    }
    
    // В development режиме с SKIP_TELEGRAM_VALIDATION - пропускаем проверку подписи,
    // но используем РЕАЛЬНЫЕ данные пользователя из initData
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
      logger.warn('⚠️ SECURITY: SKIP_TELEGRAM_VALIDATION enabled - DEVELOPMENT ONLY!');
      const { initData } = req.body;
      
      // Пробуем извлечь реальные данные пользователя
      if (initData && initData.trim().length > 0 && initData !== 'mock_jwt_token_12345678') {
        const { parseInitDataUnsafe } = await import('../../utils/telegram-auth');
        const telegramUser = parseInitDataUnsafe(initData);
        
        if (telegramUser) {
          (req as any).telegramUser = telegramUser;
          logger.info('✅ validateInitDataMiddleware: SKIP mode - REAL user from initData', {
            userId: telegramUser.id,
            username: telegramUser.username
          });
          next();
          return;
        }
      }
      
      // Fallback: используем TEST_USER_ID только если нет реальных данных
      logger.warn('⚠️ validateInitDataMiddleware: No real initData - using TEST_USER_ID fallback');
      const testUserId = process.env.TEST_USER_ID || '123456789';
      (req as any).telegramUser = {
        id: Number(testUserId),
        first_name: 'Dev',
        last_name: 'User',
        username: 'dev_user',
      };
      
      logger.info('✅ validateInitDataMiddleware: SKIP mode - fallback test user');
      next();
      return;
    }
    
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

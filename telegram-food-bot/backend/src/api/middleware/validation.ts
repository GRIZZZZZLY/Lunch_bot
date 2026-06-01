import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import { getParam } from '../../utils/request-params';

// Схемы валидации для меню
const createMenuItemSchema = z.object({
  // groupId передаётся в теле запроса (multi-tenant). Без него z.object() срезал бы
  // поле при req.body = result.data, и контроллер падал бы с MISSING_GROUP_ID.
  // optional — наличие всё равно проверяет контроллер (query ИЛИ body).
  groupId: z.number().int().positive('Group ID must be positive').optional(),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional().or(z.literal('')),
  price: z.number().min(0, 'Price cannot be negative').optional(),
  imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

const updateMenuItemSchema = createMenuItemSchema.partial();

// Схемы валидации для голосований
const createPollSchema = z.object({
  groupId: z.number().int().positive('Group ID must be positive'),
  title: z.string().max(200, 'Title too long').optional(),
  description: z.string().max(500, 'Description too long').optional(),
  endTime: z.string().datetime('Invalid end time format').optional(),
});

const voteSchema = z.object({
  menuItemId: z.number().int().positive('Menu item ID must be positive'),
});

/**
 * Middleware для валидации данных блюда при создании
 */
export function validateMenuItemData(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const schema = req.method === 'POST' ? createMenuItemSchema : updateMenuItemSchema;
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      // TEMP DIAGNOSTIC: понять почему create блюда падает 400 (типы полей body)
      logger.warn('⚠️ MENU VALIDATION FAILED', {
        method: req.method,
        errors,
        bodyTypes: Object.fromEntries(
          Object.entries(req.body ?? {}).map(([k, v]) => [k, `${typeof v}:${JSON.stringify(v)?.slice(0, 40)}`])
        ),
      });

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors,
      });
      return;
    }

    // Заменяем body валидированными данными
    req.body = result.data;
    next();

  } catch (error) {
    logger.error('Validation middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Middleware для валидации данных голосования
 */
export function validatePollData(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const result = createPollSchema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors,
      });
      return;
    }

    req.body = result.data;
    next();

  } catch (error) {
    logger.error('Poll validation middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Middleware для валидации данных голоса
 */
export function validateVoteData(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const result = voteSchema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors,
      });
      return;
    }

    req.body = result.data;
    next();

  } catch (error) {
    logger.error('Vote validation middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Middleware для валидации ID параметров
 */
export function validateIdParam(paramName: string = 'id') {
  return function(req: Request, res: Response, next: NextFunction): void {
    try {
      const id = parseInt(getParam(req.params, paramName), 10);

      if (isNaN(id) || id <= 0) {
        res.status(400).json({
          success: false,
          error: `Invalid ${paramName} parameter`,
          code: 'INVALID_ID'
        });
        return;
      }

      // Добавляем валидированный ID в request
      (req as any).validatedId = id;
      next();

    } catch (error) {
      logger.error('ID validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Middleware для валидации query параметров пагинации
 */
export function validatePaginationParams(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (page < 1) {
      res.status(400).json({
        success: false,
        error: 'Page must be greater than 0',
        code: 'INVALID_PAGE'
      });
      return;
    }

    if (limit < 1 || limit > 100) {
      res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 100',
        code: 'INVALID_LIMIT'
      });
      return;
    }

    // Добавляем валидированные параметры в request
    (req as any).pagination = {
      page,
      limit,
      offset: (page - 1) * limit,
    };

    next();

  } catch (error) {
    logger.error('Pagination validation middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Универсальный middleware для валидации с кастомной схемой
 */
export function validateWithSchema(schema: z.ZodSchema) {
  return function(req: Request, res: Response, next: NextFunction): void {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors,
        });
        return;
      }

      req.body = result.data;
      next();

    } catch (error) {
      logger.error('Custom validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Middleware для санитизации строковых полей
 */
export function sanitizeStrings(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    function sanitizeObject(obj: any): any {
      if (typeof obj === 'string') {
        return obj.trim();
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      
      return obj;
    }

    req.body = sanitizeObject(req.body);
    next();

  } catch (error) {
    logger.error('String sanitization middleware error:', error);
    next(); // Продолжаем выполнение даже при ошибке санитизации
  }
}

/**
 * Zod схемы валидации для API
 * Sprint 1: Критичное исправление безопасности
 */

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// ==========================================
// БАЗОВЫЕ ТИПЫ
// ==========================================

export const IdSchema = z.number().int().positive();
export const TelegramIdSchema = z.union([
  z.number().int().positive(),
  z.string().regex(/^\d+$/).transform(Number),
]);
export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

// ==========================================
// POLL SCHEMAS
// ==========================================

export const CreatePollSchema = z.object({
  groupId: IdSchema,
  duration: z.number().int().min(5).max(180).optional().default(30),
  createdBy: IdSchema.optional(),
  selectedMenuItemIds: z.array(IdSchema).min(2).optional(),
});

export const CompletePollSchema = z.object({
  pollId: IdSchema,
  completedBy: IdSchema.optional(),
  minVotes: z.number().int().min(1).max(100).optional().default(1),
  maxWinners: z.number().int().min(1).max(50).nullable().optional(),
  tieBreakMethod: z.enum(['earliest', 'alphabetical']).optional().default('earliest'),
});

export const CancelPollSchema = z.object({
  pollId: IdSchema,
  cancelledBy: IdSchema,
  reason: z.string().max(500).optional(),
});

// ==========================================
// VOTE SCHEMAS
// ==========================================

export const CreateVoteSchema = z.object({
  pollId: IdSchema,
  userId: IdSchema,
  menuItemId: IdSchema,
});

export const CreateMultipleVotesSchema = z.object({
  pollId: IdSchema,
  userId: IdSchema,
  menuItemIds: z.array(IdSchema).min(1).max(20),
});

export const CreateVoteWithTypeSchema = z.object({
  pollId: IdSchema,
  userId: IdSchema,
  voteType: z.enum(['MENU_ITEM', 'BRING_OWN', 'SKIP']),
  menuItemId: IdSchema.optional(),
  customOption: z.string().max(200).optional(),
});

export const DeleteVoteSchema = z.object({
  pollId: IdSchema,
  userId: IdSchema,
  menuItemId: IdSchema,
});

// ==========================================
// MENU SCHEMAS
// ==========================================

export const CreateMenuItemSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  price: z.number().min(0).max(100000).optional(),
  category: z.string().max(50).optional(),
  imageUrl: z.string().url().max(500).optional(),
  isActive: z.boolean().optional().default(true),
});

export const UpdateMenuItemSchema = CreateMenuItemSchema.partial();

// ==========================================
// BUDGET SCHEMAS
// ==========================================

export const MarkAsPaidSchema = z.object({
  transactionId: IdSchema,
  telegramId: TelegramIdSchema,
});

export const ConfirmPaymentSchema = z.object({
  transactionId: IdSchema,
});

export const SetOrderCostsSchema = z.object({
  pollId: IdSchema,
  userId: IdSchema,
  costs: z.object({
    deliveryCost: z.number().min(0).max(100000),
    serviceFee: z.number().min(0).max(100000),
    tip: z.number().min(0).max(100000),
    notes: z.string().max(500).optional(),
  }),
});

export const SendReminderSchema = z.object({
  transactionId: IdSchema,
  requestingUserId: IdSchema,
});

// ==========================================
// USER SCHEMAS
// ==========================================

export const UpdatePaymentInfoSchema = z.object({
  userId: IdSchema,
  paymentCard: z.string().max(30).optional().nullable(),
  paymentPhone: z.string().max(20).optional().nullable(),
  paymentDetails: z.string().max(500).optional().nullable(),
});

export const UpdateUserProfileSchema = z.object({
  firstName: z.string().min(1).max(64).optional(),
  lastName: z.string().max(64).optional().nullable(),
  username: z.string().max(32).optional().nullable(),
});

// ==========================================
// RECURRING POLL SCHEMAS
// ==========================================

export const CreateRecurringPollSchema = z.object({
  groupId: IdSchema,
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format. Use HH:MM'),
  duration: z.number().int().min(5).max(180),
  selectedMenuItemIds: z.array(IdSchema).min(2).optional().nullable(),
  createdBy: IdSchema,
});

export const UpdateRecurringPollSchema = z.object({
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  duration: z.number().int().min(5).max(180).optional(),
  selectedMenuItemIds: z.array(IdSchema).min(2).optional().nullable(),
  isEnabled: z.boolean().optional(),
});

// ==========================================
// GAMIFICATION SCHEMAS
// ==========================================

export const AwardXPSchema = z.object({
  userId: IdSchema,
  amount: z.number().int().min(1).max(10000),
  reason: z.string().min(1).max(200),
  category: z.enum(['GASTRO', 'RESPONSIBLE', 'SOCIAL', 'EXPLORER']),
});

// ==========================================
// AUTH SCHEMAS
// ==========================================

export const TelegramAuthSchema = z.object({
  id: TelegramIdSchema,
  first_name: z.string().min(1).max(64),
  last_name: z.string().max(64).optional(),
  username: z.string().max(32).optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number().int().positive(),
  hash: z.string().min(1),
});

// ==========================================
// MENU SUGGESTION SCHEMAS
// ==========================================

export const CreateSuggestionSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  price: z.number().min(0).max(100000).optional(),
  category: z.string().max(50).optional(),
  suggestedBy: IdSchema,
});

export const ApproveSuggestionSchema = z.object({
  suggestionId: IdSchema,
  approvedBy: IdSchema,
});

export const RejectSuggestionSchema = z.object({
  suggestionId: IdSchema,
  rejectedBy: IdSchema,
  reason: z.string().max(500).optional(),
});

// ==========================================
// FEEDBACK SCHEMAS
// ==========================================

export const SubmitFeedbackSchema = z.object({
  userId: IdSchema,
  type: z.enum(['bug', 'feature', 'improvement', 'other']),
  message: z.string().min(10).max(2000),
  rating: z.number().int().min(1).max(5).optional(),
});

// ==========================================
// NOTIFICATION SCHEMAS
// ==========================================

export const SendCustomNotificationSchema = z.object({
  userId: IdSchema,
  message: z.string().min(1).max(4000),
  parseMode: z.enum(['Markdown', 'HTML', 'MarkdownV2']).optional(),
});

// ==========================================
// VALIDATION MIDDLEWARE
// ==========================================

/**
 * Создаёт middleware для валидации body запроса
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Validation error:', {
          path: req.path,
          errors: error.errors,
        });
        
        res.status(400).json({
          success: false,
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Создаёт middleware для валидации query параметров
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Query validation error:', {
          path: req.path,
          errors: error.errors,
        });
        
        res.status(400).json({
          success: false,
          error: 'Query validation error',
          code: 'QUERY_VALIDATION_ERROR',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Создаёт middleware для валидации params
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Params validation error:', {
          path: req.path,
          errors: error.errors,
        });
        
        res.status(400).json({
          success: false,
          error: 'Path parameter validation error',
          code: 'PARAMS_VALIDATION_ERROR',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  };
}

// Общие схемы для params
export const IdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const PollIdParamsSchema = z.object({
  pollId: z.string().regex(/^\d+$/).transform(Number),
});

export const UserIdParamsSchema = z.object({
  userId: z.string().regex(/^\d+$/).transform(Number),
});

export const GroupIdParamsSchema = z.object({
  groupId: z.string().regex(/^\d+$/).transform(Number),
});

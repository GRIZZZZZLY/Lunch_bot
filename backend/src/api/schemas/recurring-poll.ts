/**
 * Контракты входа для `/api/recurring`.
 *
 * Схемы тел перенесены из `recurring-poll.controller.ts` как есть — они там
 * работали. Новое: контракты `params` (`:groupId`, `:id`), контракт `query`
 * для `limit` и схема для `toggle`, чья единственная проверка была рукописной.
 */
import { z } from 'zod';

import { bodyContract, queryContract } from '../middleware/validate';
import { bodyShape, idParams, optionalPositiveInt, queryShape } from './common';

// ---------------------------------------------------------------- params

export const recurringGroupIdParam = idParams('groupId');
export const recurringScheduleIdParam = idParams('id');

// ----------------------------------------------------------------- query

export const recurringHistoryQuery = queryContract(
  queryShape({ limit: optionalPositiveInt }),
  { default: 'VALIDATION_ERROR', byField: { limit: 'INVALID_LIMIT' } },
);

// ------------------------------------------------------------------ body

const daysOfWeek = z
  .array(z.number().int().min(0).max(6))
  .min(1, 'At least one day must be selected')
  .max(7);

const timeOfDay = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'timeOfDay must be in HH:MM format')
  .refine(value => {
    const [h, m] = value.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }, 'timeOfDay must be a valid time (00:00–23:59)');

export const createScheduleBody = bodyContract(
  bodyShape({
    groupId: z.number().int().positive('groupId must be a positive integer'),
    daysOfWeek,
    timeOfDay,
    duration: z
      .number()
      .int()
      .min(1, 'duration must be at least 1 minute')
      .max(1440),
    selectedMenuItemIds: z
      .array(z.number().int().positive())
      .nullable()
      .optional(),
  }),
);

export const updateScheduleBody = bodyContract(
  bodyShape({
    groupId: z.number().int().positive('groupId must be a positive integer'),
    daysOfWeek: daysOfWeek.optional(),
    timeOfDay: timeOfDay.optional(),
    duration: z.number().int().min(1).max(1440).optional(),
    selectedMenuItemIds: z
      .array(z.number().int().positive())
      .nullable()
      .optional(),
    isEnabled: z.boolean().optional(),
  }),
);

export const toggleScheduleBody = bodyContract(
  bodyShape({ isEnabled: z.boolean() }),
);

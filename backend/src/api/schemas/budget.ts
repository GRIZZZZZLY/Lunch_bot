/**
 * Контракты входа для `/api/budget` — денежные операции.
 *
 * В `budget.controller.ts` уже лежали шесть zod-схем. Две из них работали
 * (`TransactionIdSchema`, `SendRemindersAllSchema`), а четыре —
 * `PollIdParamSchema`, `StatusQuerySchema`, `DateRangeQuerySchema`,
 * `SetOrderCostsSchema` — были объявлены и не вызывались ни разу. Здесь они
 * подключены, но не скопированы дословно: см. `budgetStatsQuery`.
 */
import { z } from 'zod';

import { bodyContract, queryContract } from '../middleware/validate';
import { bodyShape, idParams, optionalBooleanFlag, queryShape } from './common';

// ---------------------------------------------------------------- params

export const budgetPollIdParam = idParams('pollId');

// ----------------------------------------------------------------- query

export const budgetDebtsQuery = queryContract(
  queryShape({
    status: z.enum(['PENDING', 'PAID', 'CONFIRMED']).optional(),
    activeOnly: optionalBooleanFlag,
  }),
);

/**
 * Диапазон дат.
 *
 * Неподключённый `DateRangeQuerySchema` требовал `z.string().datetime()`, то
 * есть полный ISO с временем. Подключать его как есть было нельзя: `?from=
 * 2026-08-01` — законный ввод, а `.datetime()` отверг бы его 400-м. Поэтому
 * проверка та, что действительно нужна: строка, которую разбирает `Date`.
 * Правило «from не позже to» из старой схемы сохранено — оно осмысленно.
 */
export const budgetStatsQuery = queryContract(
  queryShape({
    from: z
      .string()
      .refine(value => !Number.isNaN(Date.parse(value)), 'from must be a valid date')
      .optional(),
    to: z
      .string()
      .refine(value => !Number.isNaN(Date.parse(value)), 'to must be a valid date')
      .optional(),
  }).refine(
    data => !(data.from && data.to && Date.parse(data.from) > Date.parse(data.to)),
    { message: 'from date must be before to date', path: ['from'] },
  ),
);

// ------------------------------------------------------------------ body

/**
 * `z.number()` без `coerce` — сохранён контракт прежнего
 * `TransactionIdSchema`: строка `"5"` тут не принималась и не принимается,
 * потому что клиент отправляет JSON и присылает число.
 */
export const transactionIdBody = bodyContract(
  bodyShape({
    transactionId: z
      .number()
      .int()
      .positive('transactionId must be a positive integer'),
  }),
);

export const pollIdBody = bodyContract(
  bodyShape({
    pollId: z.number().int().positive('pollId must be a positive integer'),
  }),
);

export const setOrderCostsBody = bodyContract(
  bodyShape({
    deliveryCost: z.number().min(0).max(100000, 'deliveryCost max 100000'),
    serviceFee: z.number().min(0).max(100000, 'serviceFee max 100000'),
    tip: z.number().min(0).max(100000, 'tip max 100000'),
    notes: z.string().max(500).optional(),
  }),
);

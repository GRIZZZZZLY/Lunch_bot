/**
 * Контракты входа для `/api/admin`.
 *
 * `groupId` здесь, как и в предложениях блюд, приходит из трёх источников
 * (`query`, `params`, `body`) — порядок разбирает `getGroupId` в контроллере.
 * Контракты проверяют форму в каждом источнике, но не решают, какой источник
 * главный.
 */
import { z } from 'zod';

import { bodyContract, queryContract } from '../middleware/validate';
import {
  bodyShape,
  idParams,
  optionalPositiveInt,
  queryShape,
  strictPartialBodyShape,
} from './common';

// ---------------------------------------------------------------- params

export const adminUserIdParam = idParams('userId');
export const adminPollIdParam = idParams('pollId');
export const adminPollParticipantParams = idParams('pollId', 'userId');
export const adminDebtIdParam = idParams('debtId');
export const adminGroupIdParam = idParams('groupId');

// ----------------------------------------------------------------- query

export const adminGroupQuery = queryContract(queryShape({}), {
  default: 'VALIDATION_ERROR',
  byField: { groupId: 'INVALID_GROUP_ID' },
});

/**
 * `daysOld` определяет, СКОЛЬКО будет удалено безвозвратно, и разбирался как
 * `parseInt(...) || 30`: опечатка `?daysOld=3O` (буква O) молча превращалась в
 * 30 дней. Теперь это 400.
 */
export const adminCleanupQuery = queryContract(
  queryShape({
    daysOld: optionalPositiveInt,
    kind: z.enum(['polls', 'transactions']).optional(),
  }),
  {
    default: 'VALIDATION_ERROR',
    byField: { groupId: 'INVALID_GROUP_ID' },
  },
);

// ------------------------------------------------------------------ body

/** Тело, которое несёт только `groupId` (и то не обязано). */
export const adminGroupBody = bodyContract(
  bodyShape({ groupId: optionalPositiveInt }),
);

export const toggleAdminBody = bodyContract(
  bodyShape({ isAdmin: z.boolean(), groupId: optionalPositiveInt }),
);

export const toggleActiveBody = bodyContract(
  bodyShape({ isActive: z.boolean(), groupId: optionalPositiveInt }),
);

export const toggleParticipatesBody = bodyContract(
  bodyShape({ participates: z.boolean(), groupId: optionalPositiveInt }),
);

export const setPollParticipantBody = bodyContract(
  bodyShape({
    status: z.enum(['EXPECTED', 'EXCLUDED']),
    reason: z.string().trim().max(500).optional(),
    groupId: optionalPositiveInt,
  }),
);

/**
 * Настройки напоминаний и уведомлений — единственные два тела в проекте со
 * `strict`, и причина конкретная: контроллер передавал `req.body` В PRISMA
 * ЦЕЛИКОМ (`update: data`). Что это означало на практике:
 *
 * - лишнее поле, не совпавшее с колонкой, давало исключение Prisma и 500;
 * - лишнее поле, СОВПАВШЕЕ с колонкой, применялось. Тип на клиенте —
 *   `Partial<ReminderSettings>`, то есть включает `id` и `groupId`; присланный
 *   в теле `groupId` переписал бы настройки другой группы.
 *
 * Поля необязательны: `strict` — про ЛИШНИЕ поля, а не про обязательные, и
 * смешивать эти два свойства нельзя. `ReminderSettingsCard.tsx` сохраняет
 * напоминания целиком, но уведомления отправляет по одному полю на тумблер;
 * схема с обязательными полями выключила бы все четыре тумблера.
 *
 * Остаётся известный край, к этой задаче не относящийся: `upsert` создаёт
 * запись из того же объекта, и у `messageTemplate` нет значения по умолчанию —
 * частичный PUT по группе, где записи ещё нет, падает 500. Так было и до
 * валидации; строчка про это есть в `tech_debt/02-route-input-validation.md`.
 */
export const reminderSettingsBody = bodyContract(
  strictPartialBodyShape({
    isEnabled: z.boolean(),
    intervalDays: z.number().int().min(1).max(30),
    messageTemplate: z.string().trim().min(1).max(2000),
    minDebtAge: z.number().int().min(0).max(365),
    maxReminders: z.number().int().min(1).max(50),
  }),
);

export const adminNotificationSettingsBody = bodyContract(
  strictPartialBodyShape({
    notifyOnNewUser: z.boolean(),
    notifyOnNewPoll: z.boolean(),
    notifyOnPollEnd: z.boolean(),
    notifyOnDebtPaid: z.boolean(),
  }),
);

/**
 * Контракты входа для `/api/suggestions`.
 *
 * `groupId` тут НЕ отдан контракту целиком, и это осознанно: контроллер берёт
 * его из `params`, потом из `query`, потом из `body` (`resolveGroupId`). Порядок
 * источников — правило домена, а не валидация, и контракт по одному источнику
 * его бы сломал. Контракты проверяют форму в каждом источнике по отдельности,
 * а выбор источника остаётся в контроллере.
 */
import { z } from 'zod';

import { bodyContract } from '../middleware/validate';
import {
  bodyShape,
  groupScopedQuery,
  idParams,
  numericId,
  optionalNonNegativeInt,
  optionalPositiveInt,
} from './common';

// ---------------------------------------------------------------- params

export const suggestionIdParam = idParams('id');

// ----------------------------------------------------------------- query

/**
 * `status` был строкой без проверки: `?status=мусор` уходил в сервис как
 * фильтр и молча давал пустой список вместо ошибки.
 */
export const suggestionsQuery = groupScopedQuery({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  limit: optionalPositiveInt,
  offset: optionalNonNegativeInt,
});

/**
 * Для /stats и /pending-count. Проверяется только ФОРМА `groupId`:
 * обязательность остаётся за `resolveGroupId` — параметр может прийти и из
 * тела, а схема query о теле ничего не знает.
 */
export const suggestionGroupQuery = groupScopedQuery();

// ------------------------------------------------------------------ body

export const createSuggestionBody = bodyContract(
  bodyShape({
    name: z.string().trim().min(1, 'Название блюда обязательно').max(200),
    description: z.string().trim().max(1000).optional(),
    /* `parseFloat(price)` принимал строку — контракт тоже, через `coerce`. */
    price: z.coerce.number().finite().min(0).optional(),
    imageUrl: z.string().trim().max(2000).optional(),
    groupId: numericId,
  }),
  {
    default: 'VALIDATION_ERROR',
    byField: { groupId: 'MISSING_GROUP_ID' },
  },
);

export const rejectSuggestionBody = bodyContract(
  bodyShape({
    reason: z.string().trim().max(500).optional(),
    groupId: optionalPositiveInt,
  }),
);

/** approve и delete тела не несут, но `groupId` в нём допустим. */
export const suggestionGroupBody = bodyContract(
  bodyShape({ groupId: optionalPositiveInt }),
);

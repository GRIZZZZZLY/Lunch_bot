/**
 * Контракты входа для `/api/polls`.
 *
 * Каждый контракт — один объект: его `middleware` стоит в цепочке роутера, его
 * `get(req)` читает контроллер. Схемы объявлены здесь модульными константами, а
 * не создаются на месте: контракт запоминает разобранное значение по ссылке на
 * схему, поэтому две вызванные фабрики дали бы два разных слота и лишний разбор.
 */
import { z } from 'zod';

import { bodyContract, queryContract } from '../middleware/validate';
import {
  bodyShape,
  groupScopedQuery,
  idParams,
  numericId,
  optionalNonNegativeInt,
  optionalPositiveInt,
  queryShape,
} from './common';

// ---------------------------------------------------------------- params

export const pollIdParam = idParams('id');
export const pollGroupIdParam = idParams('groupId');
export const pollUserIdParam = idParams('userId');

// ----------------------------------------------------------------- query

/**
 * `limit`/`offset` раньше разбирались как `parseInt(...) || 20`: `?limit=abc`
 * молча превращался в 20, а `?limit=-5` уходил в сервис как есть. Теперь и то,
 * и другое — 400.
 */
export const pollHistoryQuery = queryContract(
  queryShape({
    limit: optionalPositiveInt,
    offset: optionalNonNegativeInt,
  }),
  {
    default: 'VALIDATION_ERROR',
    byField: { groupId: 'INVALID_GROUP_ID', limit: 'INVALID_LIMIT' },
  },
);

/** Только групповой фильтр: /stats, /last-completed, /active. */
export const pollGroupQuery = groupScopedQuery();

/**
 * `groupId` здесь ОБЯЗАТЕЛЕН — так было и раньше, и код тот же
 * (`MISSING_GROUP_ID`): контроллер отдавал его и за отсутствующий, и за
 * испорченный параметр.
 */
export const popularItemsQuery = queryContract(
  queryShape({
    groupId: numericId,
    limit: optionalPositiveInt,
  }),
  {
    default: 'VALIDATION_ERROR',
    byField: { groupId: 'MISSING_GROUP_ID', limit: 'INVALID_LIMIT' },
  },
);

// ------------------------------------------------------------------ body

export const createPollBody = bodyContract(
  bodyShape({
    groupId: numericId,
    duration: z.coerce.number().int().min(1).max(1440).optional(),
    title: z.string().trim().max(200).optional(),
    description: z.string().trim().max(500).optional(),
    isMultiSelect: z.boolean().optional(),
    maxSelections: z.coerce.number().int().min(1).max(3).optional(),
  }),
  { default: 'VALIDATION_ERROR', byField: { groupId: 'MISSING_GROUP_ID' } },
);

/**
 * `selectedMenuItems` раньше «чистился» так:
 * `.map(parseInt).filter(id => !isNaN(id))` — мусор в списке молча исчезал, и
 * голосование создавалось по случайному подмножеству блюд. Теперь это 400.
 */
export const createPollFromWebAppBody = bodyContract(
  bodyShape({
    groupId: numericId,
    duration: z.coerce.number().int().min(1).max(1440).optional(),
    selectedMenuItems: z.array(numericId).optional(),
    title: z.string().trim().max(200).optional(),
    isMultiSelect: z.boolean().optional(),
    maxSelections: z.coerce.number().int().optional(),
  }),
  {
    default: 'VALIDATION_ERROR',
    byField: { groupId: 'INVALID_GROUP_ID', duration: 'INVALID_DURATION' },
  },
);

export const cancelPollBody = bodyContract(
  bodyShape({ reason: z.string().max(500).optional() }),
);

export const voteBody = bodyContract(
  bodyShape({ menuItemId: numericId }),
  'INVALID_MENU_ITEM_ID',
);

export const voteMultipleBody = bodyContract(
  bodyShape({
    menuItemIds: z
      .array(numericId)
      .min(1, 'Invalid menu item IDs. Must be a non-empty array.'),
  }),
  'INVALID_MENU_ITEM_IDS',
);

/**
 * `minVotes`/`maxWinners` объявлены без `coerce` намеренно: контроллер требовал
 * именно `typeof === 'number'`, и ослаблять контракт заодно с переносом
 * проверки — значит потерять возможность заметить, что именно сломалось.
 */
export const completeMultiWinnerBody = bodyContract(
  bodyShape({
    minVotes: z.number().int().min(0).max(100).optional(),
    maxWinners: z.number().int().min(1).max(50).nullable().optional(),
    tieBreakMethod: z.enum(['earliest', 'alphabetical']).optional(),
  }),
);

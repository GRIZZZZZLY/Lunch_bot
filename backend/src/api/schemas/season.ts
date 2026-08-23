/**
 * Контракты входа для `/api/seasons`.
 */
import { queryContract } from '../middleware/validate';
import {
  idParams,
  numericId,
  optionalPositiveInt,
  queryShape,
} from './common';

// ---------------------------------------------------------------- params

export const seasonIdParam = idParams('id');
export const seasonUserIdParam = idParams('userId');

/**
 * `/:id/stats/:userId` несёт оба параметра, и оба в одной схеме — так ошибка в
 * любом из них даёт 400 с указанием поля, а не общее «Invalid season ID or
 * user ID», по которому нельзя понять, что именно неверно.
 */
export const seasonUserStatsParams = idParams('id', 'userId');

// ----------------------------------------------------------------- query

export const seasonListQuery = queryContract(
  queryShape({ limit: optionalPositiveInt }),
  { default: 'VALIDATION_ERROR', byField: { limit: 'INVALID_LIMIT' } },
);

/**
 * Лидерборд требует `groupId` — рейтинг сезона виден участникам группы.
 * Раньше контроллер отвечал за это строкой `'groupId is required'` без кода;
 * теперь код есть, и он тот же, что на остальных маршрутах.
 */
export const seasonLeaderboardQuery = queryContract(
  queryShape({ groupId: numericId, limit: optionalPositiveInt }),
  {
    default: 'VALIDATION_ERROR',
    byField: { groupId: 'MISSING_GROUP_ID', limit: 'INVALID_LIMIT' },
  },
);

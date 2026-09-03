/**
 * Контракты входа для `/api/groups/:groupId/stores` — справочника магазинов.
 */
import { z } from 'zod';

import { bodyContract } from '../middleware/validate';
import { bodyShape, idParams } from './common';

export const groupStoreListParams = idParams('groupId');
export const groupStoreItemParams = idParams('groupId', 'id');

/**
 * Переименование. Поле одно и оно обязательное: скрытие живёт на `DELETE`, а
 * прочих полей у магазина нет — их отсутствие было решением, а не упущением.
 */
export const renameGroupStoreBody = bodyContract(
  bodyShape({
    name: z.string().min(1).max(100),
  }),
);

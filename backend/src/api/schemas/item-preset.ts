/**
 * Контракты входа для `/api/user/item-presets` — личного списка товаров.
 */
import { z } from 'zod';

import { bodyContract } from '../middleware/validate';
import { bodyShape, groupScopedQuery, idParams, optionalPositiveInt } from './common';

export const itemPresetIdParam = idParams('id');

/** `storeId` подсказывает, что поднять наверх; без него список просто по свежести. */
export const itemPresetListQuery = groupScopedQuery({
  storeId: optionalPositiveInt,
});

/**
 * Границы полей держатся вровень с позицией забега (`store-run.ts`): пресет —
 * это заготовка позиции, и разъехавшиеся пределы означали бы, что сохранённый
 * товар нельзя добавить.
 */
export const updateItemPresetBody = bodyContract(
  bodyShape({
    name: z.string().min(1).max(200).optional(),
    quantity: z.number().int().min(1).max(99).optional(),
    notes: z.string().max(500).nullish(),
    pinned: z.boolean().optional(),
  }),
);

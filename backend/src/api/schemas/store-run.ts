/**
 * Контракты входа для `/api/store-runs`.
 *
 * Схемы тел перенесены из `store-run.controller.ts` без изменения формы: это
 * был единственный контроллер в проекте, который уже валидировал тело через
 * zod. Изменилось место и форма ОТВЕТА: раньше он отдавал
 * `{ error: 'Invalid input', issues }` — без `code` и без `success`, то есть
 * фронт не мог выбрать по нему текст. Теперь ответ такой же, как у остальных
 * маршрутов.
 */
import { z } from 'zod';

import { bodyContract } from '../middleware/validate';
import { bodyShape, idParams } from './common';

// ---------------------------------------------------------------- params

export const storeRunIdParam = idParams('id');

/**
 * Маршруты позиций несут ОБА параметра, и схема проверяет оба.
 *
 * Прежний `getIdParam(req, 'itemId')` читал только `itemId`: запрос
 * `PATCH /store-runs/abc/items/5` проходил валидацию, потому что мусорный `:id`
 * никто не смотрел. Сервис работает по `itemId`, так что данные не портились,
 * но 400 на явно неверный путь — правильный ответ.
 */
export const storeRunItemParams = idParams('id', 'itemId');

// ------------------------------------------------------------------ body

export const createStoreRunBody = bodyContract(
  bodyShape({
    groupId: z.number().int().positive(),
    storeName: z.string().min(1).max(100),
    collectMinutes: z.number().int().min(3).max(30),
  }),
);

export const addStoreRunItemsBody = bodyContract(
  bodyShape({
    items: z
      .array(
        z.object({
          name: z.string().min(1).max(200),
          quantity: z.number().int().min(1).max(99).optional(),
          notes: z.string().max(500).nullish(),
        }),
      )
      .min(1)
      .max(20),
  }),
);

export const updateStoreRunItemBody = bodyContract(
  bodyShape({
    name: z.string().min(1).max(200).optional(),
    quantity: z.number().int().min(1).max(99).optional(),
    notes: z.string().max(500).nullish(),
  }),
);

export const setStoreRunItemPriceBody = bodyContract(
  bodyShape({
    price: z.number().min(0).max(100000).nullable(),
    status: z.enum(['BOUGHT', 'NOT_FOUND']),
  }),
);

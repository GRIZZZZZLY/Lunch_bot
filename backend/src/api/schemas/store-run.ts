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
import { bodyShape, groupScopedQuery, idParams } from './common';

// ---------------------------------------------------------------- query

/** `GET /api/store-runs/active?groupId=` — активные забеги одной команды. */
export const storeRunGroupQuery = groupScopedQuery();

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

/**
 * `storeName` перестал быть обязательным: магазин можно выбрать из справочника
 * группы, и тогда имя приходит оттуда. Требование «хоть что-то из двух» выражено
 * `superRefine`, а не двумя обязательными полями, — иначе выбор чипа заставлял бы
 * клиент дублировать имя, которое сервер всё равно возьмёт из своей записи.
 */
export const createStoreRunBody = bodyContract(
  bodyShape({
    groupId: z.number().int().positive(),
    storeId: z.number().int().positive().nullish(),
    storeName: z.string().min(1).max(100).nullish(),
    collectMinutes: z.number().int().min(3).max(30),
  }).superRefine((value, ctx) => {
    const body = value as { storeId?: number | null; storeName?: string | null };
    /* Именно `== null`, а не проверка на пустоту: пустая строка уже отклонена
       правилом `min(1)`, и вторая жалоба на то же поле сделала бы ответ парой
       ошибок про одно и то же. Здесь ловится другой случай — не пришло НИЧЕГО. */
    if (body.storeId == null && body.storeName == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['storeName'],
        message: 'storeName or storeId is required',
      });
    }
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

/**
 * Контракты входа для категорийных заказов (`/api/category-orders`,
 * `/api/order-items`, `/api/polls/:pollId/category-orders`).
 */
import { z } from 'zod';

import { bodyContract } from '../middleware/validate';
import { bodyShape, idParams, money, numericId } from './common';

// ---------------------------------------------------------------- params

export const categoryOrderPollIdParam = idParams('pollId');

/**
 * `:id` тут означает разные сущности на разных маршрутах — категорийный заказ
 * или позицию, — но проверка одна и та же (целое положительное), поэтому
 * контракт один. Кому именно принадлежит `:id`, решает авторизация на маршруте
 * (`requireCategoryOrderResponsible` против `requireOrderItemGroupAdmin`), и
 * это разделение уже описано в `category-order.routes.ts`.
 */
export const categoryOrderIdParam = idParams('id');

// ------------------------------------------------------------------ body

export const saveOrderItemBody = bodyContract(
  bodyShape({
    userId: numericId,
    itemName: z.string().trim().min(1, 'itemName is required'),
    price: z.coerce.number().finite().positive(),
    notes: z.string().trim().optional(),
  }),
);

/**
 * Суммы необязательны, и пустая строка означает «не менять» — так вёл себя
 * прежний `parseOptionalCost`, и это поведение сохранено дословно. Отличие
 * одно: раньше проверка жила внутри `try`, бросала `Error` и её ловил
 * вложенный `catch` — то есть валидация была реализована исключениями внутри
 * бизнес-кода.
 */
const optionalCost = z.preprocess(
  value => (value === '' || value === null ? undefined : value),
  money.optional(),
);

export const updateCostsBody = bodyContract(
  bodyShape({
    deliveryCost: optionalCost,
    serviceFee: optionalCost,
    tip: optionalCost,
    notes: z.string().trim().optional(),
  }),
);

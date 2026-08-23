/**
 * Кирпичи, из которых собраны схемы доменов. Каталог `schemas/` выбран вместо
 * штучных middleware рядом с `validation.ts` сознательно: схема — это данные,
 * её можно переиспользовать и вывести из неё тип, а функция-middleware ни того,
 * ни другого не даёт.
 */
import { z } from 'zod';

import type { ApiErrorCode } from '../error-codes';
import { paramsContract, queryContract, type Contract } from '../middleware/validate';

/**
 * Path-параметр-идентификатор.
 *
 * `z.coerce.number()` здесь безопасен именно потому, что за ним идут `int()` и
 * `positive()`: `'abc'` даёт NaN и не проходит `int()`, `''` даёт 0 и не
 * проходит `positive()`, `'1.5'` не проходит `int()`. Без этой пары приведение
 * было бы тихим.
 */
export const numericId = z.coerce.number().int().positive();

/* Заготовки под `telegramId` в path-параметре здесь НЕТ намеренно. Камень
   реальный — `telegramId` выходит за `Number.MAX_SAFE_INTEGER`, и
   `z.coerce.number()` испортил бы его молча, — но ни в одном из восьми
   роутеров этой задачи такого параметра не оказалось. Схема без применения —
   это обещание, которое никто не проверял; появится маршрут — появится и она,
   вместе с тестом. */

/**
 * Необязательное число в query. Пустая строка (`?limit=`) — это «параметр не
 * задан», а не нуль: фронт отправляет такое, когда фильтр сброшен. Без
 * `preprocess` она превратилась бы в 0 и уронила запрос 400-м.
 */
export const optionalPositiveInt = z.preprocess(
  value => (value === '' ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export const optionalNonNegativeInt = z.preprocess(
  value => (value === '' ? undefined : value),
  z.coerce.number().int().min(0).optional(),
);

/** Флаг в query: `?active=true`. Строка, а не boolean — query всегда строки. */
export const optionalBooleanFlag = z.preprocess(
  value => (value === '' ? undefined : value),
  z.enum(['true', 'false', '1', '0']).optional(),
);

/**
 * Базовая схема query.
 *
 * `passthrough` и явный `groupId` — не перестраховка, а обязательное условие:
 * `frontend-new/src/services/api.service.ts` в `buildUrl` подмешивает `groupId`
 * в query КАЖДОГО запроса. Строгая query-схема отдала бы 400 сразу на всех
 * endpoint'ах приложения.
 */
export const baseQuery = z
  .object({
    groupId: optionalPositiveInt,
  })
  .passthrough();

/** Query-схема домена: те же гарантии, что у `baseQuery`, плюс свои поля. */
export function queryShape<T extends z.ZodRawShape>(shape: T) {
  return baseQuery.extend(shape);
}

/**
 * Код ошибки определяется ИМЕНЕМ параметра, а не маршрутом.
 *
 * Это и есть исправление расхождения, названного в задаче: за один и тот же
 * `:id` контроллеры отдавали то `INVALID_ID`, то `INVALID_POLL_ID` — в
 * зависимости от того, кто его писал. Теперь правило одно и оно здесь.
 * Незнакомое имя параметра получает `INVALID_ID`; отдельный текст на фронте
 * появится тогда, когда его добавят и сюда, и в словарь.
 */
const PARAM_CODES: Partial<Record<string, ApiErrorCode>> = {
  id: 'INVALID_ID',
  pollId: 'INVALID_POLL_ID',
  groupId: 'INVALID_GROUP_ID',
  userId: 'INVALID_USER_ID',
  menuItemId: 'INVALID_MENU_ITEM_ID',
  debtId: 'INVALID_DEBT_ID',
};

/**
 * Контракт path-параметров-идентификаторов.
 *
 * Принимает СПИСОК имён, а не одно: у `validateIdParam` из `validation.ts` слот
 * был один на запрос, и на маршруте с двумя id второй вызов молча перетирал бы
 * первый. Здесь оба параметра живут в одной схеме и разбираются вместе.
 */
export function idParams<N extends string>(
  ...names: [N, ...N[]]
): Contract<z.ZodObject<Record<N, typeof numericId>>> {
  const shape = Object.fromEntries(
    names.map(name => [name, numericId]),
  ) as Record<N, typeof numericId>;

  const byField: Partial<Record<string, ApiErrorCode>> = {};
  for (const name of names) {
    byField[name] = PARAM_CODES[name] ?? 'INVALID_ID';
  }

  return paramsContract(z.object(shape), {
    default: byField[names[0]] ?? 'INVALID_ID',
    byField,
  });
}

/** Query только с групповым фильтром — самая частая форма чтения. */
export function groupScopedQuery<T extends z.ZodRawShape>(shape?: T) {
  return queryContract(shape ? queryShape(shape) : baseQuery, {
    default: 'VALIDATION_ERROR',
    byField: { groupId: 'INVALID_GROUP_ID' },
  });
}

/**
 * Схема тела.
 *
 * `passthrough`, а не `strict` и не поведение zod по умолчанию. Причина не в
 * лишних полях от фронта, а в том, что по умолчанию zod ВЫРЕЗАЕТ незаявленные
 * ключи, а разобранное тело подменяет `req.body`. Любое поле, которое схема не
 * перечислила, а контроллер читает, тихо стало бы `undefined` — регрессия
 * страшнее той, которую задача закрывает.
 */
export function bodyShape<T extends z.ZodRawShape>(shape: T) {
  /* `preprocess` — не косметика. `express.json()` разбирает тело только при
     `Content-Type: application/json`; у PATCH/DELETE без тела `req.body`
     остаётся `undefined`, и схема объекта отвечала бы «Expected object,
     received undefined» на совершенно законный запрос. */
  return z.preprocess(
    value => (value === undefined || value === null ? {} : value),
    z.object(shape).passthrough(),
  );
}

/**
 * Тело частичного обновления, где лишние поля ЗАПРЕЩЕНЫ.
 *
 * Общее правило проекта — `passthrough` (см. `bodyShape`), и отступление от
 * него нужно обосновывать. Обоснование одно и оно узкое: тело уходит в Prisma
 * целиком (`update: data`). Там незаявленное поле — не безвредный лишний ключ:
 * если оно совпадает с колонкой, запись меняется не так, как просили (прислать
 * `groupId` в теле настроек — переписать чужую группу), а если не совпадает —
 * Prisma бросает исключение, и клиент получает 500 вместо 400.
 *
 * `partial` здесь не ослабление, а вторая половина того же рассуждения:
 * «строгая» и «обязательная» — РАЗНЫЕ свойства. Первая попытка совместила их,
 * и схема с четырьмя обязательными полями выключила все четыре тумблера
 * уведомлений (`ReminderSettingsCard.tsx` отправляет по одному полю на
 * переключатель). Обязательность полей — дело эндпоинта, а не этого кирпича.
 */
export function strictPartialBodyShape<T extends z.ZodRawShape>(shape: T) {
  return z.preprocess(
    value => (value === undefined || value === null ? {} : value),
    z.object(shape).partial().strict(),
  );
}

/** Денежная сумма: рубли с копейками, не отрицательная, без Infinity/NaN. */
export const money = z.coerce.number().finite().min(0);


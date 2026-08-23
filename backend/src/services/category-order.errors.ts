/**
 * Доменные сбои категорийных заказов как типы.
 *
 * До этого каждый метод обоих сервисов был устроен так: осмысленный
 * `throw new Error('Completed category order costs cannot be changed')` стоял
 * ВНУТРИ `try`, а собственный `catch` метода подменял его на
 * `throw new Error('Failed to update costs')`. Наружу выходила одна и та же
 * безымянная ошибка, и `error-handler` отдавал её как `500 INTERNAL_ERROR` —
 * то есть «расчёт уже закрыт», «категории нет» и «база недоступна» приходили
 * клиенту неразличимыми. Ответственный за категорию видел «Ошибка на сервере»
 * там, где сервер знал причину и мог её назвать.
 *
 * Тот же приём, что в `poll.errors.ts` (задача 05): статус и код несёт класс,
 * `error-handler` распознаёт `BaseError` и отдаёт их наружу. Отличие от 05
 * только в том, что здесь `catch`-блоки не снимаются — они по-прежнему пишут
 * исходную ошибку в журнал, — но перед этим пропускают `BaseError` наружу как
 * есть.
 *
 * Сообщения оставлены ДОСЛОВНО прежними: на них смотрят существующие тесты
 * сервисов. Типизация — добавление статуса и кода, а не смена текста.
 */
import { BaseError } from '../utils/error';

/**
 * Пределы денежных сумм — здесь же, где ошибка, которая о них сообщает.
 *
 * До этого `MAX_ADDITIONAL_COST` был объявлен ОТДЕЛЬНО в
 * `category-order.service.ts` и в `order-calculation.service.ts`, и разойтись им
 * ничто не мешало: проверяют они одну и ту же колонку.
 *
 * Почему не в сервисе, откуда его можно было бы экспортировать. Попытка была, и
 * она молча выключила проверку: `order-calculation.service.test.ts` подменяет
 * модуль `./category-order.service` через `jest.mock`, поэтому импортированная
 * оттуда константа становится `undefined`, а `value > undefined` — всегда
 * `false`. Тест «доставка сверх лимита — расчёт отклоняется» при этом стал
 * зелёным, ничего не проверяя. Модуль ошибок не мокают нигде, и подменять его
 * незачем — здесь константа остаётся собой.
 */
export const MAX_ADDITIONAL_COST = 1_000_000;
export const MAX_ORDER_ITEM_PRICE = 1_000_000;

/** Категорийного заказа с таким id нет. */
export class CategoryOrderNotFoundError extends BaseError {
  constructor(message = 'CategoryOrder not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/** Позиции с таким id нет. */
export class OrderItemNotFoundError extends BaseError {
  constructor(message = 'OrderItem not found') {
    super(message, 404, 'ITEM_NOT_FOUND');
  }
}

/**
 * Расчёт уже закрыт — менять суммы поздно.
 *
 * 409, а не 400: запрос корректен, не позволяет его состояние заказа. Это
 * ровно та ситуация, из-за которой ответственный получал 500 и повторял
 * попытку, вместо того чтобы узнать, что расчёт закрыт.
 */
export class CalculationCompletedError extends BaseError {
  constructor(message = 'Completed category order costs cannot be changed') {
    super(message, 409, 'CALCULATION_COMPLETED');
  }
}

/**
 * Расчёт закрыть нельзя: состав позиций не совпадает с участниками категории
 * либо не выбран ответственный.
 *
 * Самый частый отказ `finalizeCalculation` — и до типизации именно он приходил
 * как `500 FINALIZATION_ERROR`, потому что контроллер ловил ЛЮБУЮ ошибку
 * расчёта и отвечал одним кодом. «Не все заполнили свои позиции» — это не сбой
 * сервера, а состояние, о котором надо сказать человеку.
 */
export class CalculationNotReadyError extends BaseError {
  constructor(message: string) {
    super(message, 409, 'CALCULATION_NOT_READY');
  }
}

/**
 * Запись изменилась между чтением и транзакцией закрытия расчёта.
 *
 * Отдельный класс от `CalculationNotReadyError` намеренно: там пользователю
 * надо что-то дозаполнить, здесь — просто повторить, данные разошлись.
 * `CONFLICT_ERROR` уже существует и на фронте означает ровно это («Данные
 * изменились. Обновите страницу и повторите»).
 */
export class CalculationStateChangedError extends BaseError {
  constructor(message = 'Category order state changed during finalization') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

/** За категорию уже кто-то отвечает — отклик не принят. */
export class ResponsibleAlreadyAssignedError extends BaseError {
  constructor(message = 'CategoryOrder is already assigned') {
    super(message, 409, 'VOLUNTEER_NOT_AVAILABLE');
  }
}

/**
 * Вход не годится: сумма вне диапазона, пустое название позиции.
 *
 * 400, потому что это ошибка ввода. Схема маршрута
 * (`schemas/category-order.ts`) то же самое уже проверяет и отвечает 400 — но
 * проверка в сервисе не лишняя, она последний барьер перед колонкой `DECIMAL`
 * для любого будущего вызывающего (бот, джоб). Раньше этот барьер отвечал 500,
 * то есть выглядел как сбой сервера, а не как «поправьте поле».
 */
export class OrderInputError extends BaseError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

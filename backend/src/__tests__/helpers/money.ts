import { Prisma } from '@prisma/client';

/**
 * Денежная сумма в утверждении: сравнивается ЗНАЧЕНИЕ, а не представление.
 *
 * Зачем это нужно. Колонки денег в схеме — `Decimal`, и расчёт теперь тоже идёт
 * в `Decimal` (иначе `0.1 + 0.2` уезжает в базу как `0.30000000000000004`).
 * Но `toHaveBeenCalledWith({ totalAmount: 650 })` сравнивает `Decimal(650)` с
 * числом `650` строго и падает — при том что записано ровно то, что ожидалось.
 *
 * Соблазн «переписать ожидание под новый тип» (`new Prisma.Decimal(650)`) хуже:
 * тест начал бы утверждать, КАКИМ ОБЪЕКТОМ передана сумма, вместо того чтобы
 * утверждать саму сумму, и сломался бы от любой смены представления. Здесь
 * проверяется то, что важно: сколько денег записано.
 */
export function money(expected: number | string): unknown {
  const target = new Prisma.Decimal(String(expected));

  return {
    asymmetricMatch(actual: unknown): boolean {
      if (actual === null || actual === undefined) return false;
      if (typeof actual === 'object' && !Prisma.Decimal.isDecimal(actual)) {
        return false;
      }

      try {
        return new Prisma.Decimal(String(actual)).equals(target);
      } catch {
        return false;
      }
    },
    toString(): string {
      return `money(${expected})`;
    },
  };
}

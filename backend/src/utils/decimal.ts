import type { Prisma } from '@prisma/client';

type Decimal = Prisma.Decimal;
type JsonValue = Prisma.JsonValue;

/**
 * Утилиты для работы с Decimal типами PostgreSQL
 * 
 * В PostgreSQL поля DECIMAL возвращаются как объекты Decimal,
 * а не как number. Эти утилиты упрощают работу с ними.
 */

/**
 * Безопасный парсинг JSON из Prisma JsonValue
 * @param value - JsonValue из Prisma
 * @returns Распарсенный объект
 */
export function parseJsonValue<T = any>(value: JsonValue | string | null | undefined): T {
  if (value === null || value === undefined) {
    return {} as T;
  }
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value as T;
}

/**
 * Конвертирует Decimal в number
 * @param value - Decimal, number, null или undefined
 * @returns number (0 если null/undefined)
 */
export function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

/**
 * Форматирует денежное значение в строку с валютой
 * @param value - Decimal, number, null или undefined
 * @param currency - Символ валюты (по умолчанию '₽')
 * @returns Отформатированная строка (например, "123.45₽")
 */
export function formatCurrency(
  value: Decimal | number | null | undefined,
  currency: string = '₽'
): string {
  return `${toNumber(value).toFixed(2)}${currency}`;
}

/**
 * Суммирует массив Decimal значений
 * @param values - Массив Decimal или number значений
 * @returns Сумма как number
 */
export function sumDecimals(values: (Decimal | number | null | undefined)[]): number {
  return values.reduce((sum: number, val) => sum + toNumber(val), 0);
}

/**
 * Вычисляет среднее значение массива Decimal
 * @param values - Массив Decimal или number значений
 * @returns Среднее как number (0 если массив пустой)
 */
export function averageDecimals(values: (Decimal | number | null | undefined)[]): number {
  if (values.length === 0) return 0;
  return sumDecimals(values) / values.length;
}

/**
 * Сравнивает два Decimal значения
 * @param a - Первое значение
 * @param b - Второе значение
 * @returns true если a > b
 */
export function isGreaterThan(
  a: Decimal | number | null | undefined,
  b: Decimal | number | null | undefined
): boolean {
  return toNumber(a) > toNumber(b);
}

/**
 * Сравнивает два Decimal значения
 * @param a - Первое значение
 * @param b - Второе значение
 * @returns true если a >= b
 */
export function isGreaterThanOrEqual(
  a: Decimal | number | null | undefined,
  b: Decimal | number | null | undefined
): boolean {
  return toNumber(a) >= toNumber(b);
}

/**
 * Сравнивает два Decimal значения
 * @param a - Первое значение
 * @param b - Второе значение
 * @returns true если a < b
 */
export function isLessThan(
  a: Decimal | number | null | undefined,
  b: Decimal | number | null | undefined
): boolean {
  return toNumber(a) < toNumber(b);
}

/**
 * Сравнивает два Decimal значения
 * @param a - Первое значение
 * @param b - Второе значение
 * @returns true если a === b
 */
export function isEqual(
  a: Decimal | number | null | undefined,
  b: Decimal | number | null | undefined
): boolean {
  return toNumber(a) === toNumber(b);
}

/**
 * Умножает Decimal на число
 * @param value - Decimal значение
 * @param multiplier - Множитель
 * @returns Результат как number
 */
export function multiply(
  value: Decimal | number | null | undefined,
  multiplier: number
): number {
  return toNumber(value) * multiplier;
}

/**
 * Делит Decimal на число
 * @param value - Decimal значение
 * @param divisor - Делитель
 * @returns Результат как number (0 если делитель 0)
 */
export function divide(
  value: Decimal | number | null | undefined,
  divisor: number
): number {
  if (divisor === 0) return 0;
  return toNumber(value) / divisor;
}

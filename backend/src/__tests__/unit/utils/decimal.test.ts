/**
 * Деньги. Файл на 187 строк, через который проходит каждая сумма в продукте, и
 * до задачи 11 у него не было ни одного собственного теста — он проверялся
 * побочно, через сервисы.
 *
 * Главное, что здесь закреплено, — РАЗНИЦА между двумя семействами функций,
 * потому что перепутать их можно молча:
 *
 * - `toDecimal`/`sumMoney` остаются в `Decimal` и годятся для РАСЧЁТА;
 * - `toNumber`/`sumDecimals`/`multiply` сводят к `number` и годятся
 *   только для ОТОБРАЖЕНИЯ.
 *
 * Колонки денег в схеме — `Decimal`. Складывание через `number` даёт
 * `0.1 + 0.2 = 0.30000000000000004`, и именно это уходило в базу до задачи 08.
 */
import { Prisma } from '@prisma/client';

import {
  formatCurrency,
  multiply,
  sumDecimals,
  sumMoney,
  toDecimal,
  toNumber,
} from '../../../utils/decimal';

const dec = (value: string) => new Prisma.Decimal(value);

describe('расчёт остаётся в Decimal', () => {
  it('сумма копеек не приобретает двоичный хвост', () => {
    /* Тот самый случай: в double это 0.30000000000000004. */
    expect(sumMoney([0.1, 0.2]).toString()).toBe('0.3');
    expect(sumDecimals([0.1, 0.2])).not.toBe(0.3);
  });

  it('складывает Decimal, число и строку одинаково', () => {
    expect(sumMoney([dec('10.05'), 20.1, '0.85']).toString()).toBe('31');
  });

  it('пустой список — ноль, а не NaN', () => {
    expect(sumMoney([]).toString()).toBe('0');
  });

  it('null и undefined считаются нулём, а не ломают сумму', () => {
    expect(sumMoney([dec('5.50'), null, undefined]).toString()).toBe('5.5');
  });

  /* `new Decimal(0.1)` унаследовал бы двоичную погрешность — поэтому число
     превращается в строку ДО построения Decimal. */
  it('число приводится через строку, без потери точности', () => {
    expect(toDecimal(0.1).plus(toDecimal(0.2)).toString()).toBe('0.3');
  });

  it('готовый Decimal возвращается как есть по значению', () => {
    expect(toDecimal(dec('12.34')).toString()).toBe('12.34');
  });

  it('null даёт ноль', () => {
    expect(toDecimal(null).toString()).toBe('0');
    expect(toDecimal(undefined).toString()).toBe('0');
  });

  /* Сумма трёх обедов по 333.33 — ровно тот случай, на котором видно разницу
     между расчётом в Decimal и в double. */
  it('999.99 из трёх по 333.33 — точно, без 998.9999999999999', () => {
    expect(sumMoney(['333.33', '333.33', '333.33']).toString()).toBe('999.99');
  });
});

describe('перевод в number — только для отображения', () => {
  it('Decimal становится числом', () => {
    expect(toNumber(dec('123.45'))).toBe(123.45);
  });

  it('null и undefined дают ноль, а не NaN', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });

  it('число проходит без изменений', () => {
    expect(toNumber(42.5)).toBe(42.5);
  });

  it('formatCurrency всегда даёт две цифры после точки', () => {
    expect(formatCurrency(dec('123.4'))).toBe('123.40₽');
    expect(formatCurrency(null)).toBe('0.00₽');
    expect(formatCurrency(dec('10'), '$')).toBe('10.00$');
  });
});

describe('умножение', () => {
  it('умножает на количество', () => {
    expect(multiply(dec('250.50'), 2)).toBe(501);
  });
});

/**
 * Деньги. Через `toDecimal`/`sumMoney` проходит каждая сумма, которая
 * пишется в базу. Колонки денег — `Decimal`; складывание через `number` даёт
 * `0.1 + 0.2 = 0.30000000000000004`, и именно это уходило в базу до задачи 08.
 * Отображение (`toNumber`, `formatCurrency`) здесь не проверяется.
 */
import { Prisma } from '@prisma/client';

import { sumMoney, toDecimal } from '../../../utils/decimal';

const dec = (value: string) => new Prisma.Decimal(value);

describe('расчёт остаётся в Decimal', () => {
  it.each<[string, Parameters<typeof sumMoney>[0], string]>([
    ['копейки без двоичного хвоста', [0.1, 0.2], '0.3'],
    ['Decimal, число и строка складываются одинаково', [dec('10.05'), 20.1, '0.85'], '31'],
    ['три обеда по 333.33', ['333.33', '333.33', '333.33'], '999.99'],
    ['пустой список — ноль, а не NaN', [], '0'],
    ['null и undefined считаются нулём', [dec('5.50'), null, undefined], '5.5'],
  ])('sumMoney: %s', (_name, values, expected) => {
    expect(sumMoney(values).toString()).toBe(expected);
  });

  /* `new Decimal(0.1)` унаследовал бы двоичную погрешность — поэтому число
     превращается в строку ДО построения Decimal. */
  it('toDecimal строит число через строку, а пустое значение даёт ноль', () => {
    expect(toDecimal(0.1).plus(toDecimal(0.2)).toString()).toBe('0.3');
    expect(toDecimal(null).toString()).toBe('0');
    expect(toDecimal(undefined).toString()).toBe('0');
  });
});

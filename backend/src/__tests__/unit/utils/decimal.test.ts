/**
 * Деньги. Файл на 187 строк, через который проходит каждая сумма в продукте, и
 * до задачи 11 у него не было ни одного собственного теста — он проверялся
 * побочно, через сервисы.
 *
 * Главное, что здесь закреплено, — РАЗНИЦА между двумя семействами функций,
 * потому что перепутать их можно молча:
 *
 * - `toDecimal`/`sumMoney` остаются в `Decimal` и годятся для РАСЧЁТА;
 * - `toNumber`/`sumDecimals`/`multiply`/`divide` сводят к `number` и годятся
 *   только для ОТОБРАЖЕНИЯ.
 *
 * Колонки денег в схеме — `Decimal`. Складывание через `number` даёт
 * `0.1 + 0.2 = 0.30000000000000004`, и именно это уходило в базу до задачи 08.
 */
import { Prisma } from '@prisma/client';

import {
  averageDecimals,
  divide,
  formatCurrency,
  isEqual,
  isGreaterThan,
  isGreaterThanOrEqual,
  isLessThan,
  multiply,
  parseJsonValue,
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

  it('среднее по пустому списку — ноль, а не деление на ноль', () => {
    expect(averageDecimals([])).toBe(0);
  });

  it('среднее считается по числу элементов, включая нулевые', () => {
    expect(averageDecimals([dec('10'), dec('20'), 0])).toBe(10);
  });
});

describe('сравнения', () => {
  it.each([
    ['больше', isGreaterThan, dec('10'), dec('5'), true],
    ['не больше равного', isGreaterThan, dec('5'), dec('5'), false],
    ['больше или равно', isGreaterThanOrEqual, dec('5'), dec('5'), true],
    ['меньше', isLessThan, dec('1.5'), dec('2'), true],
    ['равно', isEqual, dec('7.00'), 7, true],
  ])('%s', (_label, compare, a, b, expected) => {
    expect(compare(a as never, b as never)).toBe(expected);
  });

  /* Отсутствующее значение — ноль: иначе сравнение с null давало бы false в обе
     стороны, и «долг не меньше нуля» проходило бы для несуществующего долга. */
  it('отсутствующее значение сравнивается как ноль', () => {
    expect(isGreaterThan(dec('0.01'), null)).toBe(true);
    expect(isEqual(null, 0)).toBe(true);
  });
});

describe('умножение и деление', () => {
  it('умножает на количество', () => {
    expect(multiply(dec('250.50'), 2)).toBe(501);
  });

  /* Деление на ноль даёт 0, а не Infinity: делитель здесь — число участников,
     и «Infinity рублей с человека» в интерфейсе хуже нуля. */
  it('деление на ноль даёт ноль, а не Infinity', () => {
    expect(divide(dec('100'), 0)).toBe(0);
  });

  it('делит на число участников', () => {
    expect(divide(dec('300'), 3)).toBe(100);
  });

  /**
   * Деление НЕ остаётся в Decimal — 1000/3 в double даёт 333.3333333333333, и
   * трижды по столько уже не равно 1000. Это известное ограничение, записанное
   * в `tech_debt/08`: политика округления при делении денег — продуктовое
   * решение, а не побочный эффект рефакторинга. Тест фиксирует поведение КАК
   * ЕСТЬ, чтобы смена политики была видна как смена теста.
   */
  it('деление теряет точность — поведение зафиксировано как есть', () => {
    const share = divide(dec('1000'), 3);

    // Точное частное непредставимо: доля — периодическая дробь.
    expect(share).toBeCloseTo(333.3333333, 7);
    expect(Number.isInteger(share * 100)).toBe(false);

    /* Именно здесь теряется рубль: доля, округлённая до копеек (а показать и
       записать в долг можно только её), трижды даёт 999.99, а не 1000. Кто
       доплачивает копейку — продуктовое решение, и его тут нет. */
    const rounded = Math.round(share * 100) / 100;
    expect(rounded * 3).toBeCloseTo(999.99, 2);
    expect(rounded * 3).not.toBe(1000);
  });
});

describe('parseJsonValue', () => {
  it('строка разбирается как JSON', () => {
    expect(parseJsonValue<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('готовый объект возвращается как есть', () => {
    const value = { winners: [1, 2] };
    expect(parseJsonValue(value)).toBe(value);
  });

  /* Пустой объект вместо null: вызывающие читают поля сразу, без проверки. */
  it('null и undefined дают пустой объект', () => {
    expect(parseJsonValue(null)).toEqual({});
    expect(parseJsonValue(undefined)).toEqual({});
  });

  it('битая строка бросает — молча пустой объект скрыл бы порчу данных', () => {
    expect(() => parseJsonValue('{не json')).toThrow();
  });
});

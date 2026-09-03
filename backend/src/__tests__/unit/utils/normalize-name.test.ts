import { normalizeName } from '../../../utils/normalize-name';

describe('normalizeName', () => {
  it('приводит регистр', () => {
    expect(normalizeName('Пятёрочка')).toBe(normalizeName('ПЯТЁРОЧКА'));
    expect(normalizeName('Milk')).toBe('milk');
  });

  it('срезает края и схлопывает внутренние пробелы', () => {
    expect(normalizeName('  Магнит   у   офиса ')).toBe('магнит у офиса');
  });

  it('считает ё и е одной буквой', () => {
    expect(normalizeName('Пятёрочка')).toBe('пятерочка');
    expect(normalizeName('пятерочка')).toBe(normalizeName('пятёрочка'));
  });

  it('схлопывает табы и переводы строк как пробелы', () => {
    expect(normalizeName('Лента\tна\nуглу')).toBe('лента на углу');
  });

  it('различает разные имена', () => {
    expect(normalizeName('Магнит')).not.toBe(normalizeName('Магнолия'));
  });

  it('на пустом вводе возвращает пустую строку', () => {
    expect(normalizeName('   ')).toBe('');
    expect(normalizeName('')).toBe('');
  });

  it('не трогает цифры и знаки внутри имени', () => {
    expect(normalizeName('Пятёрочка №5')).toBe('пятерочка №5');
  });
});

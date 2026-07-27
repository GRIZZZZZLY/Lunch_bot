import { describe, expect, it } from 'vitest';
import { isSameLocalDay } from '../date';

describe('isSameLocalDay', () => {
  const reference = new Date(2026, 6, 27, 14, 0, 0); // 27 июля 2026, местное время

  it('те же сутки — да, даже на границах', () => {
    expect(isSameLocalDay(new Date(2026, 6, 27, 0, 0, 0), reference)).toBe(true);
    expect(isSameLocalDay(new Date(2026, 6, 27, 23, 59, 59), reference)).toBe(true);
  });

  it('другие сутки — нет', () => {
    expect(isSameLocalDay(new Date(2026, 6, 26, 23, 59, 59), reference)).toBe(false);
    expect(isSameLocalDay(new Date(2026, 6, 28, 0, 0, 1), reference)).toBe(false);
    expect(isSameLocalDay(new Date(2025, 6, 27, 14, 0, 0), reference)).toBe(false);
  });

  it('принимает ISO-строку', () => {
    const iso = new Date(2026, 6, 27, 9, 30, 0).toISOString();
    expect(isSameLocalDay(iso, reference)).toBe(true);
  });

  it('пустое и битое значение — нет', () => {
    expect(isSameLocalDay(null, reference)).toBe(false);
    expect(isSameLocalDay(undefined, reference)).toBe(false);
    expect(isSameLocalDay('не дата', reference)).toBe(false);
  });
});

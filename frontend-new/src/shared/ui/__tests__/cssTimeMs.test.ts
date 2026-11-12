import { describe, expect, it } from 'vitest';
import { cssTimeMs } from '../FlipGroup';

/* Продакшен-минификатор отдаёт токены времени в секундах (.2s), дев — как
   написано (200ms). FlipGroup должен понимать оба. */
describe('cssTimeMs', () => {
  it('читает миллисекунды', () => {
    expect(cssTimeMs('200ms', 0)).toBe(200);
  });

  it('читает секунды, как их отдаёт сжатый CSS', () => {
    expect(cssTimeMs('.2s', 0)).toBe(200);
    expect(cssTimeMs(' 0.26s ', 0)).toBe(260);
  });

  it('без числа берёт запасное значение', () => {
    expect(cssTimeMs('', 200)).toBe(200);
    expect(cssTimeMs('var(--x)', 200)).toBe(200);
  });
});

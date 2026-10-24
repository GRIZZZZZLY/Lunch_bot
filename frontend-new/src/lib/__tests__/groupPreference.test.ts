/**
 * Какую команду открыть при запуске.
 *
 * Раньше выбор нигде не сохранялся, и `bootstrapAuth` каждый раз брал первую
 * команду с флагом `isActive` — а это флаг самой ГРУППЫ, не выбор человека, —
 * либо просто первую в списке. Человек из двух команд каждый раз попадал не
 * туда, куда шёл.
 *
 * Здесь закреплены две границы: сохранённый выбор уважается, но только если
 * он подтверждён актуальным списком членств, и недоступность localStorage не
 * ломает запуск.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  readPreferredGroupId,
  resolveInitialGroupId,
  writePreferredGroupId,
} from '../groupPreference';

const GROUPS = [
  { id: 5, isActive: false },
  { id: 7, isActive: true },
];

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('resolveInitialGroupId', () => {
  it('сохранённый выбор побеждает флаг isActive', () => {
    expect(resolveInitialGroupId(GROUPS, '5')).toBe('5');
  });

  /* Из команды могли исключить, пока приложение было закрыто. Подставить её
     id значило бы уйти в 403 на первом же запросе. */
  it('выбор, которого больше нет в членствах, отбрасывается', () => {
    expect(resolveInitialGroupId(GROUPS, '999')).toBe('7');
  });
});

describe('чтение и запись выбора', () => {
  /* В Telegram WebView localStorage может быть недоступен. Невозможность
     запомнить выбор не повод ломать запуск. */
  it('недоступное хранилище не ломает чтение', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(readPreferredGroupId(42)).toBeNull();
  });

  it('недоступное хранилище не ломает запись', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => writePreferredGroupId(42, '7')).not.toThrow();
  });
});

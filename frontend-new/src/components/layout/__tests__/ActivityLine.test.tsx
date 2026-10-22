import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ActivityLine } from '../ActivityLine';

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-09-24T12:00:00.000Z') });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('ActivityLine', () => {
  it('таймер истёк, а сервер ещё не закрыл — «завершается», не нули', () => {
    const { container } = render(<ActivityLine activity={{ pollEndsAt: '2026-09-24T11:59:00.000Z' }} />);
    expect(container).toHaveTextContent('Голосуем · завершается…');
  });
});

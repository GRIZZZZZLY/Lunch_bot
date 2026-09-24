import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ActivityLine } from '../ActivityLine';

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-09-24T12:00:00.000Z') });
});
afterEach(() => {
  vi.useRealTimers();
});

const inFuture = '2026-09-24T12:12:41.000Z';

describe('ActivityLine', () => {
  it('голосование — живой остаток времени', () => {
    const { container } = render(<ActivityLine activity={{ pollEndsAt: inFuture }} />);
    expect(container).toHaveTextContent('Голосуем · 12:41');
  });

  it('таймер истёк, а сервер ещё не закрыл — «завершается», не нули', () => {
    const { container } = render(<ActivityLine activity={{ pollEndsAt: '2026-09-24T11:59:00.000Z' }} />);
    expect(container).toHaveTextContent('Голосуем · завершается…');
  });

  it('голосование и закупка — через запятую', () => {
    const { container } = render(
      <ActivityLine activity={{ pollEndsAt: inFuture, run: { id: 601, status: 'COLLECTING' } }} />,
    );
    expect(container).toHaveTextContent('Голосуем · 12:41, закупка · сбор');
  });

  it('ничего не идёт — «Тихо»', () => {
    const { container } = render(<ActivityLine activity={{}} />);
    expect(container).toHaveTextContent('Тихо');
  });
});

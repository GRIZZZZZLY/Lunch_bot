/* Отрыв талона: голосование закрылось — карточка не исчезает мгновенно, а
   уходит по перфорации. Проверяем именно задержку размонтирования: сама
   анимация живёт в CSS, а в jsdom её не увидеть. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { TicketSlot } from '../TicketSlot';
import type { MenuItem, Poll } from '@/types/models';

const MENU: MenuItem[] = [
  { id: 1, name: 'Том-ям с креветками', isActive: true } as MenuItem,
  { id: 2, name: 'Пицца «Маргарита»', isActive: true } as MenuItem,
];

const POLL: Poll & { title?: string } = {
  id: 77,
  groupId: 'g1',
  status: 'ACTIVE',
  duration: 30,
  createdAt: '2026-07-18T12:00:00Z',
  selectedMenuItemIds: [1, 2],
  title: 'Что заказываем на обед?',
};

const m = () => ({ isPending: false, mutate: vi.fn() });

function props(over: Partial<Parameters<typeof TicketSlot>[0]> = {}) {
  return {
    activePoll: POLL,
    allMenu: MENU,
    myChoiceId: null,
    loading: false,
    showSkeleton: false,
    error: null,
    canCreate: true,
    hasGroup: true,
    scheduleHint: null,
    voteMutation: m(),
    withdrawMutation: m(),
    completePoll: m(),
    cancelPoll: m(),
    onExpire: vi.fn(),
    onRetry: vi.fn(),
    onCreate: vi.fn(),
    ...over,
  } as Parameters<typeof TicketSlot>[0];
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.setSystemTime(new Date('2026-07-18T12:05:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('TicketSlot — отрыв талона', () => {
  it('после закрытия голосования талон держится ещё кадр анимации, потом уступает пустому', async () => {
    const { rerender } = render(<TicketSlot {...props()} />);
    expect(screen.getByRole('timer')).toBeInTheDocument();

    rerender(<TicketSlot {...props({ activePoll: null })} />);
    /* Талон ещё на месте — рвётся, но уже спрятан от скринридера: голосования
       нет, и озвучивать уходящую карточку нечего. */
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByRole('timer', { hidden: true })).toBeInTheDocument();
    expect(screen.queryByText('Сегодня ещё не решали')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.queryByRole('timer', { hidden: true })).not.toBeInTheDocument();
    expect(screen.getByText('Сегодня ещё не решали')).toBeInTheDocument();
  });

  it('отменённое голосование не рвут: талон уходит сразу', () => {
    const cancelPoll = m();
    const { rerender } = render(<TicketSlot {...props({ cancelPoll })} />);
    act(() => {
      screen.getByRole('button', { name: 'Отменить' }).click();
    });
    act(() => {
      screen.getByRole('button', { name: 'Отменить голосование' }).click();
    });
    expect(cancelPoll.mutate).toHaveBeenCalledWith({ pollId: 77 });

    rerender(<TicketSlot {...props({ activePoll: null, cancelPoll })} />);
    expect(screen.queryByRole('timer', { hidden: true })).not.toBeInTheDocument();
    expect(screen.getByText('Сегодня ещё не решали')).toBeInTheDocument();
  });
});

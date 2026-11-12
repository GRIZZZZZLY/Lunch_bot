import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Poll } from '@/types/models';
import { TicketSlot } from '../components/TicketSlot';

const poll = {
  id: 501,
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
  duration: 30,
  menuItems: [],
  votes: [],
} as unknown as Poll;

const idle = { isPending: false, mutate: () => undefined };

function props(over: Partial<ComponentProps<typeof TicketSlot>> = {}): ComponentProps<typeof TicketSlot> {
  return {
    activePoll: poll,
    allMenu: [],
    myChoiceId: null,
    loading: false,
    showSkeleton: false,
    error: null,
    canCreate: false,
    hasGroup: true,
    scheduleHint: null,
    voteMutation: idle,
    withdrawMutation: idle,
    completePoll: idle,
    cancelPoll: idle,
    onExpire: () => undefined,
    onRetry: () => undefined,
    onCreate: () => undefined,
    ...over,
  };
}

const card = () => document.getElementById('ticket-heading')!.closest('section')!.parentElement!;

describe('TicketSlot: смена голосования при открытом экране', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('талон, который был при открытии, не проявляется', () => {
    render(<TicketSlot {...props()} />);
    expect(card()).not.toHaveClass('anim-in');
  });

  /* Конец отрыва — сигнал Главной: без него FlipGroup не видит, как место
     талона сжимается, и «Сейчас» прыгает вверх на ~95 px. */
  it('по концу отрыва зовёт onTearEnd и проявляет пустой талон', () => {
    const onTearEnd = vi.fn();
    const { rerender } = render(<TicketSlot {...props({ onTearEnd })} />);
    rerender(<TicketSlot {...props({ onTearEnd, activePoll: null })} />);

    expect(screen.getByText('Обеденный талон')).toBeInTheDocument();
    expect(onTearEnd).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(460);
    });
    expect(onTearEnd).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(card()).toHaveClass('anim-in');
  });

  it('новое голосование проявляется', () => {
    const { rerender } = render(<TicketSlot {...props({ activePoll: null })} />);
    expect(card()).not.toHaveClass('anim-in');
    rerender(<TicketSlot {...props()} />);
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(card()).toHaveClass('anim-in');
  });
});

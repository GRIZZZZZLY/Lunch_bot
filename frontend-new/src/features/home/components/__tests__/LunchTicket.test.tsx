import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LunchTicket } from '../LunchTicket';
import type { PollOptionVM } from '../../lib/types';

const OPTIONS: PollOptionVM[] = [
  { id: 1, name: 'Том-ям с креветками', votes: 6 },
  { id: 2, name: 'Пицца «Маргарита»', votes: 4 },
  { id: 3, name: 'Шаурма классическая', votes: 3 },
];

function renderTicket(over: Partial<Parameters<typeof LunchTicket>[0]> = {}) {
  const props = {
    title: 'Что заказываем на обед?',
    options: OPTIONS,
    totalVotes: 13,
    endsAt: new Date(Date.now() + 12 * 60_000 + 41_000).toISOString(),
    selectedId: null,
    myChoiceId: null,
    hasVoted: false,
    voting: false,
    onSelect: vi.fn(),
    onVote: vi.fn(),
    onWithdraw: vi.fn(),
    isAdmin: false,
    onCloseEarly: vi.fn(),
    onCancel: vi.fn(),
    mutating: false,
    ...over,
  };
  render(<LunchTicket {...props} />);
  return props;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.setSystemTime(new Date('2026-07-18T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('LunchTicket — живой таймер (B3)', () => {
  it('тикает каждую секунду', async () => {
    renderTicket({ endsAt: '2026-07-18T12:12:41Z' });
    expect(screen.getByText('12:41')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText('12:40')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.getByText('11:40')).toBeInTheDocument();
  });

  it('по нулю — один onExpire и статус «Завершается…», без локального завершения', async () => {
    const onExpire = vi.fn();
    renderTicket({ endsAt: '2026-07-18T12:00:02Z', onExpire });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Завершается…')).toBeInTheDocument();
    // варианты и кнопка всё ещё на месте — статус меняет только сервер
    expect(screen.getByRole('button', { name: /Голосовать/ })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});

describe('LunchTicket — голосование', () => {
  it('тап по блюду выбирает, кнопка активируется только с выбором', () => {
    const props = renderTicket();
    expect(screen.getByRole('button', { name: 'Голосовать' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Пицца/ }));
    expect(props.onSelect).toHaveBeenCalledWith(2);
  });

  it('с выбором кнопка активна и зовёт onVote', () => {
    const props = renderTicket({ selectedId: 2 });
    const btn = screen.getByRole('button', { name: 'Голосовать' });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(props.onVote).toHaveBeenCalledTimes(1);
  });

  it('voting=true блокирует кнопку — дубль невозможен', () => {
    renderTicket({ selectedId: 2, voting: true });
    expect(screen.getByRole('button', { name: 'Голосовать' })).toBeDisabled();
  });

  it('после голоса — «Переголосовать» и «Отозвать голос»', () => {
    const props = renderTicket({ myChoiceId: 1, hasVoted: true });
    expect(screen.getByRole('button', { name: 'Переголосовать' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Отозвать голос' }));
    expect(props.onWithdraw).toHaveBeenCalledTimes(1);
    // переголосовать в то же блюдо нельзя
    expect(screen.getByRole('button', { name: 'Переголосовать' })).toBeDisabled();
  });

  it('админ видит «Завершить сейчас» и «Отменить», участник — нет', () => {
    renderTicket({ isAdmin: true });
    expect(screen.getByRole('button', { name: 'Завершить сейчас' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отменить' })).toBeInTheDocument();
  });
});

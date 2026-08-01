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
    myChoiceId: null,
    voting: false,
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

  it('остаток озвучен словами: «12:41» на слух — это время суток', () => {
    renderTicket({ endsAt: '2026-07-18T12:12:41Z' });
    expect(screen.getByRole('timer')).toHaveAccessibleName('До конца голосования 12 мин 41 с');
  });

  it('по нулю — один onExpire и статус «Завершается…», без локального завершения', async () => {
    const onExpire = vi.fn();
    renderTicket({ endsAt: '2026-07-18T12:00:02Z', onExpire });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Завершается…')).toBeInTheDocument();
    // варианты всё ещё на месте — статус меняет только сервер
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});

describe('LunchTicket — голосование в одно касание', () => {
  it('тап по блюду отправляет голос сразу', () => {
    const props = renderTicket();
    fireEvent.click(screen.getByRole('radio', { name: /Пицца/ }));
    expect(props.onVote).toHaveBeenCalledWith(2);
  });

  it('повторный тап по своему же голосу ничего не отправляет', () => {
    const props = renderTicket({ myChoiceId: 2 });
    fireEvent.click(screen.getByRole('radio', { name: /Пицца/ }));
    expect(props.onVote).not.toHaveBeenCalled();
  });

  it('voting=true блокирует строки — дубль невозможен', () => {
    renderTicket({ voting: true });
    screen.getAllByRole('radio').forEach((r) => expect(r).toBeDisabled());
  });

  it('свой голос помечен aria-checked и словами, чужие — нет', () => {
    renderTicket({ myChoiceId: 1 });
    expect(screen.getByRole('radio', { name: /Том-ям/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Пицца/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('ваш голос ·')).toBeInTheDocument();
  });

  it('после голоса на корешке — «Отозвать голос»', () => {
    const props = renderTicket({ myChoiceId: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Отозвать голос' }));
    expect(props.onWithdraw).toHaveBeenCalledTimes(1);
  });

  it('стрелка двигает фокус, но не голосует: выбор здесь — сетевая мутация', () => {
    const props = renderTicket();
    const first = screen.getByRole('radio', { name: /Том-ям/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(screen.getByRole('radio', { name: /Пицца/ })).toHaveFocus();
    expect(props.onVote).not.toHaveBeenCalled();
  });

  it('в фокус-порядок попадает одна строка (roving tabindex)', () => {
    renderTicket({ myChoiceId: 3 });
    const tabbable = screen.getAllByRole('radio').filter((r) => r.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAccessibleName(/Шаурма/);
  });

  it('проценты в сумме дают ровно 100', () => {
    renderTicket({ options: [
      { id: 1, name: 'Плов', votes: 1 },
      { id: 2, name: 'Борщ', votes: 1 },
      { id: 3, name: 'Шаурма', votes: 1 },
    ], totalVotes: 3 });
    const shown = screen.getAllByText(/%$/).map((n) => Number(n.textContent!.replace('%', '')));
    expect(shown).toHaveLength(3);
    expect(shown.reduce((s, n) => s + n, 0)).toBe(100);
  });
});

describe('LunchTicket — штамп голоса', () => {
  function withAnimateSpy() {
    const spy = vi.fn(() => ({}) as Animation);
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = spy;
    return spy;
  }

  it('на монтировании с уже отданным голосом не играет', () => {
    const spy = withAnimateSpy();
    renderTicket({ myChoiceId: 1 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('играет при смене голоса', () => {
    const spy = withAnimateSpy();
    const { rerender } = render(<Harness myChoiceId={null} />);
    expect(spy).not.toHaveBeenCalled();
    rerender(<Harness myChoiceId={2} />);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('молчит при prefers-reduced-motion', () => {
    const spy = withAnimateSpy();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { rerender } = render(<Harness myChoiceId={null} />);
    rerender(<Harness myChoiceId={2} />);
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

function Harness({ myChoiceId }: { myChoiceId: number | null }) {
  return (
    <LunchTicket
      title="Что заказываем на обед?"
      options={OPTIONS}
      totalVotes={13}
      endsAt="2026-07-18T12:12:41Z"
      myChoiceId={myChoiceId}
      voting={false}
      onVote={vi.fn()}
      onWithdraw={vi.fn()}
      isAdmin={false}
      onCloseEarly={vi.fn()}
      onCancel={vi.fn()}
      mutating={false}
    />
  );
}

describe('LunchTicket — админ-действия под подтверждением', () => {
  it('участник админ-кнопок не видит', () => {
    renderTicket();
    expect(screen.queryByRole('button', { name: 'Завершить сейчас' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Отменить' })).not.toBeInTheDocument();
  });

  it('«Отменить» без подтверждения ничего не рушит', () => {
    const props = renderTicket({ isAdmin: true });
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(screen.getByText('Отменить голосование?')).toBeInTheDocument();
    expect(screen.getByText(/Голоса участников будут удалены/)).toBeInTheDocument();
  });

  it('onCancel зовётся только после подтверждения', () => {
    const props = renderTicket({ isAdmin: true });
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Отменить голосование' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('«Завершить сейчас» тоже спрашивает', () => {
    const props = renderTicket({ isAdmin: true });
    fireEvent.click(screen.getByRole('button', { name: 'Завершить сейчас' }));
    expect(props.onCloseEarly).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Завершить' }));
    expect(props.onCloseEarly).toHaveBeenCalledTimes(1);
  });
});

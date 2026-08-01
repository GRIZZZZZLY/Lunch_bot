import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { _resetBackButtonForTests } from '@/lib/backButton';

const h = vi.hoisted(() => ({
  state: {
    debts: [] as unknown[],
    credits: [] as unknown[],
    debtsLoading: false,
    creditsLoading: false,
    debtsError: false,
    creditsError: false,
    debtsRefetch: vi.fn(),
    creditsRefetch: vi.fn(),
    markPaid: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
    cancelMark: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
    confirmPayment: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
    sendReminder: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
  },
}));

/* При отказе запроса data именно undefined — как в TanStack, если ни одна
   попытка не удалась. Компонент опирается на это, отличая «нет данных вовсе»
   от «упал фоновой рефетч поверх уже показанных сумм». */
vi.mock('@/hooks/useBudget', () => ({
  useDebts: () => ({
    data: h.state.debtsError ? undefined : h.state.debts,
    isLoading: h.state.debtsLoading,
    isError: h.state.debtsError,
    refetch: h.state.debtsRefetch,
  }),
  useCredits: () => ({
    data: h.state.creditsError ? undefined : h.state.credits,
    isLoading: h.state.creditsLoading,
    isError: h.state.creditsError,
    refetch: h.state.creditsRefetch,
  }),
  useMarkPaid: () => h.state.markPaid,
  useCancelMark: () => h.state.cancelMark,
  useConfirmPayment: () => h.state.confirmPayment,
  useSendReminder: () => h.state.sendReminder,
}));

import { BudgetPage } from '../BudgetPage';

const tx = (over: Record<string, unknown>) => ({
  id: 1,
  amount: 300,
  status: 'PENDING',
  createdAt: '2026-07-20T11:30:00',
  ...over,
});

beforeEach(() => {
  _resetBackButtonForTests();
  delete window.Telegram;
  h.state.debts = [];
  h.state.credits = [];
  h.state.debtsLoading = false;
  h.state.creditsLoading = false;
  h.state.debtsError = false;
  h.state.creditsError = false;
  h.state.debtsRefetch = vi.fn();
  h.state.creditsRefetch = vi.fn();
  for (const m of [h.state.markPaid, h.state.cancelMark, h.state.confirmPayment, h.state.sendReminder]) {
    Object.assign(m, { mutate: vi.fn(), isPending: false, variables: undefined });
  }
});

describe('BudgetPage — состояния', () => {
  it('пусто → EmptyState', () => {
    render(<BudgetPage />);
    expect(screen.getByText('Нет активных расчётов')).toBeInTheDocument();
  });

  it('загрузка → скелетон, без EmptyState', () => {
    h.state.debtsLoading = true;
    render(<BudgetPage />);
    expect(screen.queryByText('Нет активных расчётов')).not.toBeInTheDocument();
  });

  /* Раньше error никто не читал, данные подставлялись пустым массивом, и сбой
     связи выглядел как «долгов нет» — на денежном экране это ложь. */
  it('отказ чтения → ошибка со повтором, а не «нет расчётов»', () => {
    h.state.debtsError = true;
    render(<BudgetPage />);
    expect(screen.queryByText('Нет активных расчётов')).not.toBeInTheDocument();
    expect(screen.getByText('Не удалось загрузить расчёты')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(h.state.debtsRefetch).toHaveBeenCalled();
  });
});

describe('BudgetPage — должник', () => {
  it('PENDING → «Оплатил» зовёт markPaid(id)', () => {
    h.state.debts = [tx({ id: 7, status: 'PENDING', creditor: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);
    expect(screen.getByText('Оля')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Оплатил: Оля/ }));
    expect(h.state.markPaid.mutate).toHaveBeenCalledWith(7);
  });

  it('PAID → «Отменить отметку» зовёт cancelMark(id), статус «Ждёт»', () => {
    h.state.debts = [tx({ id: 7, status: 'PAID', creditor: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);
    expect(screen.getByText('Ждёт')).toBeInTheDocument();
    // статус говорит только чип — текстового дубля в строке быть не должно
    expect(screen.queryByText(/ждёт подтверждения/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Отменить отметку: Оля/ }));
    expect(h.state.cancelMark.mutate).toHaveBeenCalledWith(7);
  });

  it('сумма долга — отдельный узел, а не хвост подписи с именем', () => {
    h.state.debts = [tx({ id: 7, amount: 420, status: 'PENDING', creditor: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);
    const person = screen.getByText('Оля');
    expect(person.textContent).toBe('Оля');
    // сумма живёт соседним узлом строки, а не суффиксом подписи
    expect(person.closest('div')?.querySelector('.tnum')?.textContent).toBe('420 ₽');
  });

  /* Регрессия на цепочку `??` по variables: markPaid уже завершилась, но её
     variables сохранились, из-за чего занятость залипала на id 7 и кнопка
     строки 8 теряла спиннер вместе с блокировкой — второе касание уходило
     на сервер. */
  it('занятость принадлежит своей строке и своему действию', () => {
    h.state.debts = [
      tx({ id: 7, amount: 420, status: 'PENDING', creditor: { id: 3, firstName: 'Оля' } }),
      tx({ id: 8, amount: 180, status: 'PAID', creditor: { id: 4, firstName: 'Пётр' } }),
    ];
    // завершившаяся ранее мутация оставила после себя variables
    Object.assign(h.state.markPaid, { isPending: false, variables: 7 });
    Object.assign(h.state.cancelMark, { isPending: true, variables: 8 });
    render(<BudgetPage />);

    const cancel = screen.getByRole('button', { name: /^Отменить отметку: Пётр/ });
    expect(cancel).toBeDisabled();
    expect(cancel).toHaveAttribute('aria-busy', 'true');
    // а чужая строка занятой не выглядит
    expect(screen.getByRole('button', { name: /^Оплатил: Оля/ })).toBeEnabled();
  });

  it('CONFIRMED → секция «Долг закрыт»', () => {
    h.state.debts = [tx({ id: 7, status: 'CONFIRMED' })];
    render(<BudgetPage />);
    expect(screen.getByText('Долг закрыт')).toBeInTheDocument();
  });
});

describe('BudgetPage — сборщик', () => {
  it('PAID кредит → «Подтвердить» зовёт confirmPayment(id)', () => {
    h.state.credits = [tx({ id: 9, status: 'PAID', debtor: { id: 2, firstName: 'Ян' } })];
    render(<BudgetPage />);
    expect(screen.getByText('Ян')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Подтвердить: Ян/ }));
    expect(h.state.confirmPayment.mutate).toHaveBeenCalledWith(9);
  });

  it('PENDING кредит → «Напомнить» зовёт sendReminder(id)', () => {
    h.state.credits = [tx({ id: 9, status: 'PENDING', debtor: { id: 2, firstName: 'Ян' } })];
    render(<BudgetPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Напомнить: Ян/ }));
    expect(h.state.sendReminder.mutate).toHaveBeenCalledWith(9);
  });

  it('все рассчитались → секция «Все рассчитались»', () => {
    h.state.credits = [tx({ id: 9, status: 'CONFIRMED' })];
    render(<BudgetPage />);
    expect(screen.getByText('Все рассчитались')).toBeInTheDocument();
  });
});

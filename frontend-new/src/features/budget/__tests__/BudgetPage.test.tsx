import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { _resetBackButtonForTests } from '@/lib/backButton';

const h = vi.hoisted(() => ({
  state: {
    debts: [] as unknown[],
    credits: [] as unknown[],
    debtsLoading: false,
    creditsLoading: false,
    markPaid: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
    cancelMark: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
    confirmPayment: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
    sendReminder: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
  },
}));

vi.mock('@/hooks/useBudget', () => ({
  useDebts: () => ({ data: h.state.debts, isLoading: h.state.debtsLoading }),
  useCredits: () => ({ data: h.state.credits, isLoading: h.state.creditsLoading }),
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
});

describe('BudgetPage — должник', () => {
  it('PENDING → «Оплатил» зовёт markPaid(id)', () => {
    h.state.debts = [tx({ id: 7, status: 'PENDING', creditor: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);
    expect(screen.getByText('Оля')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Оплатил' }));
    expect(h.state.markPaid.mutate).toHaveBeenCalledWith(7);
  });

  it('PAID → «Отменить» зовёт cancelMark(id), статус «Ждёт»', () => {
    h.state.debts = [tx({ id: 7, status: 'PAID', creditor: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);
    expect(screen.getByText('Ждёт')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(h.state.cancelMark.mutate).toHaveBeenCalledWith(7);
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
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
    expect(h.state.confirmPayment.mutate).toHaveBeenCalledWith(9);
  });

  it('PENDING кредит → «Напомнить» зовёт sendReminder(id)', () => {
    h.state.credits = [tx({ id: 9, status: 'PENDING', debtor: { id: 2, firstName: 'Ян' } })];
    render(<BudgetPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Напомнить' }));
    expect(h.state.sendReminder.mutate).toHaveBeenCalledWith(9);
  });

  it('все рассчитались → секция «Все рассчитались»', () => {
    h.state.credits = [tx({ id: 9, status: 'CONFIRMED' })];
    render(<BudgetPage />);
    expect(screen.getByText('Все рассчитались')).toBeInTheDocument();
  });
});

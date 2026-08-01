/* Оптимистичная смена статуса транзакции: применяется до ответа, откатывается
   при отказе. Проверяется на настоящем QueryClient — именно кэш, а не рендер. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transaction } from '@/types/models';
import { queryKeys } from '@/lib/queryClient';

const h = vi.hoisted(() => ({
  markPaid: vi.fn(),
  confirmPayment: vi.fn(),
}));

vi.mock('@/services/budget.service', () => ({
  budgetService: { markPaid: h.markPaid, confirmPayment: h.confirmPayment },
}));

vi.mock('../useAuth', () => ({ useAuth: () => ({ isAuthenticated: true }) }));

import { useConfirmPayment, useMarkPaid } from '../useBudget';

const DEBTS_KEY = queryKeys.budget.debts();
const CREDITS_KEY = queryKeys.budget.credits();

const tx = (over: Partial<Transaction>): Transaction =>
  ({
    id: 1,
    pollId: 1,
    debtorId: 2,
    creditorId: 3,
    amount: 300,
    status: 'PENDING',
    createdAt: '2026-07-20T11:30:00',
    ...over,
  }) as Transaction;

let qc: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const debtStatus = (id: number) =>
  qc.getQueryData<Transaction[]>(DEBTS_KEY)?.find((t) => t.id === id)?.status;
const creditStatus = (id: number) =>
  qc.getQueryData<Transaction[]>(CREDITS_KEY)?.find((t) => t.id === id)?.status;

beforeEach(() => {
  h.markPaid.mockReset();
  h.confirmPayment.mockReset();
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(DEBTS_KEY, [tx({ id: 5, status: 'PENDING' }), tx({ id: 6, status: 'PENDING' })]);
  qc.setQueryData(CREDITS_KEY, [tx({ id: 9, status: 'PAID' })]);
});

describe('useMarkPaid — оптимистичная отметка', () => {
  it('переводит долг в PAID до ответа сервера и не трогает соседний', async () => {
    let release: (() => void) | undefined;
    h.markPaid.mockImplementation(
      () => new Promise((resolve) => { release = () => resolve({ success: true }); }),
    );

    const { result } = renderHook(() => useMarkPaid(), { wrapper });
    result.current.mutate(5);

    await waitFor(() => expect(debtStatus(5)).toBe('PAID'));
    expect(debtStatus(6)).toBe('PENDING');

    release?.();
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('откатывает список к снимку, если сервер отказал', async () => {
    h.markPaid.mockRejectedValue(new Error('нет сети'));

    const { result } = renderHook(() => useMarkPaid(), { wrapper });
    result.current.mutate(5);

    await waitFor(() => expect(result.current.isError).toBe(true));
    // отказ не оставляет долг помеченным: иначе он выглядел бы оплаченным
    expect(debtStatus(5)).toBe('PENDING');
  });
});

describe('useConfirmPayment — оптимистичное подтверждение', () => {
  it('переводит кредит в CONFIRMED, а при отказе возвращает PAID', async () => {
    h.confirmPayment.mockRejectedValue(new Error('нет сети'));

    const { result } = renderHook(() => useConfirmPayment(), { wrapper });
    result.current.mutate(9);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(creditStatus(9)).toBe('PAID');
  });
});

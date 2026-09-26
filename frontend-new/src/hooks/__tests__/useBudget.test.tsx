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

import { useConfirmPayment, useMarkAllPaid, useMarkPaid } from '../useBudget';
import { useToastStore } from '@/store/useToastStore';

/* Команда фиксирована в ключе: хук берёт её из стора, тесты — из этой же
   константы, иначе патч оптимистичного статуса ушёл бы в соседнюю ячейку. */
const GROUP = '100';
const DEBTS_KEY = queryKeys.budget.debts(GROUP);
const CREDITS_KEY = queryKeys.budget.credits(GROUP);

const tx = (over: Partial<Transaction>): Transaction =>
  ({
    id: 1,
    pollId: 1,
    fromUserId: 2,
    toUserId: 3,
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

/* Подтверждение применяется после ответа сервера, а не до: «Закрыт» и «Все
   рассчитались» появлялись раньше, чем сервер соглашался, и при отказе
   откатывались — сборщик успевал сказать команде неправду. */
describe('useConfirmPayment — после ответа сервера', () => {
  it('пока сервер не ответил, кредит остаётся отмеченным', async () => {
    h.confirmPayment.mockImplementation(() => new Promise(() => undefined));

    const { result } = renderHook(() => useConfirmPayment(), { wrapper });
    result.current.mutate(9);

    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(creditStatus(9)).toBe('PAID');
  });

  it('при отказе ничего не меняется', async () => {
    h.confirmPayment.mockRejectedValue(new Error('нет сети'));

    const { result } = renderHook(() => useConfirmPayment(), { wrapper });
    result.current.mutate(9);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(creditStatus(9)).toBe('PAID');
  });

  it('после успеха — CONFIRMED вместе с confirmedAt: строка сразу попадает в «Подтверждено сегодня»', async () => {
    h.confirmPayment.mockResolvedValue({});

    const { result } = renderHook(() => useConfirmPayment(), { wrapper });
    result.current.mutate(9);

    await waitFor(() => expect(creditStatus(9)).toBe('CONFIRMED'));
    const confirmedAt = qc.getQueryData<Transaction[]>(CREDITS_KEY)?.find((t) => t.id === 9)?.confirmedAt;
    expect(Date.now() - new Date(confirmedAt ?? 0).getTime()).toBeLessThan(5_000);
  });
});

describe('useMarkAllPaid — «Отметить все»', () => {
  beforeEach(() => useToastStore.setState({ toasts: [] }));
  const lastToast = () => {
    const toasts = useToastStore.getState().toasts;
    return toasts[toasts.length - 1];
  };

  it('частичный отказ — ошибка с названием неотмеченного долга', async () => {
    h.markPaid.mockImplementation((id: number) => (id === 6 ? Promise.reject(new Error('net')) : Promise.resolve({})));
    const { result } = renderHook(() => useMarkAllPaid(), { wrapper });
    result.current.mutate([
      { id: 5, label: 'Паста, 420 ₽' },
      { id: 6, label: 'Пятёрочка, 180 ₽' },
    ]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastToast()?.type).toBe('error');
    expect(lastToast()?.message).toBe('Не отмечен долг: Пятёрочка, 180 ₽. Отметьте его ещё раз.');
  });

  it('все прошли — успех', async () => {
    h.markPaid.mockResolvedValue({});
    const { result } = renderHook(() => useMarkAllPaid(), { wrapper });
    result.current.mutate([
      { id: 5, label: 'Паста, 420 ₽' },
      { id: 6, label: 'Пятёрочка, 180 ₽' },
    ]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastToast()?.type).toBe('success');
  });
});

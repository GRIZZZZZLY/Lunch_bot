/* Оптимистичная отметка позиции: применяется до ответа, откатывается при
   отказе. Проверяется на настоящем QueryClient — именно кэш, а не рендер. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StoreRunWithRelations } from '@/services/store-run.service';
import { queryKeys } from '@/lib/queryClient';

const h = vi.hoisted(() => ({ setItemPrice: vi.fn(), deleteItem: vi.fn() }));

vi.mock('@/services/store-run.service', () => ({
  storeRunService: { setItemPrice: h.setItemPrice, deleteItem: h.deleteItem },
}));

import { useDeleteStoreItem, useSetItemPrice } from '../useStoreRun';

const RUN_ID = 5;
const KEY = queryKeys.storeRuns.detail(RUN_ID);

function seededRun(): StoreRunWithRelations {
  return {
    id: RUN_ID, groupId: 1, initiatorId: 1, storeName: 'Пятёрочка', status: 'SHOPPING',
    collectUntil: '2026-08-01T09:00:00Z', shoppingAt: '2026-08-01T09:05:00Z',
    settledAt: null, cancelledAt: null, createdAt: '2026-08-01T08:00:00Z', updatedAt: '',
    initiator: { id: 1, firstName: 'Игорь' },
    items: [
      {
        id: 10, storeRunId: RUN_ID, userId: 2, name: 'Молоко', quantity: 1, notes: null,
        price: null, status: 'REQUESTED', createdAt: '', updatedAt: '',
        user: { id: 2, firstName: 'Аня' },
      },
    ],
  };
}

let qc: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const itemStatus = () => qc.getQueryData<StoreRunWithRelations>(KEY)?.items[0].status;
const itemPrice = () => qc.getQueryData<StoreRunWithRelations>(KEY)?.items[0].price;

beforeEach(() => {
  h.setItemPrice.mockReset();
  h.deleteItem.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(KEY, seededRun());
});

describe('useSetItemPrice — оптимистичная отметка', () => {
  it('переводит позицию в BOUGHT до ответа сервера', async () => {
    let release: (() => void) | undefined;
    h.setItemPrice.mockImplementation(
      () => new Promise((resolve) => { release = () => resolve({ success: true, data: null }); }),
    );

    const { result } = renderHook(() => useSetItemPrice(RUN_ID), { wrapper });
    result.current.mutate({ itemId: 10, payload: { price: null, status: 'BOUGHT' } });

    // до ответа: список уже показывает покупку без цены
    await waitFor(() => expect(itemStatus()).toBe('BOUGHT'));
    expect(itemPrice()).toBeNull();

    release?.();
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('откатывает список к снимку, если сервер отказал', async () => {
    h.setItemPrice.mockRejectedValue(new Error('нет сети'));

    const { result } = renderHook(() => useSetItemPrice(RUN_ID), { wrapper });
    result.current.mutate({ itemId: 10, payload: { price: 250, status: 'BOUGHT' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // отказ не оставляет позицию помеченной: иначе она выглядела бы купленной
    expect(itemStatus()).toBe('REQUESTED');
    expect(itemPrice()).toBeNull();
  });
});

/* Удаление позиции применяется оптимистично: строка исчезает сразу, отказ
   возвращает список. Владелец мутации — CollectingView, он живёт дольше строки. */
describe('useDeleteStoreItem — оптимистичное удаление', () => {
  it('строка исчезает до ответа и возвращается при отказе', async () => {
    h.deleteItem.mockRejectedValue(new Error('нет сети'));
    const { result } = renderHook(() => useDeleteStoreItem(RUN_ID), { wrapper });

    expect(qc.getQueryData<StoreRunWithRelations>(KEY)?.items).toHaveLength(1);
    result.current.mutate(10);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData<StoreRunWithRelations>(KEY)?.items.map((i) => i.id)).toEqual([10]);
  });
});

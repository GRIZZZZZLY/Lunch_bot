import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { storeRunService, type StoreItem, type StoreRunWithRelations } from '@/services/store-run.service';
import { _resetBackButtonForTests } from '@/lib/backButton';
import { useAppStore } from '@/store/useAppStore';

const h = vi.hoisted(() => ({
  add: { mutate: vi.fn(), isPending: false },
  update: { mutate: vi.fn(), isPending: false },
  del: { mutate: vi.fn(), isPending: false },
  start: { mutate: vi.fn(), isPending: false },
  cancel: { mutate: vi.fn(), isPending: false },
}));

vi.mock('@/hooks/useStoreRun', async (importOriginal) => ({
  /* Настоящий запрос закупки: по нему видно, сколько раз экран её перечитал. */
  useStoreRun: (await importOriginal<typeof import('@/hooks/useStoreRun')>()).useStoreRun,
  useAddStoreItems: () => h.add,
  useUpdateStoreItem: () => h.update,
  useDeleteStoreItem: () => h.del,
  useStartShopping: () => h.start,
  useCancelStoreRun: () => h.cancel,
}));

import { CollectingView } from '../CollectingView';
import { useStoreRun } from '@/hooks/useStoreRun';

/* Отказ сервера так, как его отдаёт useMutation: onError, затем onSettled. */
const refuse = (_arg: unknown, opts?: { onError?: (e: Error) => void; onSettled?: () => void }) => {
  opts?.onError?.(new Error('нет сети'));
  opts?.onSettled?.();
};

let seq = 0;
function mkItem(userId: number, name: string, over: Partial<StoreItem> = {}): StoreItem {
  seq += 1;
  return {
    id: over.id ?? seq,
    storeRunId: 5,
    userId,
    name,
    quantity: over.quantity ?? 1,
    notes: over.notes ?? null,
    price: null,
    status: 'REQUESTED',
    createdAt: '2026-07-18T12:00:00Z',
    updatedAt: '2026-07-18T12:00:00Z',
    user: { id: userId, firstName: userId === 2 ? 'Аня' : userId === 3 ? 'Пётр' : 'Игорь' },
    ...over,
  };
}

function mkRun(over: Partial<StoreRunWithRelations> = {}): StoreRunWithRelations {
  return {
    id: 5,
    groupId: 1,
    initiatorId: 1,
    storeName: 'Пятёрочка',
    status: 'COLLECTING',
    collectUntil: '2999-01-01T00:00:00Z',
    shoppingAt: null,
    settledAt: null,
    cancelledAt: null,
    createdAt: '2026-07-18T11:50:00Z',
    updatedAt: '2026-07-18T11:50:00Z',
    initiator: { id: 1, firstName: 'Игорь' },
    items: over.items ?? [
      mkItem(2, 'Молоко', { id: 10, quantity: 2 }),
      mkItem(3, 'Хлеб', { id: 11 }),
    ],
    ...over,
  };
}

function renderView(run: StoreRunWithRelations, currentUserId: number | null, extra?: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CollectingView run={run} currentUserId={currentUserId} />
      {extra}
    </QueryClientProvider>,
  );
}

/* Страница закупки держит запрос открытым — как StoreRunPage. */
function RunQuery({ id }: { id: number }) {
  useStoreRun(id, true);
  return null;
}

beforeEach(() => {
  seq = 0;
  _resetBackButtonForTests();
  delete window.Telegram;
  Object.values(h).forEach((m) => {
    m.mutate.mockReset();
    m.isPending = false;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  useAppStore.setState({ authStatus: 'idle' });
});

describe('CollectingView — удаление', () => {
  it('требует подтверждения; mutate вызывается только после confirm', async () => {
    renderView(mkRun(), 3);
    await userEvent.click(screen.getByLabelText('Удалить «Хлеб»'));
    expect(h.del.mutate).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Удалить' }));
    expect(h.del.mutate.mock.calls[0][0]).toBe(11);
  });
});

describe('CollectingView — добавление', () => {
  it('отказ сервера сохраняет введённые данные (sheet не закрывается)', async () => {
    h.add.mutate.mockImplementation(refuse);
    renderView(mkRun(), 3);
    await userEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    await userEvent.type(screen.getByLabelText('Что купить'), 'Яйца');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Что купить')).toHaveValue('Яйца');
  });
});

describe('CollectingView — редактирование', () => {
  it('отказ сервера сохраняет ввод', async () => {
    h.update.mutate.mockImplementation(refuse);
    renderView(mkRun(), 3);
    await userEvent.click(screen.getByLabelText('Изменить «Хлеб»'));
    const input = screen.getByLabelText('Что купить');
    await userEvent.clear(input);
    await userEvent.type(input, 'Хлеб чёрный');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Что купить')).toHaveValue('Хлеб чёрный');
  });
});

describe('CollectingView — countdown', () => {
  it('по истечении перечитывает закупку один раз, а не по кругу; add остаётся', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:00:00Z'));
    useAppStore.setState({ authStatus: 'authenticated' });
    const run = mkRun({
      collectUntil: '2026-07-18T12:00:02Z', // +2с
      createdAt: '2026-07-18T11:58:00Z',
    });
    const getRun = vi
      .spyOn(storeRunService, 'getRun')
      .mockResolvedValue({ data: run } as Awaited<ReturnType<typeof storeRunService.getRun>>);
    renderView(run, 3, <RunQuery id={5} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const loads = getRun.mock.calls.length;

    /* React 19 в act-окружении не сбрасывает обновления, пришедшие из таймера,
       сам по себе: их надо прогнать через act, иначе перерисовки не будет и
       эффект с onExpire не выполнится. */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(getRun.mock.calls.length).toBe(loads + 1);
    expect(screen.getByRole('button', { name: 'Добавить позицию' })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(getRun.mock.calls.length).toBe(loads + 1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StoreItem, StoreRunWithRelations } from '@/services/store-run.service';
import { _resetBackButtonForTests } from '@/lib/backButton';

const h = vi.hoisted(() => ({
  add: { mutate: vi.fn(), isPending: false },
  update: { mutate: vi.fn(), isPending: false },
  del: { mutate: vi.fn(), isPending: false },
  start: { mutate: vi.fn(), isPending: false },
  cancel: { mutate: vi.fn(), isPending: false },
}));

vi.mock('@/hooks/useStoreRun', () => ({
  useAddStoreItems: () => h.add,
  useUpdateStoreItem: () => h.update,
  useDeleteStoreItem: () => h.del,
  useStartShopping: () => h.start,
  useCancelStoreRun: () => h.cancel,
}));

import { CollectingView } from '../CollectingView';

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

function renderView(run: StoreRunWithRelations, currentUserId: number | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const utils = render(
    <QueryClientProvider client={qc}>
      <CollectingView run={run} currentUserId={currentUserId} />
    </QueryClientProvider>,
  );
  return { ...utils, invalidateSpy: spy };
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
});

describe('CollectingView — права', () => {
  it('участник видит edit/delete только на своей позиции', () => {
    renderView(mkRun(), 3); // Пётр владеет «Хлеб» (id 11)
    expect(screen.getByLabelText('Удалить «Хлеб»')).toBeInTheDocument();
    expect(screen.getByLabelText('Изменить «Хлеб»')).toBeInTheDocument();
    expect(screen.queryByLabelText('Удалить «Молоко»')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Изменить «Молоко»')).not.toBeInTheDocument();
  });

  it('участник видит «Добавить», но не видит close/cancel', () => {
    renderView(mkRun(), 3);
    expect(screen.getByRole('button', { name: 'Добавить позицию' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Закрыть сбор' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Отменить закупку' })).not.toBeInTheDocument();
  });

  it('инициатор не видит edit/delete на чужих позициях (B2)', () => {
    renderView(mkRun(), 1); // Игорь-инициатор, своих позиций нет
    expect(screen.queryByLabelText('Удалить «Молоко»')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Удалить «Хлеб»')).not.toBeInTheDocument();
  });

  it('инициатор видит close + cancel + secondary add', () => {
    renderView(mkRun(), 1);
    expect(screen.getByRole('button', { name: 'Закрыть сбор' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отменить закупку' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить позицию' })).toBeInTheDocument();
    expect(screen.getByText('У вас пока нет позиций')).toBeInTheDocument();
  });

  it('единственная primary — «Закрыть сбор» (add у инициатора один, secondary)', () => {
    renderView(mkRun(), 1);
    expect(screen.getAllByRole('button', { name: 'Закрыть сбор' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Добавить позицию' })).toHaveLength(1);
  });
});

describe('CollectingView — empty', () => {
  /* Раньше на пустом сборе primary была заблокирована, и единственной живой
     кнопкой оставалось уничтожение закупки. Пустой экран ведёт к добавлению. */
  it('пусто: главное действие — добавить, «Закрыть сбор» не показывается', () => {
    renderView(mkRun({ items: [] }), 1);
    expect(screen.getByText('Пока пусто')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Закрыть сбор' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Добавить позицию' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Отменить закупку' })).toBeEnabled();
  });
});

describe('CollectingView — удаление', () => {
  it('требует подтверждения; mutate вызывается только после confirm', async () => {
    renderView(mkRun(), 3);
    await userEvent.click(screen.getByLabelText('Удалить «Хлеб»'));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Удалить позицию?')).toBeInTheDocument();
    expect(within(dialog).getByText('Хлеб')).toBeInTheDocument();
    expect(h.del.mutate).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));
    expect(h.del.mutate).toHaveBeenCalledTimes(1);
    expect(h.del.mutate.mock.calls[0][0]).toBe(11);
  });
});

describe('CollectingView — добавление', () => {
  it('валидация: пустое имя не сабмитит', async () => {
    renderView(mkRun(), 3);
    await userEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(screen.getByText('Укажите название')).toBeInTheDocument();
    expect(h.add.mutate).not.toHaveBeenCalled();
  });

  it('success закрывает sheet', async () => {
    h.add.mutate.mockImplementation((_items, opts) => opts?.onSuccess?.());
    renderView(mkRun(), 3);
    await userEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    await userEvent.type(screen.getByLabelText('Что купить'), 'Яйца');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(h.add.mutate).toHaveBeenCalledTimes(1);
    expect(h.add.mutate.mock.calls[0][0]).toEqual([{ name: 'Яйца', quantity: 1 }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('error сохраняет введённые данные (sheet не закрывается)', async () => {
    h.add.mutate.mockImplementation(() => undefined); // onSuccess не вызывается
    renderView(mkRun(), 3);
    await userEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }));
    await userEvent.type(screen.getByLabelText('Что купить'), 'Яйца');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Что купить')).toHaveValue('Яйца');
  });
});

describe('CollectingView — редактирование', () => {
  it('форма предзаполнена и сабмитит PATCH', async () => {
    h.update.mutate.mockImplementation((_arg, opts) => opts?.onSuccess?.());
    renderView(mkRun(), 3);
    await userEvent.click(screen.getByLabelText('Изменить «Хлеб»'));
    const input = screen.getByLabelText('Что купить');
    expect(input).toHaveValue('Хлеб');
    await userEvent.clear(input);
    await userEvent.type(input, 'Хлеб чёрный');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(h.update.mutate).toHaveBeenCalledTimes(1);
    expect(h.update.mutate.mock.calls[0][0]).toEqual({
      itemId: 11,
      data: { name: 'Хлеб чёрный', quantity: 1, notes: undefined },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('error сохраняет ввод', async () => {
    h.update.mutate.mockImplementation(() => undefined);
    renderView(mkRun(), 3);
    await userEvent.click(screen.getByLabelText('Изменить «Хлеб»'));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Что купить')).toHaveValue('Хлеб');
  });
});

describe('CollectingView — инициатор close/cancel', () => {
  it('close через подтверждение', async () => {
    h.start.mutate.mockImplementation((_arg, opts) => opts?.onSuccess?.());
    renderView(mkRun(), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть сбор' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Закрыть сбор досрочно?')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Закрыть сбор' }));
    expect(h.start.mutate).toHaveBeenCalledTimes(1);
  });

  it('cancel через подтверждение', async () => {
    h.cancel.mutate.mockImplementation((_arg, opts) => opts?.onSuccess?.());
    renderView(mkRun(), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Отменить закупку' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Отменить закупку?')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отменить закупку' }));
    expect(h.cancel.mutate).toHaveBeenCalledTimes(1);
  });
});

describe('CollectingView — countdown', () => {
  it('по истечении один раз рефетчит; статус не меняется, add остаётся', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:00:00Z'));
    const run = mkRun({
      collectUntil: '2026-07-18T12:00:02Z', // +2с
      createdAt: '2026-07-18T11:58:00Z',
    });
    const { invalidateSpy } = renderView(run, 3);

    invalidateSpy.mockClear();
    await vi.advanceTimersByTimeAsync(3000);

    const detailInvalidations = invalidateSpy.mock.calls.filter(
      (c) => JSON.stringify(c[0]?.queryKey) === JSON.stringify(['storeRuns', 'detail', 5]),
    );
    expect(detailInvalidations).toHaveLength(1);
    expect(screen.getByText('Сбор закрывается…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить позицию' })).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(3000);
    const after = invalidateSpy.mock.calls.filter(
      (c) => JSON.stringify(c[0]?.queryKey) === JSON.stringify(['storeRuns', 'detail', 5]),
    );
    expect(after).toHaveLength(1); // повторно не рефетчит
  });
});

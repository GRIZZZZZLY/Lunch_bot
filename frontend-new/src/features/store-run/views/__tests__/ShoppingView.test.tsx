import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoreItem, StoreItemStatus, StoreRunWithRelations } from '@/services/store-run.service';
import { _resetBackButtonForTests } from '@/lib/backButton';

const h = vi.hoisted(() => ({
  setPrice: { mutate: vi.fn(), isPending: false },
  settle: { mutate: vi.fn(), isPending: false },
}));

vi.mock('@/hooks/useStoreRun', () => ({
  useSetItemPrice: () => h.setPrice,
  useSettleStoreRun: () => h.settle,
}));

import { ShoppingView } from '../ShoppingView';

let seq = 0;
function mkItem(userId: number, name: string, status: StoreItemStatus, over: Partial<StoreItem> = {}): StoreItem {
  seq += 1;
  return {
    id: over.id ?? seq,
    storeRunId: 5,
    userId,
    name,
    quantity: over.quantity ?? 1,
    notes: over.notes ?? null,
    price: over.price ?? null,
    status,
    createdAt: '',
    updatedAt: '',
    user: { id: userId, firstName: userId === 1 ? 'Игорь' : userId === 2 ? 'Аня' : 'Пётр' },
    ...over,
  };
}

function mkRun(items: StoreItem[]): StoreRunWithRelations {
  return {
    id: 5, groupId: 1, initiatorId: 1, storeName: 'Пятёрочка', status: 'SHOPPING',
    collectUntil: '2000-01-01T00:00:00Z', shoppingAt: '2026-07-18T12:00:00Z',
    settledAt: null, cancelledAt: null, createdAt: '2026-07-18T11:00:00Z', updatedAt: '',
    initiator: { id: 1, firstName: 'Игорь' }, items,
  };
}

function renderView(run: StoreRunWithRelations, currentUserId: number) {
  return render(<ShoppingView run={run} currentUserId={currentUserId} />);
}

beforeEach(() => {
  seq = 0;
  _resetBackButtonForTests();
  delete window.Telegram;
  h.setPrice.mutate.mockReset();
  h.setPrice.isPending = false;
  h.settle.mutate.mockReset();
  h.settle.isPending = false;
});

afterEach(() => vi.restoreAllMocks());

/* Имя кнопки строки включает позицию: в списке из десяти покупок десять
   одинаковых «Куплено» скринридеру ничего не сообщают. */
const rowBtn = (action: string, name: string) => ({ name: `${action}: ${name}` });

describe('ShoppingView — settle', () => {
  /* Отметка в полёте блокирует расчёт: settle по недосчитанному списку создал
     бы транзакции мимо позиции, которая как раз меняет статус. */
  it('активная item-мутация блокирует settle', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10 })]), 1);
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeEnabled();
    // mutate замокан и не вызывает onSettled — отметка остаётся «в полёте»
    await userEvent.click(screen.getByRole('button', rowBtn('Куплено', 'Молоко')));
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeDisabled();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { StoreItem, StoreItemStatus, StoreRunWithRelations } from '@/services/store-run.service';
import { SettledView } from '../SettledView';

let seq = 0;
function mkItem(userId: number, name: string, status: StoreItemStatus, over: Partial<StoreItem> = {}): StoreItem {
  seq += 1;
  return {
    id: over.id ?? seq, storeRunId: 5, userId, name,
    quantity: over.quantity ?? 1, notes: over.notes ?? null, price: over.price ?? null, status,
    createdAt: '', updatedAt: '',
    user: { id: userId, firstName: userId === 1 ? 'Игорь' : userId === 2 ? 'Аня' : 'Пётр' },
    ...over,
  };
}

function mkRun(status: 'SETTLED', items: StoreItem[], over: Partial<StoreRunWithRelations> = {}): StoreRunWithRelations {
  return {
    id: 5, groupId: 1, initiatorId: 1, storeName: 'Пятёрочка', status,
    collectUntil: '2026-07-18T10:00:00Z',
    shoppingAt: over.shoppingAt !== undefined ? over.shoppingAt : '2026-07-18T10:05:00Z',
    settledAt: status === 'SETTLED' ? '2026-07-18T11:00:00Z' : null,
    cancelledAt: null,
    createdAt: '2026-07-18T09:30:00Z', updatedAt: '',
    initiator: { id: 1, firstName: 'Игорь' }, items,
    ...over,
  };
}

/* Фикстура денег: Аня(2) BOUGHT 180 ×2 (не умножается) + NOT_FOUND;
   Пётр(3) BOUGHT 260; Игорь(1, инициатор) BOUGHT 320; Пётр REQUESTED. */
function moneyItems(): StoreItem[] {
  seq = 0;
  return [
    mkItem(2, 'Молоко', 'BOUGHT', { price: '180', quantity: 2 }),
    mkItem(2, 'Кефир', 'NOT_FOUND'),
    mkItem(3, 'Хлеб', 'BOUGHT', { price: 260 }),
    mkItem(1, 'Сыр', 'BOUGHT', { price: '320' }),
    mkItem(3, 'Яблоки', 'REQUESTED'),
  ];
}

function renderView(el: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/store-run/5']}>
      <Routes>
        <Route path="/store-run/:id" element={el} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  seq = 0;
  delete window.Telegram;
});

/* Какое число главное для какой роли. Суммы считает selectors; здесь —
   проводка: участнику его часть (180, ×2 не умножается в 360), а не чужой
   долг (440); инициатору — сколько ему должны (180 + 260, свои 320 не долг). */
describe('SettledView — главная сумма по роли', () => {
  it.each([
    ['участник', 2, [/180\s?₽/], [/360/, /440\s?₽/]],
    ['инициатор', 1, [/440\s?₽/], []],
  ])('%s', (_, userId, shown, hidden) => {
    renderView(<SettledView run={mkRun('SETTLED', moneyItems())} currentUserId={userId} />);
    for (const amount of shown) expect(screen.queryAllByText(amount).length).toBeGreaterThan(0);
    for (const amount of hidden) expect(screen.queryAllByText(amount)).toHaveLength(0);
  });
});

describe('терминальные — устойчивость к неполным данным', () => {
  it('items без user не роняют рендер', () => {
    seq = 0;
    const item = { ...mkItem(2, 'Молоко', 'BOUGHT', { price: '10' }), user: undefined };
    renderView(<SettledView run={mkRun('SETTLED', [item])} currentUserId={3} />);
    expect(screen.getByText('Участник')).toBeInTheDocument();
  });
});

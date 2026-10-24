import { describe, expect, it } from 'vitest';
import type { StoreItem, StoreItemStatus } from '@/services/store-run.service';
import {
  computeBreakdown,
  initiatorOwnTotal,
  parsePriceInput,
  personalDebtTotal,
  priceNum,
  purchasedTotal,
  receivableTotal,
} from '../selectors';

// Роли: 1 = Игорь (инициатор), 2 = Аня, 3 = текущий пользователь.
const INITIATOR = 1;

let seq = 0;
function item(
  userId: number,
  status: StoreItemStatus,
  price: string | number | null,
  extra: Partial<StoreItem> = {},
): StoreItem {
  seq += 1;
  return {
    id: seq,
    storeRunId: 100,
    userId,
    name: extra.name ?? `Позиция ${seq}`,
    quantity: extra.quantity ?? 1,
    notes: extra.notes ?? null,
    price,
    status,
    createdAt: '2026-07-17T12:00:00Z',
    updatedAt: '2026-07-17T12:00:00Z',
    user: { id: userId, firstName: `U${userId}` },
    ...extra,
  };
}

/* Фикстура:
   Аня(2)  Молоко ×2  BOUGHT   "180"  -> долг Ани 180
   Аня(2)  Кефир      NOT_FOUND null  -> вне денег
   Вы(3)   Хлеб       BOUGHT   260    -> личный долг 260
   Игорь(1) Сыр       BOUGHT   "320"  -> покупки инициатора 320 (не долг)
   Вы(3)   Яблоки ×4  REQUESTED null  -> вне денег/settle */
function fixture(): StoreItem[] {
  seq = 0;
  return [
    item(2, 'BOUGHT', '180', { name: 'Молоко', quantity: 2 }),
    item(2, 'NOT_FOUND', null, { name: 'Кефир' }),
    item(3, 'BOUGHT', 260, { name: 'Хлеб' }),
    item(1, 'BOUGHT', '320', { name: 'Сыр' }),
    item(3, 'REQUESTED', null, { name: 'Яблоки', quantity: 4 }),
  ];
}

describe('priceNum (значения API)', () => {
  it.each([
    [null, null],
    [undefined, null],
    ['', null],
    ['   ', null],
    ['abc', null],
    [Infinity, null],
    [-Infinity, null],
    [NaN, null],
    ['320', 320],
    ['12.50', 12.5],
    [0, 0],
    ['0', 0],
    [260, 260],
  ])('%p → %p', (input, expected) => {
    expect(priceNum(input as string | number | null | undefined)).toBe(expected);
  });
});

describe('parsePriceInput (ввод пользователя)', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['0', 0],
    [0, 0],
    ['12.50', 12.5],
    ['12,50', 12.5],
    ['abc', null],
    ['Infinity', null],
    [Infinity, null],
    [null, null],
    [undefined, null],
    ['-5', null],
    [-5, null],
    ['  7,25 ', 7.25],
    // разряды пробелом — так цену копируют из чека или банка
    ['1 340', 1340],
    ['1 340,50', 1340.5],
    // копейки: без округления сюда протекала бы двоичная дробь
    ['249.999', 250],
    ['0.005', 0.01],
    // граница API: 100 000 включительно, больше — не цена
    ['100000', 100000],
    ['100000.01', null],
    [100001, null],
  ])('%p → %p', (input, expected) => {
    expect(parsePriceInput(input as string | number | null | undefined)).toBe(expected);
  });
});

describe('денежные суммы', () => {
  it('purchasedTotal: Σ BOUGHT price; quantity НЕ умножает (Молоко ×2 = 180, не 360)', () => {
    expect(purchasedTotal(fixture())).toBe(180 + 260 + 320);
  });
  it('personalDebtTotal участника = его BOUGHT', () => {
    expect(personalDebtTotal(fixture(), 3, INITIATOR)).toBe(260);
    expect(personalDebtTotal(fixture(), 2, INITIATOR)).toBe(180);
  });
  it('personalDebtTotal инициатора = 0 (свои позиции не долг)', () => {
    expect(personalDebtTotal(fixture(), INITIATOR, INITIATOR)).toBe(0);
  });
  it('initiatorOwnTotal = покупки инициатора', () => {
    expect(initiatorOwnTotal(fixture(), INITIATOR)).toBe(320);
  });
  it('receivableTotal = долги всех, кроме инициатора', () => {
    expect(receivableTotal(fixture(), INITIATOR)).toBe(180 + 260);
  });
  it('BOUGHT с price=0 учитывается как 0, не отбрасывается', () => {
    const items = [item(3, 'BOUGHT', 0, { name: 'Пакет' }), item(3, 'BOUGHT', '50')];
    expect(purchasedTotal(items)).toBe(50);
    expect(personalDebtTotal(items, 3, INITIATOR)).toBe(50);
  });
});

describe('computeBreakdown', () => {
  it('группирует ВСЕ статусы; денежный total только BOUGHT с price', () => {
    const entries = computeBreakdown(fixture(), INITIATOR);
    const anya = entries.find((e) => e.userId === 2)!;
    expect(anya.items).toHaveLength(2); // BOUGHT + NOT_FOUND оба в группе
    expect(anya.total).toBe(180); // NOT_FOUND не в деньгах
    const me = entries.find((e) => e.userId === 3)!;
    expect(me.items).toHaveLength(2); // BOUGHT + REQUESTED
    expect(me.total).toBe(260); // REQUESTED не в деньгах
  });
});

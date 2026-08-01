import { describe, expect, it } from 'vitest';
import type { StoreItem, StoreItemStatus } from '@/services/store-run.service';
import {
  COLLECT_PRESETS,
  boughtWithoutPrice,
  cancellationKind,
  computeBreakdown,
  computeProgress,
  formatPrice,
  groupItemsByParticipant,
  hasRequested,
  initiatorOwnTotal,
  isInitiator,
  isOwner,
  parsePriceInput,
  personalDebtTotal,
  priceNum,
  purchasedTotal,
  receivableTotal,
} from '../selectors';

// Роли: 1 = Игорь (инициатор), 2 = Аня, 3 = текущий пользователь.
const INITIATOR = 1;
const CURRENT = 3;

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

describe('COLLECT_PRESETS', () => {
  it('равны [5,15,30] и в диапазоне backend 3..30', () => {
    expect(COLLECT_PRESETS).toEqual([5, 15, 30]);
    expect(COLLECT_PRESETS.every((m) => m >= 3 && m <= 30)).toBe(true);
  });
});

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

  it('0 не превращается в null', () => {
    expect(priceNum(0)).toBe(0);
    expect(priceNum('0')).toBe(0);
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

describe('formatPrice', () => {
  it('ru-RU + ₽, разряды', () => {
    expect(formatPrice(0)).toContain('0');
    expect(formatPrice(0).endsWith('₽')).toBe(true);
    expect(formatPrice(1340).replace(/\s/g, ' ')).toBe('1 340 ₽');
    expect(formatPrice(12.5).endsWith('₽')).toBe(true);
  });

  it('показывает копейки парой цифр и только когда они есть', () => {
    expect(formatPrice(12.5).replace(/\s/g, ' ')).toBe('12,50 ₽');
    expect(formatPrice(12.05).replace(/\s/g, ' ')).toBe('12,05 ₽');
    expect(formatPrice(12).replace(/\s/g, ' ')).toBe('12 ₽');
  });
});

describe('roles', () => {
  const run = { initiatorId: INITIATOR, shoppingAt: null };
  it('isInitiator', () => {
    expect(isInitiator(run, 1)).toBe(true);
    expect(isInitiator(run, 3)).toBe(false);
    expect(isInitiator(run, null)).toBe(false);
    expect(isInitiator(null, 1)).toBe(false);
  });
  it('isOwner', () => {
    expect(isOwner({ userId: 3 }, 3)).toBe(true);
    expect(isOwner({ userId: 3 }, 2)).toBe(false);
    expect(isOwner({ userId: 3 }, null)).toBe(false);
  });
  it('cancellationKind: shoppingAt null → manual, иначе auto', () => {
    expect(cancellationKind({ shoppingAt: null })).toBe('manual');
    expect(cancellationKind({ shoppingAt: undefined })).toBe('manual');
    expect(cancellationKind({ shoppingAt: '2026-07-17T13:00:00Z' })).toBe('auto');
  });
});

describe('денежные суммы', () => {
  it('purchasedTotal: Σ BOUGHT price; quantity НЕ умножает (Молоко ×2 = 180, не 360)', () => {
    expect(purchasedTotal(fixture())).toBe(180 + 260 + 320);
  });
  it('NOT_FOUND и REQUESTED не входят в сумму', () => {
    const items = [item(2, 'NOT_FOUND', null), item(3, 'REQUESTED', null)];
    expect(purchasedTotal(items)).toBe(0);
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
  it('инвариант: purchasedTotal = receivableTotal + initiatorOwnTotal', () => {
    const items = fixture();
    expect(purchasedTotal(items)).toBe(receivableTotal(items, INITIATOR) + initiatorOwnTotal(items, INITIATOR));
  });
  it('BOUGHT с price=0 учитывается как 0, не отбрасывается', () => {
    const items = [item(3, 'BOUGHT', 0, { name: 'Пакет' }), item(3, 'BOUGHT', '50')];
    expect(purchasedTotal(items)).toBe(50);
    expect(personalDebtTotal(items, 3, INITIATOR)).toBe(50);
  });
});

describe('computeProgress', () => {
  it('считает статусы, processed = bought + notFound', () => {
    expect(computeProgress(fixture())).toEqual({
      total: 5,
      processed: 4,
      requested: 1,
      bought: 3,
      notFound: 1,
    });
  });
  it('пустой список', () => {
    expect(computeProgress([])).toEqual({ total: 0, processed: 0, requested: 0, bought: 0, notFound: 0 });
  });
});

describe('hasRequested / boughtWithoutPrice', () => {
  it('hasRequested', () => {
    expect(hasRequested(fixture())).toBe(true);
    expect(hasRequested([item(2, 'BOUGHT', '10')])).toBe(false);
  });
  it('boughtWithoutPrice — BOUGHT с price==null (блокирует settle)', () => {
    const items = [item(2, 'BOUGHT', null), item(3, 'BOUGHT', '10'), item(3, 'NOT_FOUND', null)];
    const bad = boughtWithoutPrice(items);
    expect(bad).toHaveLength(1);
    expect(bad[0].status).toBe('BOUGHT');
    expect(boughtWithoutPrice(fixture())).toHaveLength(0);
  });
});

describe('groupItemsByParticipant', () => {
  it('«Мои» первой секцией, остальные — в порядке появления', () => {
    const groups = groupItemsByParticipant(fixture(), CURRENT);
    expect(groups.map((g) => g.userId)).toEqual([3, 2, 1]);
    expect(groups[0].isMine).toBe(true);
    expect(groups.slice(1).every((g) => !g.isMine)).toBe(true);
  });
  it('позиции пользователя собраны вместе', () => {
    const groups = groupItemsByParticipant(fixture(), CURRENT);
    const mine = groups.find((g) => g.userId === 3)!;
    expect(mine.items.map((i) => i.name)).toEqual(['Хлеб', 'Яблоки']);
  });
  it('без currentUserId — никто не «мой», порядок появления', () => {
    const groups = groupItemsByParticipant(fixture(), null);
    expect(groups.map((g) => g.userId)).toEqual([2, 3, 1]);
    expect(groups.every((g) => !g.isMine)).toBe(true);
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
  it('запись инициатора помечена isInitiator', () => {
    const entries = computeBreakdown(fixture(), INITIATOR);
    const init = entries.find((e) => e.userId === INITIATOR)!;
    expect(init.isInitiator).toBe(true);
    expect(init.total).toBe(320);
    expect(entries.filter((e) => e.isInitiator)).toHaveLength(1);
  });
  it('порядок групп — первое появление в items', () => {
    expect(computeBreakdown(fixture(), INITIATOR).map((e) => e.userId)).toEqual([2, 3, 1]);
  });
});

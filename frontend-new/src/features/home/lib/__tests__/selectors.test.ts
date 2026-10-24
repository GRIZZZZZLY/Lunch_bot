import { describe, expect, it } from 'vitest';
import { budgetRow, pollEndsAt, resolveTargetGroup } from '../selectors';
import type { Transaction } from '@/types/models';

describe('pollEndsAt', () => {
  it('startedAt + duration минут', () => {
    expect(
      pollEndsAt({
        createdAt: '2026-07-18T11:59:00.000Z',
        startedAt: '2026-07-18T12:00:00.000Z',
        duration: 30,
      }),
    ).toBe('2026-07-18T12:30:00.000Z');
  });

  /* Тот же порядок, что на сервере (backend/src/utils/date.ts): фактическое
     завершение важнее расчёта, иначе закрытое голосование рисуется с живым
     таймером. */
  it('фактический endedAt важнее расчёта', () => {
    expect(
      pollEndsAt({
        createdAt: '2026-07-18T12:00:00.000Z',
        startedAt: '2026-07-18T12:00:00.000Z',
        duration: 30,
        endedAt: '2026-07-18T12:07:00.000Z',
      }),
    ).toBe('2026-07-18T12:07:00.000Z');
  });
});

describe('resolveTargetGroup — группа создаваемого опроса', () => {
  const admin = [{ id: 1 }, { id: 2 }];
  it('невалидный выбор формы отбрасывается → текущая группа', () => {
    expect(resolveTargetGroup('99', '1', admin)).toBe('1');
  });
  it('текущая не админская → первая админская (не молча чужая)', () => {
    expect(resolveTargetGroup(null, '77', admin)).toBe('1');
  });
});

function tx(over: Partial<Transaction>): Transaction {
  return { id: 1, amount: 100, status: 'PENDING', ...over } as Transaction;
}

describe('budgetRow — свод сценариев в строку', () => {
  /* Отмеченный долг уже переведён: считать его в «к переводу» значило звать
     человека переводить второй раз («2 перевода · 600 ₽» при одном оставшемся). */
  it('PENDING-долг → debt: сумма и счёт только непереведённых', () => {
    const row = budgetRow([tx({ id: 7, amount: 260 }), tx({ id: 8, amount: 100, status: 'PAID' })], []);
    expect(row.kind).toBe('debt');
    expect(row.amount).toBe(260);
    expect(row.payableCount).toBe(1);
  });
  it('только PAID → awaiting без действия', () => {
    const row = budgetRow([tx({ status: 'PAID', amount: 120 })], []);
    expect(row.kind).toBe('awaiting');
    expect(row.amount).toBe(120);
  });
  it('кредиты → collector: «вам должны» считает только неполученное', () => {
    const row = budgetRow([], [tx({ amount: 300 }), tx({ amount: 200, status: 'CONFIRMED' })]);
    expect(row.kind).toBe('collector');
    // подтверждённые 200 ₽ уже получены — в долге им не место
    expect(row.amount).toBe(300);
    expect(row.confirmed).toBe(200);
  });
  /* Должник отметил оплату и ждёт «уже 1 день», а главная сборщика говорила
     только «Вам должны участники» — задачи для него было не видно. */
  it('collector считает отмеченные оплаты, которые ждут его подтверждения', () => {
    const row = budgetRow([], [tx({ status: 'PAID', amount: 300 }), tx({ status: 'PAID', amount: 200 }), tx({ amount: 50 })]);
    // сумма — того, что ждёт подтверждения, а не всех долгов
    expect(row.amount).toBe(500);
    expect(row.kind).toBe('collector');
    expect(row.toConfirm).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import { buildBudget } from '../buildBudget';
import type { Transaction } from '@/types/models';

const NOW = new Date('2026-07-20T12:00:00');

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: 1,
    pollId: 1,
    debtorId: 2,
    creditorId: 3,
    amount: 300,
    status: 'PENDING',
    createdAt: '2026-07-20T11:30:00',
    ...over,
  } as Transaction;
}

describe('buildBudget — жизненный цикл долга', () => {
  it('нет транзакций → isEmpty', () => {
    const vm = buildBudget([], [], NOW);
    expect(vm.isEmpty).toBe(true);
    expect(vm.myDebts).toEqual([]);
    expect(vm.owed).toEqual([]);
  });

  it('PENDING долг → в myDebts, возраст в минутах', () => {
    const vm = buildBudget([tx({ id: 5, status: 'PENDING', creditor: { id: 3, firstName: 'Оля' } })], [], NOW);
    expect(vm.myDebts).toHaveLength(1);
    expect(vm.myDebts[0]).toMatchObject({ id: 5, name: 'Оля', amount: 300, status: 'PENDING', ageMin: 30 });
    expect(vm.myDebtTotal).toBe(300);
    expect(vm.isEmpty).toBe(false);
  });

  it('PAID долг → всё ещё активен (ждёт подтверждения)', () => {
    const vm = buildBudget([tx({ id: 5, status: 'PAID' })], [], NOW);
    expect(vm.myDebts[0].status).toBe('PAID');
    expect(vm.settledRecently).toBe(false);
  });

  it('CONFIRMED долг → ушёл из активных, settledRecently=true', () => {
    const vm = buildBudget([tx({ id: 5, status: 'CONFIRMED' })], [], NOW);
    expect(vm.myDebts).toEqual([]);
    expect(vm.settledRecently).toBe(true);
    expect(vm.isEmpty).toBe(false);
  });

  it('несколько долгов: PENDING раньше PAID, внутри по убыванию суммы', () => {
    const vm = buildBudget(
      [
        tx({ id: 1, status: 'PAID', amount: 500 }),
        tx({ id: 2, status: 'PENDING', amount: 200 }),
        tx({ id: 3, status: 'PENDING', amount: 400 }),
      ],
      [],
      NOW,
    );
    expect(vm.myDebts.map((d) => d.id)).toEqual([3, 2, 1]);
    expect(vm.myDebtTotal).toBe(1100);
  });
});

describe('buildBudget — роль сборщика (кредиты)', () => {
  it('получено X из Y и счётчик оплативших', () => {
    const vm = buildBudget(
      [],
      [
        tx({ id: 1, status: 'CONFIRMED', amount: 300, debtor: { id: 2, firstName: 'Ян' } }),
        tx({ id: 2, status: 'PAID', amount: 200, debtor: { id: 4, firstName: 'Оля' } }),
        tx({ id: 3, status: 'PENDING', amount: 100, debtor: { id: 5, firstName: 'Míra' } }),
      ],
      NOW,
    );
    expect(vm.owedExpected).toBe(600);
    expect(vm.owedReceived).toBe(300);
    expect(vm.owedPaidCount).toBe(2);
    expect(vm.owedCount).toBe(3);
    // активные (не CONFIRMED): PAID раньше PENDING
    expect(vm.owed.map((c) => c.id)).toEqual([2, 3]);
    expect(vm.allCollected).toBe(false);
  });

  it('все кредиты CONFIRMED → allCollected, owed пуст, не isEmpty', () => {
    const vm = buildBudget([], [tx({ id: 1, status: 'CONFIRMED', creditorId: 1, debtorId: 2 })], NOW);
    expect(vm.owed).toEqual([]);
    expect(vm.allCollected).toBe(true);
    expect(vm.isEmpty).toBe(false);
  });

  it('роли сосуществуют: и долг, и кредит', () => {
    const vm = buildBudget(
      [tx({ id: 1, status: 'PENDING', amount: 300 })],
      [tx({ id: 2, status: 'PAID', amount: 200 })],
      NOW,
    );
    expect(vm.myDebts).toHaveLength(1);
    expect(vm.owed).toHaveLength(1);
    expect(vm.isEmpty).toBe(false);
  });
});

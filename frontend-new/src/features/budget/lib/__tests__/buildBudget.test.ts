import { describe, expect, it } from 'vitest';
import { buildBudget } from '../buildBudget';
import type { Transaction } from '@/types/models';

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: 1,
    pollId: 1,
    fromUserId: 2,
    toUserId: 3,
    amount: 300,
    status: 'PENDING',
    createdAt: '2026-07-20T11:30:00',
    ...over,
  } as Transaction;
}

/* «За что долг»: две строки «Игорь · 420 ₽» и «Игорь · 180 ₽» было не различить.
   Источник — блюдо или магазин; дата есть всегда. */
describe('buildBudget — за что долг', () => {
  it('обеденный долг → блюдо и дата', () => {
    const vm = buildBudget([tx({ id: 5, menuItem: { id: 2, name: 'Паста карбонара' } })], []);
    expect(vm.myDebts[0].reference).toEqual({ subject: 'Паста карбонара', when: '20 июля' });
  });

  it('магазинный долг → название магазина и дата', () => {
    const vm = buildBudget([tx({ id: 5, storeRun: { id: 9, storeName: 'Пятёрочка' } })], []);
    expect(vm.myDebts[0].reference).toEqual({ subject: 'Пятёрочка', when: '20 июля' });
  });

  it('API не дал ни блюда, ни магазина → только дата, без выдуманного текста', () => {
    const vm = buildBudget([tx({ id: 5 })], []);
    expect(vm.myDebts[0].reference).toEqual({ subject: '', when: '20 июля' });
  });

  it('кредит тоже получает ссылку', () => {
    const vm = buildBudget([], [tx({ id: 7, menuItem: { id: 2, name: 'Борщ' } })]);
    expect(vm.owed[0].reference).toEqual({ subject: 'Борщ', when: '20 июля' });
  });
});

/* Реквизиты, длительность и память о напоминаниях. Всё это API отдавал и раньше;
   тип на фронте их не объявлял, поэтому модель не видела. */
describe('buildBudget — куда платить и сколько ждём', () => {
  const NOW = new Date('2026-07-20T12:00:00');

  it('реквизиты получателя берутся из toUser', () => {
    const vm = buildBudget(
      [tx({ id: 5, toUser: { id: 3, firstName: 'Оля', paymentPhone: ' +7 900 111-22-33 ' } })],
      [],
      NOW,
    );
    expect(vm.myDebts[0].payTo).toEqual({ phone: '+7 900 111-22-33', card: undefined, note: undefined });
  });

  it('реквизиты не заполнены → payTo = null, а не пустой объект', () => {
    const vm = buildBudget([tx({ id: 5, toUser: { id: 3, firstName: 'Оля' } })], [], NOW);
    expect(vm.myDebts[0].payTo).toBeNull();
  });

  it('длительность ожидания считается от отметки, а не от создания долга', () => {
    const vm = buildBudget(
      [tx({ id: 5, status: 'PAID', createdAt: '2026-07-01T12:00:00', paidAt: '2026-07-18T12:00:00' })],
      [],
      NOW,
    );
    expect(vm.myDebts[0].waiting).toBe('2 дня');
  });

  it('не отмечено → длительности нет', () => {
    const vm = buildBudget([tx({ id: 5, status: 'PENDING' })], [], NOW);
    expect(vm.myDebts[0].waiting).toBe('');
  });

  it('память о напоминаниях: сколько раз и когда', () => {
    const vm = buildBudget(
      [],
      [tx({ id: 7, reminderCount: 2, lastReminderAt: '2026-07-19T09:00:00' })],
      NOW,
    );
    expect(vm.owed[0].reminded).toBe('2 напоминания · 19 июля');
  });

  it('ни разу не напоминали → строки нет', () => {
    const vm = buildBudget([], [tx({ id: 7 })], NOW);
    expect(vm.owed[0].reminded).toBe('');
  });
});

describe('buildBudget — жизненный цикл долга', () => {
  it('нет транзакций → isEmpty', () => {
    const vm = buildBudget([], []);
    expect(vm.isEmpty).toBe(true);
    expect(vm.myDebts).toEqual([]);
    expect(vm.owed).toEqual([]);
  });

  it('PENDING долг → в myDebts', () => {
    const vm = buildBudget([tx({ id: 5, status: 'PENDING', toUser: { id: 3, firstName: 'Оля' } })], []);
    expect(vm.myDebts).toHaveLength(1);
    expect(vm.myDebts[0]).toMatchObject({ id: 5, name: 'Оля', amount: 300, status: 'PENDING' });
    expect(vm.myDebtTotal).toBe(300);
    expect(vm.isEmpty).toBe(false);
  });

  it('PAID долг → всё ещё активен (ждёт подтверждения)', () => {
    const vm = buildBudget([tx({ id: 5, status: 'PAID' })], []);
    expect(vm.myDebts[0].status).toBe('PAID');
    expect(vm.settledRecently).toBe(false);
  });

  it('CONFIRMED долг → ушёл из активных, settledRecently=true', () => {
    const vm = buildBudget([tx({ id: 5, status: 'CONFIRMED' })], []);
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
        tx({ id: 1, status: 'CONFIRMED', amount: 300, fromUser: { id: 2, firstName: 'Ян' } }),
        tx({ id: 2, status: 'PAID', amount: 200, fromUser: { id: 4, firstName: 'Оля' } }),
        tx({ id: 3, status: 'PENDING', amount: 100, fromUser: { id: 5, firstName: 'Míra' } }),
      ],
    );
    expect(vm.owedExpected).toBe(600);
    expect(vm.owedReceived).toBe(300);
    expect(vm.owedCount).toBe(3);
    // активные (не CONFIRMED): PAID раньше PENDING
    expect(vm.owed.map((c) => c.id)).toEqual([2, 3]);
    expect(vm.allCollected).toBe(false);
  });

  it('все кредиты CONFIRMED → allCollected, owed пуст, не isEmpty', () => {
    const vm = buildBudget([], [tx({ id: 1, status: 'CONFIRMED', toUserId: 1, fromUserId: 2 })]);
    expect(vm.owed).toEqual([]);
    expect(vm.allCollected).toBe(true);
    expect(vm.isEmpty).toBe(false);
  });

  it('роли сосуществуют: и долг, и кредит', () => {
    const vm = buildBudget(
      [tx({ id: 1, status: 'PENDING', amount: 300 })],
      [tx({ id: 2, status: 'PAID', amount: 200 })],
    );
    expect(vm.myDebts).toHaveLength(1);
    expect(vm.owed).toHaveLength(1);
    expect(vm.isEmpty).toBe(false);
  });
});

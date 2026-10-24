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

describe('buildBudget — из чего сложилась сумма', () => {
  it('обеденный долг → блюдо, доли доставки, сервиса и чаевых и итог', () => {
    const vm = buildBudget(
      [
        tx({
          amount: 460,
          menuItem: { id: 2, name: 'Паста карбонара' },
          itemPrice: 380,
          deliveryShare: 50,
          serviceShare: 0,
          tipShare: 30,
        }),
      ],
      [],
    );
    expect(vm.myDebts[0].details).toEqual({
      source: 'Обед',
      lines: [
        { label: 'Паста карбонара', amount: 380 },
        { label: 'Доставка', amount: 50 },
        { label: 'Чаевые', amount: 30 },
      ],
      total: 460,
      events: [],
      informative: true,
    });
  });

  it('без цены блюда сумма не выдумывается: блюдо получает весь долг', () => {
    const vm = buildBudget([tx({ amount: 300, menuItem: { id: 2, name: 'Борщ' } })], []);
    expect(vm.myDebts[0].details.lines).toEqual([{ label: 'Борщ', amount: 300 }]);
    expect(vm.myDebts[0].details.total).toBeNull();
  });
});

describe('buildBudget — куда платить', () => {
  const NOW = new Date('2026-07-20T12:00:00');

  it('реквизиты получателя берутся из toUser', () => {
    const vm = buildBudget(
      [tx({ id: 5, toUser: { id: 3, firstName: 'Оля', paymentPhone: ' +7 900 111-22-33 ' } })],
      [],
      NOW,
    );
    expect(vm.myDebts[0].payTo).toEqual({ phone: '+7 900 111-22-33', link: undefined, note: undefined });
  });

  /* В колонке paymentCard теперь ссылка СБП, а не номер карты: поле в профиле
     заменено, а имя колонки оставлено — миграция ради подписи не нужна. */
  it('ссылка СБП приезжает из paymentCard', () => {
    const vm = buildBudget(
      [
        tx({
          id: 5,
          toUser: { id: 3, firstName: 'Оля', paymentCard: ' https://www.tinkoff.ru/rm/abc ' },
        }),
      ],
      [],
      NOW,
    );
    expect(vm.myDebts[0].payTo).toEqual({
      link: 'https://www.tinkoff.ru/rm/abc',
      phone: undefined,
      note: undefined,
    });
  });
});

describe('buildBudget — жизненный цикл долга', () => {
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
    // «к переводу» и «ждёт подтверждения» — разные состояния, одним числом их не сложить
    expect(vm.myDebtToTransfer).toBe(600);
    expect(vm.myDebtAwaiting).toBe(500);
  });

  it('закрытые за сутки долги → кому и сколько, для итоговой карточки', () => {
    const now = new Date('2026-07-20T12:00:00');
    const vm = buildBudget(
      [
        tx({ id: 1, status: 'CONFIRMED', amount: 420, confirmedAt: '2026-07-20T11:00:00', toUser: { id: 3, firstName: 'Игорь' } }),
        tx({ id: 2, status: 'CONFIRMED', amount: 180, confirmedAt: '2026-07-20T10:00:00', toUser: { id: 3, firstName: 'Игорь' } }),
        tx({ id: 3, status: 'CONFIRMED', amount: 90, confirmedAt: '2026-07-10T10:00:00', toUser: { id: 4, firstName: 'Оля' } }),
      ],
      [],
      now,
    );
    expect(vm.settled).toEqual({ count: 2, total: 600, names: ['Игорь'] });
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
});

/* Подтверждённое уходит из активных, поэтому промах было нельзя исправить.
   Окно — сутки; хозяин правила сервер, здесь только показ. */
describe('buildBudget — окно отмены подтверждения', () => {
  const NOW = new Date('2026-07-20T12:00:00');

  it('подтверждён час назад → можно отменить', () => {
    const vm = buildBudget([], [tx({ id: 9, status: 'CONFIRMED', confirmedAt: '2026-07-20T11:00:00', fromUser: { id: 2, firstName: 'Ян' } })], NOW);
    expect(vm.undoable.map((c) => c.id)).toEqual([9]);
    expect(vm.undoable[0].name).toBe('Ян');
  });

  it('подтверждён два дня назад → окно истекло', () => {
    const vm = buildBudget([], [tx({ id: 9, status: 'CONFIRMED', confirmedAt: '2026-07-18T11:00:00' })], NOW);
    expect(vm.undoable).toEqual([]);
  });

  it('нет confirmedAt → в окно не попадает, а не считается свежим', () => {
    const vm = buildBudget([], [tx({ id: 9, status: 'CONFIRMED' })], NOW);
    expect(vm.undoable).toEqual([]);
  });
});

describe('buildBudget — долги по получателям', () => {
  it('долги одному человеку — одна группа с суммами и id непереведённых', () => {
    const igor = { id: 3, firstName: 'Игорь' };
    const vm = buildBudget(
      [
        tx({ id: 1, amount: 420, toUser: igor }),
        tx({ id: 2, amount: 180, status: 'PAID', toUser: igor }),
        tx({ id: 3, amount: 95.5, toUser: igor }),
        tx({ id: 4, amount: 700, toUser: { id: 5, firstName: 'Оля' } }),
      ],
      [],
    );
    expect(vm.debtGroups.map((g) => g.name)).toEqual(['Оля', 'Игорь']);
    const g = vm.debtGroups[1];
    // строки — по дате, затем по id: отметка их не переставляет
    expect(g.debts.map((d) => d.id)).toEqual([1, 2, 3]);
    expect(g.toTransfer).toBe(515.5);
    expect(g.awaiting).toBe(180);
    expect(g.pendingIds).toEqual([1, 3]);
  });

  /* После «Отметить все» список пересортировывался: карточка уезжала вниз, а
     под палец вставала сплошная кнопка другого человека. */
  it('порядок карточек не зависит от отметки', () => {
    const debts = (igor: 'PENDING' | 'PAID') => [
      tx({ id: 1, amount: 900, status: igor, toUser: { id: 3, firstName: 'Игорь' } }),
      tx({ id: 2, amount: 100, toUser: { id: 5, firstName: 'Оля' } }),
    ];
    const before = buildBudget(debts('PENDING'), []).debtGroups.map((g) => g.name);
    const after = buildBudget(debts('PAID'), []).debtGroups.map((g) => g.name);
    expect(after).toEqual(before);
  });
});

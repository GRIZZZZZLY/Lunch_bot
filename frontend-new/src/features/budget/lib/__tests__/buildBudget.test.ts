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

  it('у кредита то же «за что»', () => {
    const vm = buildBudget([], [tx({ id: 7, menuItem: { id: 2, name: 'Борщ' } })]);
    expect(vm.owed[0].reference).toEqual({ subject: 'Борщ', when: '20 июля' });
  });
});

/* Состав долга раскрывается прямо в строке. Раньше за ним надо было идти по
   ссылке-дате на страницу закупки или результатов: два перехода ради одной
   суммы. */
describe('buildBudget — из чего сложилась сумма', () => {
  it('магазинный долг → позиция и её цена', () => {
    const vm = buildBudget(
      [
        tx({
          id: 5,
          amount: 180,
          pollId: null,
          storeRun: { id: 9, storeName: 'Пятёрочка' },
          storeItem: { id: 40, name: 'Хлеб', quantity: 1 },
        }),
      ],
      [],
    );
    expect(vm.myDebts[0].details).toEqual({
      source: 'Закупка «Пятёрочка»',
      lines: [{ label: 'Хлеб', amount: 180 }],
      total: null,
      events: [],
      informative: true,
    });
  });

  it('несколько штук одной позиции видны в названии', () => {
    const vm = buildBudget(
      [
        tx({
          pollId: null,
          storeRun: { id: 9, storeName: 'Пятёрочка' },
          storeItem: { id: 40, name: 'Кефир', quantity: 3 },
        }),
      ],
      [],
    );
    expect(vm.myDebts[0].details.lines[0].label).toBe('Кефир × 3');
  });

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

  /* «Подробнее» у одного блюда без долей повторял строку: «Обед / Борщ 390 ₽».
     Кнопка нужна там, где раскрытие что-то добавляет. */
  it.each([
    ['блюдо без долей и без истории', tx({ menuItem: { id: 2, name: 'Борщ' } }), false],
    ['блюдо с доставкой', tx({ menuItem: { id: 2, name: 'Борщ' }, itemPrice: 250, deliveryShare: 50 }), true],
    ['блюдо с отметкой оплаты', tx({ menuItem: { id: 2, name: 'Борщ' }, paidAt: '2026-07-20T11:40:00' }), true],
    [
      'позиция закупки: её названия в строке нет',
      tx({ pollId: null, storeRun: { id: 9, storeName: 'Пятёрочка' }, storeItem: { id: 4, name: 'Хлеб' } }),
      true,
    ],
  ])('%s → раскрывать: %s', (_label, transaction, expected) => {
    const vm = buildBudget([transaction], []);
    expect(vm.myDebts[0].details.informative).toBe(expected);
  });

  it('отметка и подтверждение оплаты попадают в историю строки', () => {
    const vm = buildBudget(
      [],
      [
        tx({
          status: 'CONFIRMED',
          paidAt: '2026-07-20T12:40:00',
          confirmedAt: '2026-07-20T13:05:00',
        }),
      ],
      new Date('2026-07-20T14:00:00'),
    );
    expect(vm.undoable[0].details.events).toEqual([
      'Оплату отметили 20 июля в 12:40',
      'Оплату подтвердили 20 июля в 13:05',
    ]);
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

  it('сегодняшнее напоминание называет время, а не только дату', () => {
    const vm = buildBudget(
      [],
      [tx({ id: 7, reminderCount: 1, lastReminderAt: '2026-07-20T09:15:00' })],
      NOW,
    );
    expect(vm.owed[0].reminded).toBe('1 напоминание · сегодня в 09:15');
  });

  /* Пауза та же, что на сервере (REMINDER_COOLDOWN_MS): 6 часов. */
  it.each([
    ['ни разу не напоминали', undefined, true],
    ['напоминали 3 часа назад', '2026-07-20T09:00:00', false],
    ['напоминали ровно 6 часов назад', '2026-07-20T06:00:00', true],
    ['напоминали вчера', '2026-07-19T09:00:00', true],
  ])('%s → можно напомнить: %s', (_label, lastReminderAt, expected) => {
    const vm = buildBudget([], [tx({ id: 7, reminderCount: 1, lastReminderAt })], NOW);
    expect(vm.owed[0].canRemind).toBe(expected);
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
    expect(vm.myDebtToTransfer).toBe(300);
    expect(vm.myDebtAwaiting).toBe(0);
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

  it('все рассчитались → имена без повторов, в порядке сумм', () => {
    const vm = buildBudget(
      [],
      [
        tx({ id: 1, status: 'CONFIRMED', amount: 200, fromUser: { id: 2, firstName: 'Ян' } }),
        tx({ id: 2, status: 'CONFIRMED', amount: 500, fromUser: { id: 4, firstName: 'Оля' } }),
        tx({ id: 3, status: 'CONFIRMED', amount: 100, fromUser: { id: 2, firstName: 'Ян' } }),
      ],
    );
    expect(vm.collectedNames).toEqual(['Оля', 'Ян']);
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

  it('активные кредиты в окно отмены не попадают', () => {
    const vm = buildBudget([], [tx({ id: 9, status: 'PAID' })], NOW);
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

  it('строки карточки — по дате', () => {
    const igor = { id: 3, firstName: 'Игорь' };
    const vm = buildBudget(
      [
        tx({ id: 1, amount: 900, createdAt: '2026-07-18T10:00:00', toUser: igor }),
        tx({ id: 2, amount: 100, createdAt: '2026-07-14T10:00:00', toUser: igor }),
      ],
      [],
    );
    expect(vm.debtGroups[0].debts.map((d) => d.id)).toEqual([2, 1]);
  });

  it('когда можно напомнить снова — только пока идёт пауза', () => {
    const now = new Date('2026-07-20T12:00:00');
    const vm = buildBudget(
      [],
      [
        tx({ id: 1, reminderCount: 1, lastReminderAt: '2026-07-20T11:00:00', fromUser: { id: 2, firstName: 'Ян' } }),
        tx({ id: 2, reminderCount: 1, lastReminderAt: '2026-07-19T11:00:00', fromUser: { id: 3, firstName: 'Оля' } }),
      ],
      now,
    );
    expect(vm.owed.find((c) => c.id === 1)?.remindAgain).toBe('снова в 17:00');
    expect(vm.owed.find((c) => c.id === 2)?.remindAgain).toBe('');
  });
});

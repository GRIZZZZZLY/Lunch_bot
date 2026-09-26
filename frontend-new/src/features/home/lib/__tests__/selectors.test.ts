import { describe, expect, it } from 'vitest';
import { budgetRow, dateCaption, greetingFor, pollEndsAt, resolveTargetGroup, winnerRowVM } from '../selectors';
import type { MenuItem, Poll, Transaction } from '@/types/models';

describe('greetingFor / dateCaption', () => {
  it('время суток', () => {
    expect(greetingFor(7)).toBe('Доброе утро');
    expect(greetingFor(13)).toBe('Добрый день');
    expect(greetingFor(20)).toBe('Добрый вечер');
    expect(greetingFor(3)).toBe('Добрый вечер');
  });
  it('caption с заглавной буквы', () => {
    expect(dateCaption(new Date('2026-07-17T12:00:00'))).toMatch(/^Пятница, 17 июля$/i);
  });
});

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

  it('без startedAt считает от createdAt', () => {
    expect(pollEndsAt({ createdAt: '2026-07-18T12:00:00.000Z', duration: 30 })).toBe(
      '2026-07-18T12:30:00.000Z',
    );
  });
});

describe('resolveTargetGroup — группа создаваемого опроса', () => {
  const admin = [{ id: 1 }, { id: 2 }];
  it('выбор формы приоритетен', () => {
    expect(resolveTargetGroup('2', '1', admin)).toBe('2');
  });
  it('невалидный выбор формы отбрасывается → текущая группа', () => {
    expect(resolveTargetGroup('99', '1', admin)).toBe('1');
  });
  it('без формы — текущая, если админская', () => {
    expect(resolveTargetGroup(null, '2', admin)).toBe('2');
  });
  it('текущая не админская → первая админская (не молча чужая)', () => {
    expect(resolveTargetGroup(null, '77', admin)).toBe('1');
  });
  it('нет админских групп → текущая или null', () => {
    expect(resolveTargetGroup(null, '5', [])).toBe('5');
    expect(resolveTargetGroup(null, null, [])).toBeNull();
  });
});

function tx(over: Partial<Transaction>): Transaction {
  return { id: 1, amount: 100, status: 'PENDING', ...over } as Transaction;
}

describe('budgetRow — свод сценариев в строку', () => {
  it('пусто → hidden', () => {
    expect(budgetRow([], []).kind).toBe('hidden');
  });
  /* Отмеченный долг уже переведён: считать его в «к переводу» значило звать
     человека переводить второй раз («2 перевода · 600 ₽» при одном оставшемся). */
  it('PENDING-долг → debt: сумма и счёт только непереведённых', () => {
    const row = budgetRow([tx({ id: 7, amount: 260 }), tx({ id: 8, amount: 100, status: 'PAID' })], []);
    expect(row.kind).toBe('debt');
    expect(row.amount).toBe(260);
    expect(row.payableCount).toBe(1);
    expect(row.payableTxId).toBe(7);
  });
  it('payableAmount — сумма именно погашаемой транзакции, а не всех долгов', () => {
    const row = budgetRow([tx({ id: 7, amount: 300 }), tx({ id: 8, amount: 200 })], []);
    expect(row.amount).toBe(500);
    expect(row.payableTxId).toBe(7);
    // «Оплатил · 500 ₽» гасило бы 300 ₽ и молча оставляло второй перевод
    expect(row.payableAmount).toBe(300);
    expect(row.payableCount).toBe(2);
  });
  it('только PAID → awaiting без действия', () => {
    const row = budgetRow([tx({ status: 'PAID', amount: 120 })], []);
    expect(row.kind).toBe('awaiting');
    expect(row.amount).toBe(120);
    expect(row.payableTxId).toBeNull();
  });
  it('CONFIRMED-долги игнорируются', () => {
    expect(budgetRow([tx({ status: 'CONFIRMED' })], []).kind).toBe('hidden');
  });
  it('кредиты → collector: «вам должны» считает только неполученное', () => {
    const row = budgetRow([], [tx({ amount: 300 }), tx({ amount: 200, status: 'CONFIRMED' })]);
    expect(row.kind).toBe('collector');
    // подтверждённые 200 ₽ уже получены — в долге им не место
    expect(row.amount).toBe(300);
    expect(row.confirmed).toBe(200);
  });
  it('долг приоритетнее кредитов', () => {
    expect(budgetRow([tx({})], [tx({})]).kind).toBe('debt');
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
  it('без отмеченных оплат подтверждать нечего', () => {
    expect(budgetRow([], [tx({})]).toConfirm).toBe(0);
  });
});

/**
 * Итог последнего опроса на главной.
 *
 * Настоящий сервер отдаёт итоги вложенными: `{ result: { winnerMenuItem,
 * totalVotes, rouletteData, responsibleUser } }`, а «последний завершённый»
 * опрос — без голосов. Селектор читал только плоскую форму из моков, и на
 * живом сервере главная для любого опроса показывала первое блюдо меню и
 * «голосов не было».
 */
describe('winnerRowVM', () => {
  const poll = {
    id: 15,
    status: 'COMPLETED',
    selectedMenuItemIds: '[21,22]',
    menuItems: [],
    createdAt: '2026-09-24T10:00:00Z',
  } as unknown as Poll;
  const menu = [
    { id: 21, name: 'Борщ' },
    { id: 22, name: 'Паста' },
  ] as unknown as MenuItem[];

  it('читает вложенный ответ сервера', () => {
    const served = {
      result: {
        winnerMenuItemId: 22,
        totalVotes: 3,
        winnerMenuItem: { id: 22, name: 'Паста' },
        responsibleUser: { id: 61, firstName: 'Анна' },
        rouletteData: JSON.stringify({ winners: [{ menuItemId: 22, voteCount: 2 }] }),
      },
    };

    expect(winnerRowVM(poll, served, menu, true)).toEqual({
      winnerName: 'Паста',
      winnerVotes: 2,
      totalVotes: 3,
      responsibleName: 'Анна',
      pollId: 15,
    });
  });

  it('по-прежнему понимает плоскую форму', () => {
    const flat = { winnerId: 22, winnerName: 'Паста', totalVotes: 3, responsible: { name: 'Анна' } };

    expect(winnerRowVM(poll, flat, menu, true)).toMatchObject({
      winnerName: 'Паста',
      totalVotes: 3,
      responsibleName: 'Анна',
    });
  });

  it('несвежий итог не показывается', () => {
    expect(winnerRowVM(poll, { result: { totalVotes: 1 } }, menu, false)).toBeNull();
  });
});

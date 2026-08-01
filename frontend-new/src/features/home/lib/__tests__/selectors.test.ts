import { describe, expect, it } from 'vitest';
import { budgetRow, dateCaption, greetingFor, pollEndsAt, resolveTargetGroup } from '../selectors';
import type { Transaction } from '@/types/models';

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
  it('createdAt + duration минут', () => {
    expect(pollEndsAt('2026-07-18T12:00:00.000Z', 30)).toBe('2026-07-18T12:30:00.000Z');
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
  it('PENDING-долг → debt с суммой активных и payable-транзакцией', () => {
    const row = budgetRow([tx({ id: 7, amount: 260 }), tx({ id: 8, amount: 100, status: 'PAID' })], []);
    expect(row.kind).toBe('debt');
    expect(row.amount).toBe(360);
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
});

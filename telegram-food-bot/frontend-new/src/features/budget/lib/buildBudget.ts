/* Модель экрана бюджета из сырых транзакций (долги/кредиты). Жизненный цикл
   PENDING → PAID → CONFIRMED раскладывается на две роли: должник платит и
   отменяет отметку, сборщик подтверждает и напоминает. Никаких выдуманных
   данных — только то, что вернул бэкенд. */
import type { Transaction } from '@/types/models';

export interface DebtLineVM {
  id: number;
  name: string; // кому должен (кредитор)
  amount: number;
  status: 'PENDING' | 'PAID';
  ageMin: number;
}

export interface CreditLineVM {
  id: number;
  name: string; // кто должен (должник)
  amount: number;
  status: 'PENDING' | 'PAID';
}

export interface BudgetVM {
  myDebts: DebtLineVM[];
  myDebtTotal: number;
  settledRecently: boolean; // активных долгов нет, но был закрытый — показать успех
  owed: CreditLineVM[];
  owedReceived: number; // подтверждено, ₽
  owedExpected: number; // всего к получению, ₽
  owedPaidCount: number; // оплатили или подтверждено
  owedCount: number;
  allCollected: boolean; // мне были должны, все рассчитались
  isEmpty: boolean;
}

function personName(u?: { firstName?: string; username?: string }): string {
  return u?.firstName || u?.username || 'Участник';
}

export function buildBudget(
  debts: Transaction[],
  credits: Transaction[],
  now: Date = new Date(),
): BudgetVM {
  const myDebts = debts
    .filter((d) => d.status !== 'CONFIRMED')
    .map((d) => ({
      id: d.id,
      name: personName(d.creditor),
      amount: d.amount,
      status: d.status as 'PENDING' | 'PAID',
      ageMin: Math.max(0, Math.round((now.getTime() - new Date(d.createdAt).getTime()) / 60000)),
    }))
    // сначала неоплаченные, внутри — по убыванию суммы
    .sort((a, b) => (a.status === b.status ? b.amount - a.amount : a.status === 'PENDING' ? -1 : 1));
  const myDebtTotal = myDebts.reduce((s, d) => s + d.amount, 0);
  const hadConfirmedDebt = debts.some((d) => d.status === 'CONFIRMED');

  const owed = credits
    .filter((c) => c.status !== 'CONFIRMED')
    .map((c) => ({
      id: c.id,
      name: personName(c.debtor),
      amount: c.amount,
      status: c.status as 'PENDING' | 'PAID',
    }))
    // сначала те, кто отметил оплату (их надо подтвердить)
    .sort((a, b) => (a.status === b.status ? b.amount - a.amount : a.status === 'PAID' ? -1 : 1));
  const owedExpected = credits.reduce((s, c) => s + c.amount, 0);
  const owedReceived = credits
    .filter((c) => c.status === 'CONFIRMED')
    .reduce((s, c) => s + c.amount, 0);
  const owedPaidCount = credits.filter((c) => c.status !== 'PENDING').length;
  const owedCount = credits.length;

  return {
    myDebts,
    myDebtTotal,
    settledRecently: myDebts.length === 0 && hadConfirmedDebt,
    owed,
    owedReceived,
    owedExpected,
    owedPaidCount,
    owedCount,
    allCollected: owedCount > 0 && owed.length === 0,
    isEmpty:
      myDebts.length === 0 && owed.length === 0 && !hadConfirmedDebt && owedCount === 0,
  };
}

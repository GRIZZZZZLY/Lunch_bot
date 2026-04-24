import type { BudgetData, Debtor, TransactionStatus as UiTxStatus } from '@/components/budget/types';
import type { Poll, PollResult, Transaction, TransactionStatus, User } from '@/types/models';

function initialOf(name: string): string {
  return (name?.trim().charAt(0) || '?').toUpperCase();
}

function personName(u?: Pick<User, 'firstName' | 'username'> | null): string {
  if (!u) return 'Участник';
  return u.firstName || u.username || 'Участник';
}

function mapTxStatusToUi(s: TransactionStatus): UiTxStatus {
  if (s === 'PENDING') return 'pending';
  if (s === 'PAID') return 'marked_paid';
  if (s === 'CONFIRMED') return 'confirmed';
  return 'pending';
}

function minutesSince(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 60_000);
}

function formatMarkedAgo(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  return `${h} ч назад`;
}

function debtorStatus(tx: Transaction): Debtor['status'] {
  if (tx.status === 'PAID' || tx.status === 'CONFIRMED') return 'ok';
  const overdue = minutesSince(tx.createdAt);
  if (overdue > 10) return 'late';
  return 'wait';
}

function mapDebtor(tx: Transaction): Debtor {
  const name = personName(tx.debtor);
  const overdue = minutesSince(tx.createdAt);
  const status = debtorStatus(tx);
  const markedAgo =
    tx.status === 'PAID' && tx.paidAt ? formatMarkedAgo(minutesSince(tx.paidAt)) : undefined;
  return {
    id: String(tx.debtorId),
    transactionId: String(tx.id),
    name,
    initial: initialOf(name),
    amount: tx.amount,
    status,
    overdueMinutes: status === 'late' ? Math.round(overdue) : undefined,
    markedAgoText: markedAgo,
  };
}

export function buildBudgetData(args: {
  debts: Transaction[];
  credits: Transaction[];
  isAdmin: boolean;
  currentUserId?: number | null;
  lastCompletedPoll?: Poll | null;
  lastPollResult?: PollResult | null;
}): BudgetData {
  const { debts, credits, isAdmin, currentUserId, lastCompletedPoll, lastPollResult } = args;

  // Проверяем, нужно ли показать свежий завершённый опрос (без транзакций)
  const justClosed = lastCompletedPoll && minutesSince(lastCompletedPoll.closedAt ?? lastCompletedPoll.createdAt) < 20;
  const hasTransactionsForPoll =
    lastCompletedPoll &&
    (debts.some((d) => d.pollId === lastCompletedPoll.id) ||
      credits.some((c) => c.pollId === lastCompletedPoll.id));

  // P2a / P2b / P1a для свежего опроса без транзакций
  if (justClosed && !hasTransactionsForPoll) {
    const responsibleId = lastPollResult?.responsible?.userId;
    const iAmResponsible = responsibleId && responsibleId === currentUserId;

    if (iAmResponsible) {
      return {
        role: 'responsible',
        pollId: String(lastCompletedPoll.id),
        awaitingCalculation: true,
      };
    }

    if (isAdmin) {
      if (!responsibleId) {
        return {
          role: 'admin',
          pollId: String(lastCompletedPoll.id),
          rouletteSpinning: true,
        };
      }
      return {
        role: 'admin',
        pollId: String(lastCompletedPoll.id),
        responsiblePicked: {
          id: String(responsibleId),
          name: lastPollResult!.responsible!.name,
          initial: initialOf(lastPollResult!.responsible!.name),
        },
        calcStatus: 'waiting',
      };
    }
  }

  // P1b / P1c — кредитор (responsible)
  if (credits.length > 0) {
    const latestPollId = Math.max(...credits.map((c) => c.pollId));
    const pollCredits = credits.filter((c) => c.pollId === latestPollId);
    const totalExpected = pollCredits.reduce((s, c) => s + c.amount, 0);
    const totalReceived = pollCredits
      .filter((c) => c.status === 'CONFIRMED')
      .reduce((s, c) => s + c.amount, 0);
    const paidCount = pollCredits.filter(
      (c) => c.status === 'CONFIRMED' || c.status === 'PAID',
    ).length;
    const everyonePaid = pollCredits.every((c) => c.status === 'CONFIRMED');
    const debtors = pollCredits.map(mapDebtor);
    return {
      role: 'responsible',
      pollId: String(latestPollId),
      totalReceived,
      totalExpected,
      paidCount,
      participantCount: pollCredits.length,
      debtors,
      everyonePaid,
    };
  }

  // P3a / P3b / P3c — должник
  const activeDebts = debts.filter((d) => d.status !== 'CONFIRMED');
  if (activeDebts.length > 0) {
    const primary = activeDebts[0];
    const creditorName = personName(primary.creditor);
    const age = minutesSince(primary.createdAt);
    return {
      role: 'participant',
      pollId: primary.poll ? String(primary.poll.id) : undefined,
      myDebt: {
        amount: primary.amount,
        creditor: {
          id: String(primary.creditorId),
          name: creditorName,
          initial: initialOf(creditorName),
        },
        ageMinutes: age,
        status: mapTxStatusToUi(primary.status),
        markedAgoText:
          primary.status === 'PAID' && primary.paidAt
            ? formatMarkedAgo(minutesSince(primary.paidAt))
            : undefined,
      },
    };
  }

  // P3c подтверждение — показать всплывашку успеха
  const recentConfirmedDebt = debts.find(
    (d) => d.status === 'CONFIRMED' && d.confirmedAt && minutesSince(d.confirmedAt) < 3,
  );
  if (recentConfirmedDebt) {
    const creditorName = personName(recentConfirmedDebt.creditor);
    return {
      role: 'participant',
      pollId: recentConfirmedDebt.poll ? String(recentConfirmedDebt.poll.id) : undefined,
      myPaymentConfirmed: true,
      myDebt: {
        amount: recentConfirmedDebt.amount,
        creditor: {
          id: String(recentConfirmedDebt.creditorId),
          name: creditorName,
          initial: initialOf(creditorName),
        },
        ageMinutes: minutesSince(recentConfirmedDebt.createdAt),
        status: 'confirmed',
      },
    };
  }

  const hasHistory = debts.length > 0 || credits.length > 0;
  if (isAdmin) {
    return { role: 'admin', calcStatus: 'done' };
  }
  return { role: 'participant', hasHistory };
}

export function pickPrimaryDebtTransactionId(debts: Transaction[]): number | null {
  const active = debts.find((d) => d.status !== 'CONFIRMED');
  return active ? active.id : null;
}

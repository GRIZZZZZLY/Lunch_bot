import { useMemo, useState } from 'react';
import {
  useCancelMark,
  useConfirmPayment,
  useCredits,
  useDebts,
  useMarkPaid,
  useSendReminder,
} from './useBudget';
import { useAuth } from './useAuth';
import { isGlobalAdmin } from '@/lib/permissions';
import { useLastCompletedPoll, usePollResults } from './usePolls';
import { buildBudgetData, pickPrimaryDebtTransactionId } from '@/lib/budgetMappers';
import type { BudgetCallbacks, BudgetData } from '@/components/budget/types';

export interface UseBudgetWidgetResult {
  data: BudgetData;
  callbacks: BudgetCallbacks;
  calcOpen: boolean;
  openCalculator: () => void;
  closeCalculator: () => void;
  creditsTotal: number;
  creditsParticipants: { id: string; name: string; initial: string }[];
}

export function useBudgetWidget(): UseBudgetWidgetResult {
  const { user } = useAuth();
  const { data: debts = [] } = useDebts();
  const { data: credits = [] } = useCredits();
  const { data: lastCompletedPoll } = useLastCompletedPoll();
  const { data: lastPollResult } = usePollResults(lastCompletedPoll?.id ?? null);

  const markPaid = useMarkPaid();
  const confirmPayment = useConfirmPayment();
  const cancelMark = useCancelMark();
  const sendReminder = useSendReminder();

  const [calcOpen, setCalcOpen] = useState(false);

  const data = useMemo(
    () =>
      buildBudgetData({
        debts,
        credits,
        isAdmin: isGlobalAdmin(user),
        currentUserId: user?.id ?? null,
        lastCompletedPoll: lastCompletedPoll ?? null,
        lastPollResult: lastPollResult ?? null,
      }),
    [debts, credits, user, lastCompletedPoll, lastPollResult],
  );

  const primaryDebtTxId = useMemo(() => pickPrimaryDebtTransactionId(debts), [debts]);

  const callbacks: BudgetCallbacks = useMemo(
    () => ({
      onOpenCalculator: () => setCalcOpen(true),
      onShareSbp: () => undefined,
      onRemindDebtor: (debtorId: string) => {
        const tx = credits.find((c) => String(c.debtorId) === debtorId);
        if (tx) sendReminder.mutate(tx.id);
      },
      onDmResponsible: () => undefined,
      onPaySbp: () => undefined,
      onMarkPaid: () => {
        if (primaryDebtTxId) markPaid.mutate(primaryDebtTxId);
      },
      onCancelMark: () => {
        if (primaryDebtTxId) cancelMark.mutate(primaryDebtTxId);
      },
      onCollapseSuccess: () => undefined,
    }),
    [primaryDebtTxId, credits, markPaid, cancelMark, sendReminder, confirmPayment],
  );

  const creditsTotal = useMemo(
    () => credits.reduce((s, c) => s + c.amount, 0),
    [credits],
  );

  const creditsParticipants = useMemo(
    () =>
      credits.map((c) => ({
        id: String(c.debtorId),
        name: c.debtor?.firstName || c.debtor?.username || 'Участник',
        initial: (c.debtor?.firstName || c.debtor?.username || '?').charAt(0).toUpperCase(),
      })),
    [credits],
  );

  return {
    data,
    callbacks,
    calcOpen,
    openCalculator: () => setCalcOpen(true),
    closeCalculator: () => setCalcOpen(false),
    creditsTotal,
    creditsParticipants,
  };
}

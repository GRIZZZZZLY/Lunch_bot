import type { BudgetCallbacks, BudgetData } from './types';
import {
  CompactResponsibleBanner,
  ResponsibleView,
  SuccessResponsibleView,
} from './subviews/responsible';
import {
  SelectionInProgressCard,
  WaitingForCalculationCard,
} from './subviews/admin';
import {
  UrgentDebtView,
  WaitingConfirmationView,
  SuccessMessageView,
} from './subviews/participant';
import { HiddenState } from './subviews/hidden';
import '@/styles/budget.css';
import '@/styles/budget-overrides.css';

export interface BudgetWidgetProps {
  data: BudgetData;
  callbacks?: BudgetCallbacks;
}

/**
 * Priority-driven budget widget.
 *
 * Priority ordering:
 *   P1 Responsible (role=responsible) — own whatever you must resolve
 *   P2 Admin — observe roulette / wait for responsible
 *   P3 Participant — pay debt / track confirmation
 *   Hidden — no active state
 */
export function BudgetWidget({ data, callbacks = {} }: BudgetWidgetProps) {
  // P1: responsible branches
  if (data.role === 'responsible') {
    if (data.everyonePaid) {
      return <SuccessResponsibleView data={data} cbs={callbacks} />;
    }
    if (data.awaitingCalculation) {
      return <CompactResponsibleBanner cbs={callbacks} />;
    }
    if ((data.debtors?.length ?? 0) > 0) {
      return <ResponsibleView data={data} cbs={callbacks} />;
    }
    // fallthrough — nothing to resolve as responsible
    return <HiddenState data={data} />;
  }

  // P2: admin branches
  if (data.role === 'admin') {
    if (data.rouletteSpinning) {
      return <SelectionInProgressCard />;
    }
    if (data.responsiblePicked && data.calcStatus === 'waiting') {
      return <WaitingForCalculationCard data={data} cbs={callbacks} />;
    }
    return <HiddenState data={data} />;
  }

  // P3: participant branches
  if (data.role === 'participant') {
    if (data.myPaymentConfirmed) {
      return <SuccessMessageView data={data} cbs={callbacks} />;
    }
    if (data.myDebt?.status === 'marked_paid') {
      return <WaitingConfirmationView data={data} cbs={callbacks} />;
    }
    if (data.myDebt && data.myDebt.status === 'pending') {
      return <UrgentDebtView data={data} cbs={callbacks} />;
    }
    return <HiddenState data={data} />;
  }

  return <HiddenState data={data} />;
}

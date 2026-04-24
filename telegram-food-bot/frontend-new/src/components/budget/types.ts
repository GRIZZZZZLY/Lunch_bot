export type BudgetRole = 'responsible' | 'admin' | 'participant';

export type TransactionStatus = 'pending' | 'marked_paid' | 'confirmed' | 'cancelled';

export interface Debtor {
  id: string;
  name: string;
  initial: string;
  amount: number;
  status: 'ok' | 'wait' | 'late';
  overdueMinutes?: number;
  markedAgoText?: string;
  transactionId?: string;
}

export interface Creditor {
  id: string;
  name: string;
  initial: string;
  tgDeepLink?: string;
}

export interface BudgetData {
  role: BudgetRole;
  pollId?: string;
  pollDate?: string;

  /* Responsible (P1) */
  rouletteSpinning?: boolean;
  awaitingCalculation?: boolean;
  totalReceived?: number;
  totalExpected?: number;
  paidCount?: number;
  participantCount?: number;
  debtors?: Debtor[];
  sbpShareLink?: string;
  everyonePaid?: boolean;

  /* Admin (P2) */
  responsiblePicked?: { id: string; name: string; initial: string };
  calcStatus?: 'waiting' | 'done';

  /* Participant (P3) */
  myDebt?: {
    amount: number;
    creditor: Creditor;
    ageMinutes: number;
    status: TransactionStatus;
    sbpPayLink?: string;
    markedAgoText?: string;
  };
  myPaymentConfirmed?: boolean;
  hasHistory?: boolean;
}

export interface BudgetCallbacks {
  onOpenCalculator?: () => void;
  onShareSbp?: () => void;
  onRemindDebtor?: (debtorId: string) => void;
  onDmResponsible?: () => void;
  onPaySbp?: () => void;
  onMarkPaid?: () => void;
  onCancelMark?: () => void;
  onCollapseSuccess?: () => void;
}

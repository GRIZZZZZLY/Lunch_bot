import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '../../src/services/budget.service';
import { CostBreakdownView } from '../../src/components/budget/CostBreakdownView';
import { CostEntryForm } from '../../src/components/budget/CostEntryForm';
import { OverviewView } from '../../src/components/budget/OverviewView';
import { ResponsibleView } from '../../src/components/budget/ResponsibleView';
import { UrgentDebtView } from '../../src/components/budget/UrgentDebtView';
import { WaitingConfirmationView } from '../../src/components/budget/WaitingConfirmationView';

const {
  cancelMark,
  confirmPayment,
  getPollCostBreakdown,
  getPollTotals,
  markAllPaid,
  markAsPaid,
  sendReminder,
  sendRemindersToAll,
  setOrderCosts,
} = vi.hoisted(() => ({
  cancelMark: vi.fn(),
  confirmPayment: vi.fn(),
  getPollCostBreakdown: vi.fn(),
  getPollTotals: vi.fn(),
  markAllPaid: vi.fn(),
  markAsPaid: vi.fn(),
  sendReminder: vi.fn(),
  sendRemindersToAll: vi.fn(),
  setOrderCosts: vi.fn(),
}));

vi.mock('../../src/services/budget.service', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/services/budget.service')>();

  return {
    ...actual,
    budgetService: {
      cancelMark,
      confirmPayment,
      getPollCostBreakdown,
      getPollTotals,
      markAllPaid,
      markAsPaid,
      openSBP: vi.fn(),
      sendReminder,
      sendRemindersToAll,
      setOrderCosts,
    },
  };
});

vi.mock('../../src/hooks/useHaptic', () => ({
  useHaptic: () => ({
    error: vi.fn(),
    impact: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('../../src/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  Wrapper.displayName = 'BudgetFlowWrapper';
  return Wrapper;
};

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 11,
  pollId: 7,
  storeRunId: null,
  storeItemId: null,
  fromUserId: 5,
  toUserId: 9,
  amount: 350,
  menuItemId: 3,
  itemPrice: 300,
  deliveryShare: 50,
  serviceShare: 0,
  tipShare: 0,
  status: 'PENDING',
  createdAt: '2026-06-22T09:00:00.000Z',
  paidAt: null,
  confirmedAt: null,
  fromUser: {
    id: 5,
    telegramId: '5',
    firstName: 'Bob',
    lastName: null,
    username: 'bob',
  },
  toUser: {
    id: 9,
    telegramId: '9',
    firstName: 'Alice',
    lastName: null,
    username: 'alice',
    paymentCard: '1234567812345678',
    paymentPhone: '+79991234567',
    paymentDetails: null,
  },
  menuItem: {
    id: 3,
    name: 'Soup',
    price: 300,
    category: 'lunch',
  },
  poll: {
    id: 7,
    groupId: 2,
    status: 'COMPLETED',
    startedAt: '2026-06-22T08:00:00.000Z',
    endedAt: '2026-06-22T09:00:00.000Z',
    group: {
      id: 2,
      telegramId: '2',
      title: 'Team',
    },
  },
  ...overrides,
});

describe('budget Mini App flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markAsPaid.mockResolvedValue(undefined);
    cancelMark.mockResolvedValue(undefined);
    confirmPayment.mockResolvedValue(undefined);
    markAllPaid.mockResolvedValue(undefined);
    sendReminder.mockResolvedValue(undefined);
    sendRemindersToAll.mockResolvedValue({
      sentCount: 1,
      failedCount: 0,
      totalCount: 1,
      failedUsers: [],
    });
    setOrderCosts.mockResolvedValue({ id: 1 });
    getPollTotals.mockResolvedValue({
      totalOrder: 650,
      totalToReturn: 350,
      responsibleShare: 300,
    });
    getPollCostBreakdown.mockResolvedValue({
      pollId: 7,
      totalItemsCost: 600,
      totalDeliveryCost: 90,
      totalServiceFee: 0,
      totalTip: 0,
      grandTotal: 690,
      participantsCount: 2,
      transactions: [
        {
          transactionId: 11,
          userId: 5,
          userName: 'Bob',
          menuItemName: 'Soup',
          itemPrice: 300,
          deliveryShare: 45,
          serviceShare: 0,
          tipShare: 0,
          totalAmount: 345,
          status: 'PENDING',
        },
      ],
      orderCosts: {
        id: 1,
        pollId: 7,
        deliveryCost: 90,
        serviceFee: 0,
        tip: 0,
        notes: 'delivery',
        enteredBy: 9,
        enteredAt: '2026-06-22T09:00:00.000Z',
        updatedAt: '2026-06-22T09:00:00.000Z',
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('marks a pending debt as paid and can cancel the payment mark', async () => {
    const pendingDebt = makeTransaction();
    const paidDebt = makeTransaction({ status: 'PAID', paidAt: '2026-06-22T09:05:00.000Z' });

    render(<UrgentDebtView debt={pendingDebt} otherDebts={[]} credits={[]} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /Оплатил/i }));

    await waitFor(() => expect(markAsPaid).toHaveBeenCalledWith(11));
    cleanup();

    render(
      <WaitingConfirmationView debt={paidDebt} otherDebts={[]} credits={[]} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByRole('button', { name: /Отменить отметку/i }));

    await waitFor(() => expect(cancelMark).toHaveBeenCalledWith(11));
  });

  it('lets the responsible user confirm one payment, remind everyone and confirm all', async () => {
    const paidCredit = makeTransaction({
      id: 12,
      status: 'PAID',
      paidAt: '2026-06-22T09:05:00.000Z',
    });
    const pendingCredit = makeTransaction({ id: 13 });

    render(<ResponsibleView credits={[paidCredit, pendingCredit]} otherDebts={[]} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /Подтвердить платеж/i }));
    fireEvent.click(screen.getByRole('button', { name: /Напомнить/i }));
    fireEvent.click(screen.getByRole('button', { name: /Все оплатили/i }));

    await waitFor(() => {
      expect(confirmPayment).toHaveBeenCalledWith(12);
      expect(sendRemindersToAll).toHaveBeenCalledWith(7);
      expect(markAllPaid).toHaveBeenCalledWith(7);
    });
  });

  it('lets the responsible user remind one debtor from the overview', async () => {
    render(<OverviewView debts={[]} credits={[makeTransaction()]} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /Напомнить/i }));

    await waitFor(() => expect(sendReminder).toHaveBeenCalledWith(11));
  });

  it('saves order costs and renders the cost breakdown', async () => {
    render(<CostEntryForm pollId={7} />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Доставка/i), {
      target: { value: '90' },
    });
    fireEvent.change(screen.getByLabelText(/Комиссия/i), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText(/Чаевые/i), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить расходы/i }));

    await waitFor(() => {
      expect(setOrderCosts).toHaveBeenCalledWith(7, {
        deliveryCost: 90,
        serviceFee: 0,
        tip: 0,
        notes: undefined,
      });
    });
    cleanup();

    render(<CostBreakdownView pollId={7} userId={5} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(getPollCostBreakdown).toHaveBeenCalledWith(7);
      expect(screen.getByText(/690.00/)).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('delivery')).toBeInTheDocument();
    });
  });
});

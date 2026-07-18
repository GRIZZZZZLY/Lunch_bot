import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecurringPollBadge } from '../../src/components/polls/RecurringPollBadge';
import { BudgetWidget } from '../../src/components/budget/BudgetWidget';
import { queryKeys } from '../../src/lib/react-query';

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: 1,
      firstName: 'Igor',
      telegramId: '1',
      isAdmin: true,
      isActive: true,
      createdAt: '2026-03-27T00:00:00.000Z',
    },
  })),
}));

vi.mock('../../src/services/recurring-poll.service', () => ({
  recurringPollService: {
    getGroupSchedule: vi.fn(),
    formatSchedule: vi.fn(),
    getNextRunInfo: vi.fn(),
  },
}));

vi.mock('../../src/hooks/useBudgetWidget', () => ({
  useBudgetWidget: vi.fn(),
}));

vi.mock('../../src/hooks/useHaptic', () => ({
  useHaptic: () => ({
    light: vi.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  queryClient.setQueryData(queryKeys.user.groups(), [
    {
      id: 1,
      title: 'Rocket Lunch',
      role: 'ADMIN',
      isActive: true,
    },
  ]);

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  Wrapper.displayName = 'HomeCardsTestWrapper';
  return Wrapper;
};

describe('Home cards styling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    document.documentElement.className = '';
  });

  it('renders recurring poll admin card in the same CTA family as home actions', async () => {
    const { recurringPollService } = await import('../../src/services/recurring-poll.service');

    vi.mocked(recurringPollService.getGroupSchedule).mockResolvedValue({
      success: true,
      data: {
        id: 1,
        groupId: 1,
        isEnabled: true,
        daysOfWeek: [1, 2, 3, 4, 5],
        timeOfDay: '11:00',
        duration: 60,
        selectedMenuItemIds: null,
        lastRunAt: null,
        nextRunAt: '2026-03-30T08:00:00.000Z',
        lastRunStatus: null,
        lastRunMessage: null,
        createdBy: 1,
        createdAt: '2026-03-27T00:00:00.000Z',
        updatedAt: '2026-03-27T00:00:00.000Z',
        group: { id: 1, telegramId: '1', title: 'Rocket Lunch' },
        creator: { id: 1, firstName: 'Igor', lastName: null, telegramId: '1' },
      },
    });
    vi.mocked(recurringPollService.formatSchedule).mockReturnValue('Пн-Пт в 11:00 (60 мин)');
    vi.mocked(recurringPollService.getNextRunInfo).mockReturnValue('30 мар., 11:00');

    render(<RecurringPollBadge groupId={1} onClick={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Настроить голосование')).toBeInTheDocument();
    });

    expect(screen.getByTestId('recurring-poll-card')).toHaveClass('rounded-[28px]');
    expect(screen.getByTestId('recurring-poll-card')).toHaveClass('border-lavender-500/32');
    expect(screen.getByTestId('recurring-poll-accent')).toBeInTheDocument();
    expect(screen.getByTestId('recurring-poll-icon-shell')).toHaveClass('rounded-2xl');
  });

  it('renders overview budget widget as a stronger peach CTA surface', async () => {
    const { useBudgetWidget } = await import('../../src/hooks/useBudgetWidget');

    vi.mocked(useBudgetWidget).mockReturnValue({
      scenario: 'overview',
      currentDebt: null,
      otherDebts: [],
      credits: [],
      isResponsible: false,
      pollJustCompleted: false,
      totalDebts: 0,
      totalCredits: 0,
      isLoading: false,
    });

    render(<BudgetWidget />, { wrapper: createWrapper() });

    const financeCard = screen.getByTestId('budget-widget-card');
    expect(financeCard).toHaveClass('rounded-[28px]');
    expect(financeCard).toHaveClass('border-peach-500/32');
    expect(screen.getByTestId('budget-widget-icon-shell')).toHaveClass('rounded-2xl');
    expect(screen.getByTestId('budget-widget-summary-chip')).toBeInTheDocument();
  });
});

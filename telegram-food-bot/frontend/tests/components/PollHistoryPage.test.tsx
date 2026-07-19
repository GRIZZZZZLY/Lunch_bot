import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PollHistoryPage } from '../../src/pages/PollHistoryPage';

const { addNotification, getPollHistory, hapticLight, hapticSelection, navigate } =
  vi.hoisted(() => ({
    addNotification: vi.fn(),
    getPollHistory: vi.fn(),
    hapticLight: vi.fn(),
    hapticSelection: vi.fn(),
    navigate: vi.fn(),
  }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 7, firstName: 'Alice' },
  }),
}));

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => ({
    backButton: {
      onClick: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
    },
  }),
}));

vi.mock('../../src/hooks/useHaptic', () => ({
  useHaptic: () => ({
    light: hapticLight,
    medium: vi.fn(),
    selection: hapticSelection,
    success: vi.fn(),
  }),
}));

vi.mock('../../src/store/useAppStore', () => ({
  useUI: () => ({
    addNotification,
  }),
}));

vi.mock('../../src/components/common/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('../../src/components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div role='status'>loading</div>,
}));

vi.mock('../../src/components/common/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('../../src/components/common/EmptyState', () => ({
  EmptyState: () => <div>No history</div>,
}));

vi.mock('../../src/services/polls.service', () => ({
  pollsService: {
    getPollHistory,
    formatPollDate: (date: string) => date,
    sortPolls: (polls: any[], sortBy: 'date' | 'votes') =>
      [...polls].sort((left, right) => {
        if (sortBy === 'votes') {
          return (right._count?.votes ?? 0) - (left._count?.votes ?? 0);
        }

        return (
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
        );
      }),
  },
}));

const historyPolls = [
  {
    id: 1,
    groupId: 1,
    title: 'Pizza Day',
    status: 'COMPLETED',
    duration: 30,
    startedAt: '2026-06-22T09:00:00.000Z',
    createdAt: '2026-06-22T09:00:00.000Z',
    updatedAt: '2026-06-22T09:30:00.000Z',
    _count: { votes: 3 },
    votes: [{ userId: 7, menuItemId: 10 }],
    results: [{ winnerItemId: 10 }],
  },
  {
    id: 2,
    groupId: 1,
    title: 'Sushi Day',
    status: 'COMPLETED',
    duration: 30,
    startedAt: '2026-06-21T09:00:00.000Z',
    createdAt: '2026-06-21T09:00:00.000Z',
    updatedAt: '2026-06-21T09:30:00.000Z',
    _count: { votes: 5 },
    votes: [{ userId: 9, menuItemId: 11 }],
    results: [{ winnerItemId: 11 }],
  },
];

describe('PollHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPollHistory.mockResolvedValue({
      success: true,
      data: {
        polls: historyPolls,
        total: 2,
        limit: 20,
        offset: 0,
        hasNext: false,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('opens poll results from the history list', async () => {
    render(<PollHistoryPage />);

    expect(await screen.findByText('Pizza Day')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Pizza Day/ }));

    expect(hapticLight).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/poll/1/results');
  });

  it('filters the loaded history without duplicating polls', async () => {
    render(<PollHistoryPage />);

    expect(await screen.findByText('Pizza Day')).toBeInTheDocument();
    expect(screen.getByText('Sushi Day')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /победил/i }));

    await waitFor(() => {
      expect(screen.queryByText('Sushi Day')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByText('Pizza Day')).toHaveLength(1);
    });
    expect(getPollHistory).toHaveBeenCalledTimes(1);
    expect(hapticSelection).toHaveBeenCalledTimes(1);
  });
});

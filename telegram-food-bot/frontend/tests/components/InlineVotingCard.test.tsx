import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InlineVotingCard } from '../../src/components/voting/InlineVotingCard';
import type { PollWithDetails } from '../../src/services/polls.service';

const {
  addNotification,
  cancelPoll,
  completePoll,
  getActiveItems,
  getPollById,
  haptic,
  isGroupAdminMock,
  removeVote,
  user,
  voteForItem,
  voteForMultipleItems,
} = vi.hoisted(() => ({
  addNotification: vi.fn(),
  cancelPoll: vi.fn(),
  completePoll: vi.fn(),
  getActiveItems: vi.fn(),
  getPollById: vi.fn(),
  haptic: {
    error: vi.fn(),
    impact: vi.fn(),
    light: vi.fn(),
    medium: vi.fn(),
    selection: vi.fn(),
    success: vi.fn(),
  },
  isGroupAdminMock: vi.fn(),
  removeVote: vi.fn(),
  user: {
    id: 3,
    telegramId: '3',
    firstName: 'User',
    isAdmin: false,
    isActive: true,
    createdAt: '2026-06-22T00:00:00.000Z',
  },
  voteForItem: vi.fn(),
  voteForMultipleItems: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user,
  }),
}));

vi.mock('../../src/hooks/useIsGroupAdmin', () => ({
  useIsGroupAdmin: () => isGroupAdminMock(),
}));

vi.mock('../../src/hooks/useHaptic', () => ({
  useHaptic: () => haptic,
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: (state: { addNotification: typeof addNotification }) => unknown) =>
    selector({ addNotification }),
}));

vi.mock('../../src/lib/analytics', () => ({
  ANALYTICS_EVENTS: {
    VOTE_SUBMITTED: 'vote_submitted',
  },
  trackEvent: vi.fn(),
}));

vi.mock('../../src/services/insights.service', () => ({
  recordVote: vi.fn(),
}));

vi.mock('../../src/components/ui/number-ticker', () => ({
  NumberTicker: ({ value }: { value: number }) => <span>{value}</span>,
}));

vi.mock('../../src/components/voting/VotersAvatars', () => ({
  VotersAvatars: () => <div data-testid="voters-avatars" />,
}));

vi.mock('../../src/services/menu.service', () => ({
  menuService: {
    getActiveItems,
  },
}));

vi.mock('../../src/services/polls.service', () => ({
  pollsService: {
    cancelPoll,
    completePoll,
    getPollById,
    removeVote,
    voteForItem,
    voteForMultipleItems,
  },
}));

const poll: PollWithDetails = {
  id: 7,
  groupId: 2,
  title: 'Lunch',
  status: 'ACTIVE',
  duration: 30,
  startedAt: '2026-06-22T09:00:00.000Z',
  endTime: '2026-06-22T09:30:00.000Z',
  selectedMenuItemIds: '[10,11,12]',
  isMultiSelect: false,
  maxSelections: 1,
  createdAt: '2026-06-22T09:00:00.000Z',
  updatedAt: '2026-06-22T09:00:00.000Z',
  group: {
    id: 2,
    title: 'Team Two',
    telegramId: '2',
  },
  votes: [],
  results: [],
};

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
  Wrapper.displayName = 'InlineVotingCardTestWrapper';
  return Wrapper;
};

describe('InlineVotingCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.className = '';
    isGroupAdminMock.mockReturnValue(false);
    getPollById.mockResolvedValue({
      success: true,
      data: poll,
    });
    getActiveItems.mockResolvedValue({
      success: true,
      data: [
        {
          id: 10,
          groupId: 2,
          name: 'Pizza',
          isActive: true,
          createdAt: '2026-06-22T00:00:00.000Z',
          updatedAt: '2026-06-22T00:00:00.000Z',
        },
        {
          id: 11,
          groupId: 2,
          name: 'Sushi',
          isActive: true,
          createdAt: '2026-06-22T00:00:00.000Z',
          updatedAt: '2026-06-22T00:00:00.000Z',
        },
      ],
    });
    voteForItem.mockResolvedValue({
      success: true,
      data: {
        id: 50,
        pollId: 7,
        userId: 3,
        menuItemId: 10,
        createdAt: '2026-06-22T09:01:00.000Z',
        user: { id: 3, firstName: 'User' },
        menuItem: { id: 10, name: 'Pizza' },
      },
    });
    voteForMultipleItems.mockResolvedValue({
      success: true,
      data: [],
    });
    removeVote.mockResolvedValue({
      success: true,
    });
    completePoll.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        pollId: 7,
        totalVotes: 1,
        isRouletteRun: true,
        createdAt: '2026-06-22T09:30:00.000Z',
      },
    });
    cancelPoll.mockResolvedValue({
      success: true,
      data: {
        ...poll,
        status: 'CANCELLED',
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('sends a single-selection poll vote through the single vote endpoint', async () => {
    render(<InlineVotingCard poll={poll} />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole('option', { name: 'Pizza' }));
    fireEvent.click(screen.getByRole('button', { name: /Проголосовать/ }));

    await waitFor(() => {
      expect(voteForItem).toHaveBeenCalledWith(7, 10);
    });
    expect(voteForMultipleItems).not.toHaveBeenCalled();
  });

  it('renders the active poll status and available dishes', async () => {
    render(<InlineVotingCard poll={poll} />, { wrapper: createWrapper() });

    expect(await screen.findByText('Pizza')).toBeInTheDocument();
    expect(screen.getByText('Sushi')).toBeInTheDocument();
    expect(screen.getByText('Активно')).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: /Список блюд/ })).toHaveAttribute(
      'aria-multiselectable',
      'false'
    );
  });

  it('sends a multi-selection poll vote through the multiple vote endpoint', async () => {
    const multiPoll: PollWithDetails = {
      ...poll,
      isMultiSelect: true,
      maxSelections: 2,
    };
    getPollById.mockResolvedValue({
      success: true,
      data: multiPoll,
    });

    render(<InlineVotingCard poll={multiPoll} />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole('option', { name: 'Pizza' }));
    fireEvent.click(screen.getByRole('option', { name: 'Sushi' }));
    fireEvent.click(screen.getByRole('button', { name: /Проголосовать/ }));

    await waitFor(() => {
      expect(voteForMultipleItems).toHaveBeenCalledWith(7, [10, 11]);
    });
    expect(voteForItem).not.toHaveBeenCalled();
  });

  it('removes the current user vote while the poll is active', async () => {
    const votedPoll: PollWithDetails = {
      ...poll,
      votes: [
        {
          id: 80,
          pollId: 7,
          userId: 3,
          menuItemId: 10,
          createdAt: '2026-06-22T09:01:00.000Z',
          user: {
            id: 3,
            telegramId: '3',
            firstName: 'User',
          },
          menuItem: {
            id: 10,
            name: 'Pizza',
          },
        },
      ],
    };
    getPollById.mockResolvedValue({
      success: true,
      data: votedPoll,
    });

    render(<InlineVotingCard poll={votedPoll} />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole('button', { name: /Отменить голос/ }));

    await waitFor(() => {
      expect(removeVote).toHaveBeenCalledWith(7);
    });
  });

  it('lets an admin complete an active poll early', async () => {
    isGroupAdminMock.mockReturnValue(true);

    render(<InlineVotingCard poll={poll} onPollClosed={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(await screen.findByTitle(/Завершить голосование/));
    fireEvent.click(await screen.findByRole('button', { name: 'Завершить' }));

    await waitFor(() => {
      expect(completePoll).toHaveBeenCalledWith(7);
    });
  });

  it('lets an admin cancel an active poll from the confirmation dialog', async () => {
    isGroupAdminMock.mockReturnValue(true);

    render(<InlineVotingCard poll={poll} onPollClosed={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(await screen.findByTitle(/Завершить голосование/));
    fireEvent.click(
      await screen.findByRole('button', { name: /Отменить голосование/ })
    );

    await waitFor(() => {
      expect(cancelPoll).toHaveBeenCalledWith(
        7,
        'Отменено администратором'
      );
    });
  });
});

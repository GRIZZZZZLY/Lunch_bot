/**
 * Component Tests: VotingPage
 * P2 Task: Unit testing для критичных компонентов
 * 
 * Testing Library + Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import VotingPage from '../../src/pages/VotingPage';

// Mock hooks
vi.mock('../../src/hooks/usePolls', () => ({
  usePoll: vi.fn(),
  useVote: vi.fn(),
}));

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => ({
    user: { id: 123, username: 'test_user' },
    haptic: { impactOccurred: vi.fn(), selectionChanged: vi.fn() },
    WebApp: { ready: vi.fn(), close: vi.fn() },
  }),
}));

// Test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('VotingPage', () => {
  const mockPoll = {
    id: 1,
    question: 'Что на обед?',
    startTime: new Date('2025-01-10T10:00:00'),
    endTime: new Date('2025-01-10T14:00:00'),
    menuItems: [
      { id: 101, name: 'Борщ', price: 250, category: 'первые блюда' },
      { id: 102, name: 'Плов', price: 300, category: 'вторые блюда' },
      { id: 103, name: 'Салат Цезарь', price: 200, category: 'салаты' },
    ],
    votes: [],
    _count: { votes: 0 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render poll question and menu items', async () => {
    const { usePoll } = await import('../../src/hooks/usePolls');
    vi.mocked(usePoll).mockReturnValue({
      data: mockPoll,
      isLoading: false,
      error: null,
    } as any);

    render(<VotingPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Что на обед?')).toBeInTheDocument();
    expect(screen.getByText('Борщ')).toBeInTheDocument();
    expect(screen.getByText('Плов')).toBeInTheDocument();
    expect(screen.getByText('Салат Цезарь')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    const { usePoll } = require('../../src/hooks/usePolls');
    vi.mocked(usePoll).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<VotingPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('should handle vote submission', async () => {
    const mockVote = vi.fn();
    const { usePoll, useVote } = require('../../src/hooks/usePolls');
    
    vi.mocked(usePoll).mockReturnValue({
      data: mockPoll,
      isLoading: false,
    } as any);
    
    vi.mocked(useVote).mockReturnValue({
      mutate: mockVote,
      isPending: false,
    } as any);

    const user = userEvent.setup();
    render(<VotingPage />, { wrapper: createWrapper() });

    // Кликаем на "Борщ"
    const borschItem = screen.getByText('Борщ').closest('[data-testid="menu-item"]');
    await user.click(borschItem!);

    await waitFor(() => {
      expect(mockVote).toHaveBeenCalledWith({
        pollId: 1,
        menuItemId: 101,
      });
    });
  });

  it('should show error message on vote failure', async () => {
    const { usePoll, useVote } = require('../../src/hooks/usePolls');
    
    vi.mocked(usePoll).mockReturnValue({
      data: mockPoll,
      isLoading: false,
    } as any);
    
    vi.mocked(useVote).mockReturnValue({
      mutate: vi.fn((_vars, { onError }) => {
        onError?.(new Error('Network error'), _vars, undefined);
      }),
      isPending: false,
      error: new Error('Network error'),
    } as any);

    render(<VotingPage />, { wrapper: createWrapper() });

    const user = userEvent.setup();
    const firstItem = screen.getByText('Борщ').closest('[data-testid="menu-item"]');
    await user.click(firstItem!);

    await waitFor(() => {
      expect(screen.getByText(/ошибка/i)).toBeInTheDocument();
    });
  });

  it('should filter menu items by category', async () => {
    const { usePoll } = require('../../src/hooks/usePolls');
    vi.mocked(usePoll).mockReturnValue({
      data: mockPoll,
      isLoading: false,
    } as any);

    render(<VotingPage />, { wrapper: createWrapper() });

    // Кликаем фильтр "первые блюда"
    const filterChip = screen.getByText('первые блюда');
    await userEvent.click(filterChip);

    await waitFor(() => {
      expect(screen.getByText('Борщ')).toBeVisible();
      expect(screen.queryByText('Плов')).not.toBeInTheDocument();
      expect(screen.queryByText('Салат Цезарь')).not.toBeInTheDocument();
    });
  });

  it('should display voters avatars after vote', async () => {
    const pollWithVotes = {
      ...mockPoll,
      votes: [
        { id: 1, userId: 123, user: { username: 'user1' }, menuItemId: 101 },
        { id: 2, userId: 456, user: { username: 'user2' }, menuItemId: 101 },
      ],
      _count: { votes: 2 },
    };

    const { usePoll } = require('../../src/hooks/usePolls');
    vi.mocked(usePoll).mockReturnValue({
      data: pollWithVotes,
      isLoading: false,
    } as any);

    render(<VotingPage />, { wrapper: createWrapper() });

    const votersAvatars = screen.getAllByTestId('voter-avatar');
    expect(votersAvatars).toHaveLength(2);
  });

  it('should show poll closed message after endTime', () => {
    const closedPoll = {
      ...mockPoll,
      endTime: new Date('2025-01-10T09:00:00'), // в прошлом
      isActive: false,
    };

    const { usePoll } = require('../../src/hooks/usePolls');
    vi.mocked(usePoll).mockReturnValue({
      data: closedPoll,
      isLoading: false,
    } as any);

    render(<VotingPage />, { wrapper: createWrapper() });

    expect(screen.getByText(/голосование завершено/i)).toBeInTheDocument();
  });

  it('should display timer countdown', () => {
    const { usePoll } = require('../../src/hooks/usePolls');
    vi.mocked(usePoll).mockReturnValue({
      data: mockPoll,
      isLoading: false,
    } as any);

    render(<VotingPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('poll-timer')).toBeInTheDocument();
  });

  it('should show empty state when no menu items', () => {
    const emptyPoll = {
      ...mockPoll,
      menuItems: [],
    };

    const { usePoll } = require('../../src/hooks/usePolls');
    vi.mocked(usePoll).mockReturnValue({
      data: emptyPoll,
      isLoading: false,
    } as any);

    render(<VotingPage />, { wrapper: createWrapper() });

    expect(screen.getByText(/нет доступных блюд/i)).toBeInTheDocument();
  });
});

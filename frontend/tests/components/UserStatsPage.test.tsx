import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserStatsPage } from '../../src/pages/UserStatsPage';

const { getUserParticipationStats } = vi.hoisted(() => ({
  getUserParticipationStats: vi.fn(),
}));

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => ({
    backButton: {
      hide: vi.fn(),
      onClick: vi.fn(),
      show: vi.fn(),
    },
    colorScheme: 'light',
  }),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 5,
      firstName: 'Igor',
      telegramId: '5',
      isAdmin: false,
      isActive: true,
      createdAt: '2026-06-26T09:00:00.000Z',
    },
  }),
}));

vi.mock('../../src/services/polls.service', () => ({
  pollsService: {
    getUserParticipationStats,
  },
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <UserStatsPage />
    </MemoryRouter>
  );

describe('UserStatsPage Mini App flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserParticipationStats.mockResolvedValue({
      success: true,
      data: {
        favoriteItems: [
          {
            itemId: 1,
            itemName: 'Борщ',
            percentage: 60,
            voteCount: 3,
          },
        ],
        participationRate: 75,
        recentActivity: [],
        totalPolls: 4,
        totalVotes: 3,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads user stats and does not write API payloads to console', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderPage();

    expect(await screen.findByText('Моя статистика')).toBeInTheDocument();
    expect(screen.getByText('Борщ')).toBeInTheDocument();
    await waitFor(() => expect(getUserParticipationStats).toHaveBeenCalledTimes(1));
    expect(logSpy).not.toHaveBeenCalled();
    expect(
      errorSpy.mock.calls.filter(([message]) =>
        String(message).includes('[UserStatsPage]')
      )
    ).toEqual([]);
  });
});

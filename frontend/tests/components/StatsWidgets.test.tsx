import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetInsightsWidget } from '../../src/components/stats/BudgetInsightsWidget';
import { Leaderboard } from '../../src/components/stats/Leaderboard';

const { getBudgetInsights, getCategoryInsights, getLeaderboard } = vi.hoisted(
  () => ({
    getBudgetInsights: vi.fn(),
    getCategoryInsights: vi.fn(),
    getLeaderboard: vi.fn(),
  })
);

vi.mock('../../src/services/gamification.service', () => ({
  gamificationService: {
    getLeaderboard,
  },
}));

vi.mock('../../src/services/insights.service', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/services/insights.service')>();

  return {
    ...actual,
    insightsApiService: {
      getBudgetInsights,
      getCategoryInsights,
    },
  };
});

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: (state: { theme: 'light' }) => unknown) =>
    selector({ theme: 'light' }),
}));

describe('stats API-backed widgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLeaderboard.mockResolvedValue({
      success: true,
      data: [
        {
          position: 1,
          totalXP: 420,
          level: 4,
          rank: 'Гурман',
          user: {
            id: 5,
            firstName: 'Igor',
            lastName: 'Rocket',
            username: 'igor',
          },
        },
      ],
    });
    getBudgetInsights.mockResolvedValue({
      success: true,
      data: {
        averagePerDay: 350,
        daysActive: 4,
        projectedMonthly: 10500,
        savingsVsExternal: 1200,
        totalSpent: 1400,
        trend: 'stable',
      },
    });
    getCategoryInsights.mockResolvedValue({
      success: true,
      data: {
        favoriteCategory: 'Суп',
        totalVotes: 8,
        categories: [{ category: 'Суп', count: 5, percentage: 63, items: ['Борщ'] }],
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads and renders the gamification leaderboard', async () => {
    render(<Leaderboard isDark={false} groupId={2} />);

    await waitFor(() =>
      expect(getLeaderboard).toHaveBeenCalledWith({
        category: 'TOTAL',
        groupId: 2,
        limit: 10,
      })
    );

    expect(await screen.findByText('Igor Rocket')).toBeInTheDocument();
    expect(screen.getByText(/420 XP/i)).toBeInTheDocument();
    expect(screen.getByText(/Гурман/i)).toBeInTheDocument();
  });

  it('loads and renders budget and category insights', async () => {
    render(<BudgetInsightsWidget />);

    await waitFor(() => expect(getBudgetInsights).toHaveBeenCalledTimes(1));
    expect(getCategoryInsights).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('350₽')).toBeInTheDocument();
    expect(screen.getByText('1200₽')).toBeInTheDocument();
    expect(screen.getByText(/Суп/i)).toBeInTheDocument();
  });
});

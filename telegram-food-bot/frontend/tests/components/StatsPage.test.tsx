import '@testing-library/jest-dom/vitest';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StatsPage } from '../../src/pages/StatsPage';

const { pollServiceMocks, menuServiceMocks } = vi.hoisted(() => ({
  pollServiceMocks: {
    getAllPolls: vi.fn(),
    getPollStats: vi.fn(),
    getPopularItems: vi.fn(),
    sortPolls: vi.fn(() => []),
    groupPollsByStatus: vi.fn(() => ({ active: [], completed: [] })),
  },
  menuServiceMocks: {
    getAllItems: vi.fn(),
  },
}));

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => ({
    backButton: {
      onClick: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
    },
    colorScheme: 'light',
  }),
}));

vi.mock('../../src/hooks/useConfetti', () => ({
  useConfetti: () => ({
    achievement: vi.fn(),
    fireworks: vi.fn(),
    cannon: vi.fn(),
    stars: vi.fn(),
    mini: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useHaptic', () => ({
  useHaptic: () => ({
    light: vi.fn(),
    medium: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      firstName: 'Igor',
      telegramId: '1',
      isAdmin: true,
      isActive: true,
      createdAt: '2026-03-28T00:00:00.000Z',
    },
  }),
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: (state: { addNotification: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ addNotification: vi.fn() }),
}));

vi.mock('../../src/services/polls.service', () => ({
  pollsService: pollServiceMocks,
}));

vi.mock('../../src/services/menu.service', () => ({
  menuService: menuServiceMocks,
}));

vi.mock('../../src/components/stats', () => ({
  CustomTooltip: () => null,
  CountUp: () => null,
  PersonalHeroCard: () => <div data-testid='personal-hero-card'>Моя статистика</div>,
  FavoriteDishesCarousel: () => <div data-testid='favorite-dishes-carousel'>Любимые блюда</div>,
  AchievementBadgesGrid: () => <div data-testid='achievement-badges-grid'>Achievements</div>,
  Leaderboard: () => <div data-testid='leaderboard'>Leaderboard</div>,
  ChallengesPanel: () => <div data-testid='challenges-panel'>Challenges</div>,
  BudgetInsightsWidget: () => <div data-testid='budget-insights-widget'>Budget Insights</div>,
  LunchDnaCard: () => <div data-testid='lunch-dna-card'>Lunch DNA</div>,
}));

vi.mock('../../src/components/budget', () => ({
  BudgetWidgetCompact: () => <div data-testid='budget-widget-compact'>Budget Widget Compact</div>,
}));

vi.mock('../../src/components/insights/InsightsCard', () => ({
  InsightsCard: () => <div data-testid='insights-card'>Insights</div>,
}));

vi.mock('../../src/components/stats/RecommendationsCard', () => ({
  RecommendationsCard: () => <div data-testid='recommendations-card'>Recommendations</div>,
}));

vi.mock('../../src/components/polls/PollCard', () => ({
  PollCard: () => <div data-testid='poll-card'>Poll Card</div>,
}));

vi.mock('../../src/components/polls/PollResults', () => ({
  PollResults: () => <div data-testid='poll-results'>Poll Results</div>,
}));

vi.mock('recharts', () => ({
  PieChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Pie: () => <div />,
  LineChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  AreaChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Cell: () => <div />,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/services/insights.service', () => ({
  generatePersonalInsights: vi.fn(() => []),
  getQuickStats: vi.fn(() => ({ totalVotes: 8, uniqueDishes: 3, topDish: 'Борщ' })),
  getFavoriteDishes: vi.fn(() => [{ name: 'Борщ', count: 4, percentage: 50 }]),
  getRotatingRecommendations: vi.fn(() => []),
  getStoredVoteHistory: vi.fn(() => []),
}));

describe('StatsPage personal tab composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pollServiceMocks.getAllPolls.mockResolvedValue({ success: true, data: [] });
    pollServiceMocks.getPollStats.mockResolvedValue({
      success: true,
      data: { totalPolls: 12, activePolls: 2, completedPolls: 10, totalVotes: 40, averageParticipants: 5 },
    });
    pollServiceMocks.getPopularItems.mockResolvedValue({ success: true, data: [] });
    menuServiceMocks.getAllItems.mockResolvedValue({ success: true, data: [] });
  });

  it('should render Lunch DNA first in personal tab and remove weak placeholder blocks', async () => {
    render(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('lunch-dna-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('budget-widget-compact')).toBeInTheDocument();
    expect(screen.queryByTestId('personal-hero-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('favorite-dishes-carousel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('achievement-badges-grid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('challenges-panel')).not.toBeInTheDocument();
  });
});

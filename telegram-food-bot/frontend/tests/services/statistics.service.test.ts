import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gamificationService } from '../../src/services/gamification.service';
import { insightsApiService } from '../../src/services/insights.service';

const { apiGet } = vi.hoisted(() => ({
  apiGet: vi.fn(),
}));

vi.mock('../../src/services/api.service', () => ({
  apiService: {
    get: apiGet,
  },
}));

describe('statistics API services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads leaderboard with category, limit, and group filters', async () => {
    apiGet.mockResolvedValue({ success: true, data: [] });

    await gamificationService.getLeaderboard({
      category: 'TOTAL',
      groupId: 2,
      limit: 10,
    });

    expect(apiGet).toHaveBeenCalledWith(
      '/gamification/leaderboard?category=TOTAL&limit=10&groupId=2'
    );
  });

  it('loads budget and category insights from backend analytics endpoints', async () => {
    apiGet.mockResolvedValue({ success: true, data: {} });

    await insightsApiService.getBudgetInsights();
    await insightsApiService.getCategoryInsights();

    expect(apiGet).toHaveBeenNthCalledWith(1, '/insights/budget');
    expect(apiGet).toHaveBeenNthCalledWith(2, '/insights/categories');
  });
});

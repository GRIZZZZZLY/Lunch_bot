import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pollsService } from '../../src/services/polls.service';

const { apiGet, apiPatch, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('../../src/services/api.service', () => ({
  apiService: {
    get: apiGet,
    patch: apiPatch,
    post: apiPost,
  },
}));

describe('pollsService legacy method routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes a poll through the current complete endpoint', async () => {
    apiPatch.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        pollId: 7,
        totalVotes: 3,
        isRouletteRun: true,
        createdAt: '2026-06-22T09:30:00.000Z',
      },
    });

    const response = await pollsService.closePoll(7);

    expect(response.success).toBe(true);
    expect(apiPatch).toHaveBeenCalledWith('/polls/7/complete', {});
    expect(apiPost).not.toHaveBeenCalledWith('/polls/7/close');
  });

  it('loads current user votes from the votes API', async () => {
    apiGet.mockResolvedValue({
      success: true,
      data: { menuItemIds: [10, 11] },
    });

    const response = await pollsService.getUserVotes(7);

    expect(response.data?.menuItemIds).toEqual([10, 11]);
    expect(apiGet).toHaveBeenCalledWith('/votes/7/user');
    expect(apiGet).not.toHaveBeenCalledWith('/polls/7/my-votes');
  });

  it('loads the last completed poll for the selected group', async () => {
    apiGet.mockResolvedValue({
      success: true,
      data: { id: 9, groupId: 3, status: 'COMPLETED' },
    });

    const response = await pollsService.getLastCompleted(3);

    expect(response.data?.id).toBe(9);
    expect(apiGet).toHaveBeenCalledWith('/polls/last-completed?groupId=3');
  });

  it('repeats a poll through the repeat endpoint', async () => {
    apiPost.mockResolvedValue({
      success: true,
      data: { id: 10, groupId: 3, status: 'ACTIVE' },
    });

    const response = await pollsService.repeatPoll(9);

    expect(response.data?.id).toBe(10);
    expect(apiPost).toHaveBeenCalledWith('/polls/repeat/9');
  });

  it('loads popular dishes for the top dish Mini App action', async () => {
    apiGet.mockResolvedValue({
      success: true,
      data: [
        {
          menuItemName: 'Борщ',
          totalVotes: 7,
          percentage: 45,
        },
      ],
    });

    const response = await pollsService.getPopularItems(1, 42);

    expect(response.data?.[0].menuItemName).toBe('Борщ');
    expect(apiGet).toHaveBeenCalledWith(
      '/polls/popular-items?limit=1&groupId=42'
    );
  });
});

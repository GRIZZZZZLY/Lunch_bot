import { beforeEach, describe, expect, it, vi } from 'vitest';
import { suggestionService } from '../../src/services/suggestion.service';

const { apiDelete, apiGet, apiPost } = vi.hoisted(() => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('../../src/services/api.service', () => ({
  apiService: {
    delete: apiDelete,
    get: apiGet,
    post: apiPost,
  },
}));

describe('suggestionService routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a suggestion with the selected group id', async () => {
    apiPost.mockResolvedValue({ success: true, data: { id: 10, name: 'Soup' } });

    await suggestionService.createSuggestion({
      name: 'Soup',
      description: 'Hot',
      price: 250,
      imageUrl: 'https://example.com/soup.jpg',
      groupId: 2,
    });

    expect(apiPost).toHaveBeenCalledWith('/suggestions', {
      name: 'Soup',
      description: 'Hot',
      price: 250,
      imageUrl: 'https://example.com/soup.jpg',
      groupId: 2,
    });
  });

  it('loads suggestions for the selected group and status', async () => {
    apiGet.mockResolvedValue({ success: true, data: [] });

    await suggestionService.getSuggestions({
      status: 'PENDING',
      limit: 20,
      offset: 0,
      groupId: 2,
    } as any);

    expect(apiGet).toHaveBeenCalledWith(
      '/suggestions?status=PENDING&limit=20&groupId=2'
    );
  });

  it('approves and rejects suggestions in the selected group', async () => {
    apiPost.mockResolvedValue({ success: true, data: {} });

    await suggestionService.approveSuggestion(10, 2);
    await suggestionService.rejectSuggestion(11, 'Too expensive', 2);

    expect(apiPost).toHaveBeenNthCalledWith(1, '/suggestions/10/approve', {
      groupId: 2,
    });
    expect(apiPost).toHaveBeenNthCalledWith(2, '/suggestions/11/reject', {
      reason: 'Too expensive',
      groupId: 2,
    });
  });

  it('loads group-scoped suggestion stats and pending count', async () => {
    apiGet.mockResolvedValue({ success: true, data: {} });

    await suggestionService.getStats(2);
    await suggestionService.getPendingCount(2);

    expect(apiGet).toHaveBeenNthCalledWith(1, '/suggestions/stats?groupId=2');
    expect(apiGet).toHaveBeenNthCalledWith(2, '/suggestions/pending-count?groupId=2');
  });

  it('deletes a rejected suggestion in the selected group', async () => {
    apiDelete.mockResolvedValue({ success: true });

    await suggestionService.deleteSuggestion(10, 2);

    expect(apiDelete).toHaveBeenCalledWith('/suggestions/10?groupId=2');
  });
});

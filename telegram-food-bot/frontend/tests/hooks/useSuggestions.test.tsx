import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCreateSuggestion,
  useDeleteSuggestion,
  usePendingCount,
  useSuggestionStats,
  useSuggestions,
} from '../../src/hooks/useSuggestions';

const {
  addNotification,
  approveSuggestion,
  createSuggestion,
  deleteSuggestion,
  getPendingCount,
  getStats,
  getSuggestions,
  rejectSuggestion,
} = vi.hoisted(() => ({
  addNotification: vi.fn(),
  approveSuggestion: vi.fn(),
  createSuggestion: vi.fn(),
  deleteSuggestion: vi.fn(),
  getPendingCount: vi.fn(),
  getStats: vi.fn(),
  getSuggestions: vi.fn(),
  rejectSuggestion: vi.fn(),
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({
      addNotification,
    }),
}));

vi.mock('../../src/hooks/useCurrentGroup', () => ({
  useCurrentGroup: () => ({
    currentGroupId: 2,
  }),
}));

vi.mock('../../src/hooks/useIsGroupAdmin', () => ({
  useIsGroupAdmin: () => true,
}));

vi.mock('../../src/services/suggestion.service', () => ({
  suggestionService: {
    approveSuggestion,
    createSuggestion,
    deleteSuggestion,
    getPendingCount,
    getStats,
    getSuggestions,
    rejectSuggestion,
  },
}));

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
  Wrapper.displayName = 'UseSuggestionsTestWrapper';
  return Wrapper;
};

describe('useSuggestions hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSuggestion.mockResolvedValue({
      success: true,
      data: { id: 10, name: 'Soup', status: 'PENDING' },
    });
    deleteSuggestion.mockResolvedValue({ success: true });
    getPendingCount.mockResolvedValue({ success: true, data: { count: 3 } });
    getStats.mockResolvedValue({
      success: true,
      data: { total: 4, pending: 3, approved: 1, rejected: 0, approvalRate: 25 },
    });
    getSuggestions.mockResolvedValue({ success: true, data: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('adds the current group id when creating a suggestion', async () => {
    const { result } = renderHook(() => useCreateSuggestion(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Soup',
        description: 'Hot',
        price: 250,
        imageUrl: 'https://example.com/soup.jpg',
      });
    });

    expect(createSuggestion).toHaveBeenCalledWith({
      name: 'Soup',
      description: 'Hot',
      price: 250,
      imageUrl: 'https://example.com/soup.jpg',
      groupId: 2,
    });
  });

  it('loads suggestions, stats, pending count and deletes inside the current group', async () => {
    renderHook(() => useSuggestions({ status: 'PENDING' }), {
      wrapper: createWrapper(),
    });
    renderHook(() => useSuggestionStats(), {
      wrapper: createWrapper(),
    });
    renderHook(() => usePendingCount(), {
      wrapper: createWrapper(),
    });
    const { result } = renderHook(() => useDeleteSuggestion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(getSuggestions).toHaveBeenCalledWith({
        status: 'PENDING',
        groupId: 2,
      });
      expect(getStats).toHaveBeenCalledWith(2);
      expect(getPendingCount).toHaveBeenCalledWith(2);
    });

    await act(async () => {
      await result.current.mutateAsync(10);
    });

    expect(deleteSuggestion).toHaveBeenCalledWith(10, 2);
  });
});

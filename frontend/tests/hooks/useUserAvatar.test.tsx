import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserAvatar } from '../../src/hooks/useUserAvatar';

const { getUserAvatarMock } = vi.hoisted(() => ({
  getUserAvatarMock: vi.fn(),
}));

vi.mock('@/services/user.service', () => ({
  userService: {
    getUserAvatar: getUserAvatarMock,
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'AvatarTestWrapper';
  return Wrapper;
};

describe('useUserAvatar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads an avatar through API and stores it in local cache without console noise', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    getUserAvatarMock.mockResolvedValue({
      success: true,
      data: {
        avatarUrl: '/api/avatar/file-1?exp=1&sig=abc',
        telegramId: '500',
        userId: 5,
      },
    });

    const { result } = renderHook(() => useUserAvatar(5), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.avatarUrl).toBe('/api/avatar/file-1?exp=1&sig=abc');
    });

    expect(getUserAvatarMock).toHaveBeenCalledWith(5);
    expect(window.localStorage.getItem('user_avatars_cache_v2')).toContain(
      '/api/avatar/file-1?exp=1&sig=abc'
    );
    expect(logSpy).not.toHaveBeenCalled();
    const appErrorCalls = errorSpy.mock.calls.filter(
      ([message]) => !String(message).includes('ReactDOMTestUtils.act')
    );
    expect(appErrorCalls).toHaveLength(0);
  });
});

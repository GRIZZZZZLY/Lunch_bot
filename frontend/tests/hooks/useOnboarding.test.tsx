import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnboarding } from '../../src/hooks/useOnboarding';

describe('useOnboarding', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('opens onboarding on first launch and completes it without console noise', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => {
      expect(result.current.isModalOpen).toBe(true);
    });

    await act(async () => {
      result.current.completeOnboarding();
    });

    expect(window.localStorage.getItem('food_bot_onboarding_completed')).toBe('true');
    expect(window.localStorage.getItem('food_bot_onboarding_completed_version')).toBe('v1');
    expect(result.current.isModalOpen).toBe(false);
    expect(logSpy).not.toHaveBeenCalled();
    const appErrorCalls = errorSpy.mock.calls.filter(
      ([message]) => !String(message).includes('ReactDOMTestUtils.act')
    );
    expect(appErrorCalls).toHaveLength(0);
  });
});

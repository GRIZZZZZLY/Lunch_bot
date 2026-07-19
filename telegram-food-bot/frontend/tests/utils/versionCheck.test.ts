import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkForUpdates,
  getAppVersion,
  handleStartupUpdate,
  hasVersionChanged,
} from '../../src/utils/versionCheck';

describe('versionCheck Mini App update helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('stores the current app version on first launch', () => {
    expect(hasVersionChanged()).toBe(false);
    expect(window.localStorage.getItem('app_version')).toBe(getAppVersion());
  });

  it('detects server update without console noise', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        headers: {
          get: (name: string) =>
            name === 'X-App-Version' ? '99.0.0' : null,
        },
      })
    );

    await expect(checkForUpdates()).resolves.toBe(true);

    expect(fetch).toHaveBeenCalledWith('/', {
      cache: 'no-cache',
      method: 'HEAD',
    });
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('handles startup version change and stores the new version without console noise', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    window.localStorage.setItem('app_version', '1.0.0');
    window.localStorage.setItem('temporary_key', 'old value');
    window.localStorage.setItem('auth_token', 'token');

    await handleStartupUpdate();

    expect(window.localStorage.getItem('app_version')).toBe(getAppVersion());
    expect(window.localStorage.getItem('temporary_key')).toBeNull();
    expect(window.localStorage.getItem('auth_token')).toBe('token');
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

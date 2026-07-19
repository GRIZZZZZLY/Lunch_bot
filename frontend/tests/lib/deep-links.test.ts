import { describe, expect, it } from 'vitest';
import { resolveMiniAppDeepLinkNavigation } from '../../src/utils/deepLinks';

describe('resolveMiniAppDeepLinkNavigation', () => {
  it('maps Telegram vote start_param to a Home poll query', () => {
    expect(
      resolveMiniAppDeepLinkNavigation({
        startParam: 'vote_42',
        pathname: '/',
        search: '',
      })
    ).toEqual({ to: '/?pollId=42', replace: true });
  });

  it('keeps an existing pollId query unchanged', () => {
    expect(
      resolveMiniAppDeepLinkNavigation({
        startParam: 'vote_42',
        pathname: '/',
        search: '?pollId=7',
      })
    ).toBeNull();
  });

  it('maps Telegram store run start_param to the store run page', () => {
    expect(
      resolveMiniAppDeepLinkNavigation({
        startParam: 'storerun_15',
        pathname: '/',
        search: '',
      })
    ).toEqual({ to: '/store-run/15', replace: true });
  });

  it('maps legacy storeRunId query to the store run page', () => {
    expect(
      resolveMiniAppDeepLinkNavigation({
        pathname: '/',
        search: '?storeRunId=18',
      })
    ).toEqual({ to: '/store-run/18', replace: true });
  });

  it('ignores malformed deep link identifiers', () => {
    expect(
      resolveMiniAppDeepLinkNavigation({
        startParam: 'storerun_../menu',
        pathname: '/',
        search: '',
      })
    ).toBeNull();

    expect(
      resolveMiniAppDeepLinkNavigation({
        startParam: 'vote_abc',
        pathname: '/',
        search: '',
      })
    ).toBeNull();
  });
});

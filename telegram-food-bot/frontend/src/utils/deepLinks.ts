export interface MiniAppDeepLinkInput {
  startParam?: string | null;
  pathname: string;
  search: string;
}

export interface MiniAppDeepLinkNavigation {
  to: string;
  replace: true;
}

const isNumericId = (value: string): boolean => /^\d+$/.test(value);

export function resolveMiniAppDeepLinkNavigation({
  startParam,
  pathname,
  search,
}: MiniAppDeepLinkInput): MiniAppDeepLinkNavigation | null {
  const searchParams = new URLSearchParams(search);
  const existingPollId = searchParams.get('pollId');
  const legacyStoreRunId = searchParams.get('storeRunId');

  if (startParam?.startsWith('vote_') && pathname === '/' && !existingPollId) {
    const pollId = startParam.slice('vote_'.length);
    if (isNumericId(pollId)) {
      return { to: `/?pollId=${pollId}`, replace: true };
    }
  }

  if (startParam?.startsWith('storerun_')) {
    const storeRunId = startParam.slice('storerun_'.length);
    const targetPath = `/store-run/${storeRunId}`;
    if (isNumericId(storeRunId) && pathname !== targetPath) {
      return { to: targetPath, replace: true };
    }
  }

  if (pathname === '/' && legacyStoreRunId && isNumericId(legacyStoreRunId)) {
    return { to: `/store-run/${legacyStoreRunId}`, replace: true };
  }

  return null;
}

import { useMemo } from 'react';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { Skeleton } from '@/shared/ui';
import { dateCaption, greetingFor } from '../lib/selectors';

/** Приветствие Главной — заголовок шапки вкладок, а не строка в ленте. */
export function useGreetingHeader(name: string | undefined, loading: boolean) {
  const skeleton = useMemo(() => <Skeleton variant="text" width={160} height={16} />, []);
  const now = new Date();
  const title = loading ? skeleton : `${greetingFor(now.getHours())}${name ? `, ${name}` : ''}`;
  useScreenHeader(title, undefined, dateCaption(now));
}

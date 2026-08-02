/* Заглушка страницы на время загрузки ленивого чанка.
   Живёт отдельным файлом, потому что нужна и App.tsx, и обоим layout'ам:
   импорт из App.tsx замкнул бы цикл (App → layout → App). */
import { Skeleton } from '@/shared/ui';

export function RouteFallback() {
  return (
    <div className="rl" style={{ padding: 'var(--space-4) var(--space-3)' }}>
      <Skeleton variant="text" width="45%" height={12} />
      <div style={{ height: 'var(--space-4)' }} />
      <Skeleton variant="block" height={120} />
      <div style={{ height: 'var(--space-3)' }} />
      <Skeleton variant="block" height={72} />
    </div>
  );
}

/* Store Run — маршрутный контейнер: detail-запрос, нормализованные
   loading/error-состояния, роль пользователя и исчерпывающий dispatch по
   серверному status. Header задаёт leaf-компонент (useScreenHeader). */
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoreRun } from '@/hooks/useStoreRun';
import { useStoreRunStream } from '@/hooks/useStoreRunStream';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { ErrorState, Skeleton, type ErrorKind } from '@/shared/ui';
import { CollectingView } from './views/CollectingView';
import { ShoppingView } from './views/ShoppingView';
import { SettledView } from './views/SettledView';
import { CancelledView } from './views/CancelledView';
import styles from './StoreRunPage.module.css';

interface NormalizedError {
  status?: number;
  code?: string;
}

function classifyError(err: unknown): { kind: ErrorKind; retryable: boolean } {
  const e = err as NormalizedError | null;
  if (e?.status === 403) return { kind: 'forbidden', retryable: false };
  if (e?.status === 404) return { kind: 'notFound', retryable: false };
  return { kind: 'network', retryable: true };
}

function StoreRunLoadingView() {
  useScreenHeader('Закупка');
  return (
    <div className={styles.skeletonStack}>
      <div className={styles.skeletonRow}>
        <Skeleton variant="circle" width={40} height={40} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton variant="text" width="55%" />
          <Skeleton variant="text" width="35%" height={10} />
        </div>
      </div>
      <Skeleton variant="block" height={8} />
      <Skeleton variant="block" height={64} />
      <Skeleton variant="block" height={64} />
    </div>
  );
}

function StoreRunErrorView({
  kind,
  onRetry,
}: {
  kind: ErrorKind;
  onRetry?: () => void;
}) {
  useScreenHeader('Закупка');
  const forbidden = kind === 'forbidden';
  return (
    <div className={styles.stateWrap}>
      <ErrorState
        kind={kind}
        title={forbidden ? 'Нет доступа' : undefined}
        description={forbidden ? 'Вы не состоите в этой группе.' : undefined}
        onRetry={onRetry}
      />
    </div>
  );
}

export function StoreRunPage() {
  const { id } = useParams<{ id: string }>();
  const runId = id ? Number(id) : null;
  const valid = runId !== null && Number.isFinite(runId) && runId > 0;

  const { user } = useAuth();
  /* Живой поток вместо опроса каждые 15 секунд. Опрос остаётся страховкой:
     пока поток не подтвердил соединение, запросы идут как раньше. */
  const streamStatus = useStoreRunStream(valid ? runId : null);
  const { data: run, isLoading, isError, error, refetch } = useStoreRun(
    valid ? runId : null,
    streamStatus === 'connected',
  );

  if (!valid) return <StoreRunErrorView kind="notFound" />;
  if (isLoading) return <StoreRunLoadingView />;
  if (isError) {
    const { kind, retryable } = classifyError(error);
    return <StoreRunErrorView kind={kind} onRetry={retryable ? () => refetch() : undefined} />;
  }
  if (!run) return <StoreRunErrorView kind="notFound" />;

  const currentUserId = user?.id ?? null;
  switch (run.status) {
    case 'COLLECTING':
      return <CollectingView run={run} currentUserId={currentUserId} />;
    case 'SHOPPING':
      return <ShoppingView run={run} currentUserId={currentUserId} />;
    case 'SETTLED':
      return <SettledView run={run} currentUserId={currentUserId} />;
    case 'CANCELLED':
      return <CancelledView run={run} currentUserId={currentUserId} />;
    default:
      // защита от неизвестного серверного статуса: безопасный экран вместо краша
      return (
        <StoreRunErrorView
          kind="network"
          onRetry={() => refetch()}
        />
      );
  }
}

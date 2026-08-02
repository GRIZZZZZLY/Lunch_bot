/* Store Run — маршрутный контейнер: detail-запрос, нормализованные
   loading/error-состояния, роль пользователя и исчерпывающий dispatch по
   серверному status. Header задаёт leaf-компонент (useScreenHeader). */
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoreRun } from '@/hooks/useStoreRun';
import { useStoreRunStream } from '@/hooks/useStoreRunStream';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { ErrorState, Skeleton, type ErrorKind } from '@/shared/ui';
import { useDelayedLoading } from '@/shared/lib/useDelayedLoading';
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

/* quiet — окно молчания: заголовок экрана уже нужен (без него шапка detail
   пустая), а скелет ещё нет, потому что ответ может успеть раньше. */
function StoreRunLoadingView({ quiet = false }: { quiet?: boolean }) {
  useScreenHeader('Закупка');
  if (quiet) return <div className={styles.skeletonStack} />;
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

/* Переход закупки в новое состояние — событие: экран открыт, коллега отметил
   покупку, и вид сменился сам. Это показываем движением (styles/motion.css).

   Первое состояние после загрузки событием НЕ является — это та же страница,
   дочитавшая данные. Анимировать его значит показать вторую «загрузку» подряд,
   ровно то, из-за чего каскад на корнях страниц и был снят. Поэтому класс
   достаётся только смене, а key перезапускает анимацию на каждой следующей. */
function StatusReveal({ status, children }: { status: string; children: ReactNode }) {
  // Состояние, а не ref: значение нужно во время рендера, и первое остаётся
  // первым — сеттер намеренно не берём.
  const [firstStatus] = useState(status);
  return (
    <div key={status} className={firstStatus === status ? undefined : 'anim-in'}>
      {children}
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
  const showSkeleton = useDelayedLoading(isLoading);

  if (!valid) return <StoreRunErrorView kind="notFound" />;
  if (isLoading) return <StoreRunLoadingView quiet={!showSkeleton} />;
  if (isError) {
    const { kind, retryable } = classifyError(error);
    return <StoreRunErrorView kind={kind} onRetry={retryable ? () => refetch() : undefined} />;
  }
  if (!run) return <StoreRunErrorView kind="notFound" />;

  const currentUserId = user?.id ?? null;
  const view = ((): ReactNode => {
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
        return <StoreRunErrorView kind="network" onRetry={() => refetch()} />;
    }
  })();

  return <StatusReveal status={run.status}>{view}</StatusReveal>;
}

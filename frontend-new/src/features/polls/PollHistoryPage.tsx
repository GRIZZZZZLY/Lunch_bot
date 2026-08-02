/* История голосований (Phase 6, система C): строки в группе, статус словом. */
import { useNavigate } from 'react-router-dom';
import { usePollHistory } from '@/hooks/useUser';
import type { PollStatus } from '@/types/models';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { EmptyState, Skeleton, Status, type StatusTone } from '@/shared/ui';
import { pluralize } from '@/shared/lib/pluralize';
import { useDelayedLoading } from '@/shared/lib/useDelayedLoading';
import styles from './PollHistoryPage.module.css';

const STATUS: Record<PollStatus, { tone: StatusTone; label: string }> = {
  ACTIVE: { tone: 'accent', label: 'Активно' },
  COMPLETED: { tone: 'success', label: 'Завершено' },
  CANCELLED: { tone: 'danger', label: 'Отменено' },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PollHistoryPage() {
  const navigate = useNavigate();
  const { data: polls = [], isLoading } = usePollHistory({ limit: 60 });
  useScreenHeader('История голосований');
  const loading = isLoading && polls.length === 0;
  const showSkeleton = useDelayedLoading(loading);

  /* Возврат по loading обязателен и в окне молчания: иначе управление уходит
     ниже, к «История пуста», и вместо мелькнувшего скелета человек видит
     мелькнувшую неправду. */
  if (loading) {
    return (
      <div className={`rl ${styles.screen}`}>
        {showSkeleton && (
          <div className={styles.group}>
            <div className={styles.skeletonWrap}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} variant="block" height={44} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <div className={`rl ${styles.screen}`}>
        <div className={styles.stateWrap}>
          <EmptyState
            icon="clock"
            title="История пуста"
            description="Завершённые голосования появятся здесь."
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`rl ${styles.screen}`}>
      <div className={styles.group}>
        {polls.map((p) => {
          const meta = STATUS[p.status] ?? STATUS.COMPLETED;
          const votes = p._count?.votes ?? 0;
          return (
            <button
              key={p.id}
              type="button"
              className={styles.row}
              onClick={() => navigate(`/poll/${p.id}/results`)}
            >
              <div className={styles.rowMain}>
                <span className={styles.rowName}>Опрос #{p.id}</span>
                <span className={`tnum ${styles.rowSub}`}>
                  {fmtDate(p.createdAt)} · {pluralize(votes, 'голос', 'голоса', 'голосов')}
                </span>
              </div>
              <Status tone={meta.tone}>{meta.label}</Status>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { usePollHistory } from '@/hooks/useUser';
import type { PollStatus } from '@/types/models';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { Badge, type BadgeTone } from '@/components/rl/primitives';
import { EmptyState, Skeleton } from '@/shared/ui';
import { Icon, type IconName } from '@/components/rl/Icon';

const STATUS: Record<PollStatus, { tone: BadgeTone; icon: IconName; label: string }> = {
  ACTIVE: { tone: 'accent', icon: 'flame', label: 'Активно' },
  COMPLETED: { tone: 'success', icon: 'check', label: 'Завершено' },
  CANCELLED: { tone: 'danger', icon: 'ban', label: 'Отменено' },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PollHistoryPage() {
  const navigate = useNavigate();
  const { data: polls = [], isLoading } = usePollHistory({ limit: 60 });
  useScreenHeader('История голосований');

  return (
    <div className="rl">
      <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLoading && polls.length === 0 && (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                <Skeleton variant="block" width={40} height={40} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Skeleton variant="text" width="55%" />
                  <Skeleton variant="text" width="35%" height={10} />
                </div>
              </div>
            ))}
          </>
        )}

        {!isLoading && polls.length === 0 && (
          <EmptyState
            icon="clock"
            title="История пуста"
            description="Завершённые голосования появятся здесь."
          />
        )}

        {polls.map((p) => {
          const meta = STATUS[p.status] ?? STATUS.COMPLETED;
          return (
            <button
              key={p.id}
              className="card press"
              onClick={() => navigate(`/poll/${p.id}/results`)}
              style={{ width: '100%', padding: 16, display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `var(--${meta.tone === 'accent' ? 'accent' : meta.tone}-tint)`,
                  color: `var(--${meta.tone === 'accent' ? 'accent' : meta.tone})`,
                }}
              >
                <Icon name={meta.icon} size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-head" style={{ fontSize: 'var(--t-15)', fontWeight: 600 }}>
                  Опрос #{p.id}
                </div>
                <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }} className="tnum">
                  {fmtDate(p.createdAt)} · {p._count?.votes ?? 0} голосов
                </div>
              </div>
              <Badge tone={meta.tone} icon={meta.icon}>
                {meta.label}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { usePollHistory } from '@/hooks/useUser';
import type { PollStatus } from '@/types/models';
import { BackHeader } from '@/components/rl/parts';
import { Badge, type BadgeTone } from '@/components/rl/primitives';
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

  return (
    <div className="rl">
      <BackHeader title="История голосований" onBack={() => navigate(-1)} />
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLoading && polls.length === 0 && (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 12, width: '55%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 10, width: '35%' }} />
                </div>
              </div>
            ))}
          </>
        )}

        {!isLoading && polls.length === 0 && (
          <div className="card" style={{ padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--bg-base)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6, border: '1px solid var(--border-subtle)' }}>
              <Icon name="clock" size={28} />
            </div>
            <div className="font-head" style={{ fontSize: 'var(--t-16)', fontWeight: 600 }}>
              История пуста
            </div>
            <p style={{ margin: 0, fontSize: 'var(--t-13)', color: 'var(--text-tertiary)', maxWidth: 240, lineHeight: 1.5 }}>
              Завершённые голосования появятся здесь.
            </p>
          </div>
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

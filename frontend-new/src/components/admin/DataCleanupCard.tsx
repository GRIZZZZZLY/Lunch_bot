import { useState, type ChangeEvent } from 'react';
import { useCleanupOldPolls, useCleanupOldTransactions, useCleanupStats } from '@/hooks/useAdmin';
import { Button, Field } from '@/components/rl/primitives';
import { ConfirmDialog } from '@/shared/ui';

type CleanupTarget = { kind: 'polls' | 'tx'; days: number };

export function DataCleanupCard() {
  const { data: stats, isLoading } = useCleanupStats();
  const cleanPolls = useCleanupOldPolls();
  const cleanTx = useCleanupOldTransactions();
  const [pollDays, setPollDays] = useState(30);
  const [txDays, setTxDays] = useState(90);
  const [msg, setMsg] = useState<string | null>(null);
  const [target, setTarget] = useState<CleanupTarget | null>(null);

  const runConfirmed = async () => {
    if (!target) return;
    if (target.kind === 'polls') {
      const res = await cleanPolls.mutateAsync(target.days);
      setMsg(`Удалено ${res.data?.deleted ?? 0} голосований`);
    } else {
      const res = await cleanTx.mutateAsync(target.days);
      setMsg(`Удалено ${res.data?.deleted ?? 0} транзакций`);
    }
    setTarget(null);
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="font-head" style={{ fontWeight: 700, fontSize: 'var(--t-16)', marginBottom: 12 }}>
        Очистка данных
      </div>

      {isLoading && <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--t-13)' }}>Загрузка…</div>}
      {stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Block title="Старые голосования" stats={stats.oldPolls} days={pollDays} onDays={setPollDays} onRun={() => setTarget({ kind: 'polls', days: pollDays })} running={cleanPolls.isPending} />
          <Block title="Старые транзакции" stats={stats.oldTransactions} days={txDays} onDays={setTxDays} onRun={() => setTarget({ kind: 'tx', days: txDays })} running={cleanTx.isPending} />
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 'var(--r-block)', background: 'var(--accent-tint)', color: 'var(--accent)', fontSize: 'var(--t-13)' }}>
          {msg}
        </div>
      )}

      {target && (
        <ConfirmDialog
          title={target.kind === 'polls' ? 'Удалить старые голосования?' : 'Удалить старые транзакции?'}
          description={`Будут удалены записи старше ${target.days} дней. Действие необратимо.`}
          confirmLabel="Удалить"
          destructive
          pending={cleanPolls.isPending || cleanTx.isPending}
          onConfirm={runConfirmed}
          onCancel={() => setTarget(null)}
        />
      )}
    </div>
  );
}

function Block({
  title,
  stats,
  days,
  onDays,
  onRun,
  running,
}: {
  title: string;
  stats: { count30Days: number; count60Days: number; count90Days: number };
  days: number;
  onDays: (n: number) => void;
  onRun: () => void;
  running: boolean;
}) {
  return (
    <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--r-block)', padding: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 'var(--t-15)', marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', gap: 12, fontSize: 'var(--t-11)', color: 'var(--text-tertiary)', marginBottom: 10 }} className="tnum">
        <span>30д: {stats.count30Days}</span>
        <span>60д: {stats.count60Days}</span>
        <span>90д: {stats.count90Days}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 90 }}>
          <Field
            aria-label={
              title === 'Старые голосования'
                ? 'Срок для старых голосований'
                : 'Срок для старых транзакций'
            }
            type="number"
            value={days}
            className="tnum"
            onChange={(e: ChangeEvent<HTMLInputElement>) => onDays(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <span style={{ fontSize: 'var(--t-13)', color: 'var(--text-secondary)' }}>дней</span>
        <Button size="sm" variant="danger" icon="trash" style={{ marginLeft: 'auto' }} loading={running} onClick={onRun}>
          Удалить
        </Button>
      </div>
    </div>
  );
}

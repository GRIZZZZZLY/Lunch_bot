import { useState, type ChangeEvent } from 'react';
import { useCleanupOldPolls, useCleanupOldTransactions, useCleanupStats } from '@/hooks/useAdmin';
import { Button, Field } from '@/components/rl/primitives';

export function DataCleanupCard() {
  const { data: stats, isLoading } = useCleanupStats();
  const cleanPolls = useCleanupOldPolls();
  const cleanTx = useCleanupOldTransactions();
  const [pollDays, setPollDays] = useState(30);
  const [txDays, setTxDays] = useState(90);
  const [msg, setMsg] = useState<string | null>(null);

  const runPolls = async () => {
    if (!confirm(`Удалить голосования старше ${pollDays} дней?`)) return;
    const res = await cleanPolls.mutateAsync(pollDays);
    setMsg(`Удалено ${res.data?.deleted ?? 0} голосований`);
  };

  const runTx = async () => {
    if (!confirm(`Удалить транзакции старше ${txDays} дней?`)) return;
    const res = await cleanTx.mutateAsync(txDays);
    setMsg(`Удалено ${res.data?.deleted ?? 0} транзакций`);
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="font-head" style={{ fontWeight: 700, fontSize: 'var(--t-16)', marginBottom: 12 }}>
        Очистка данных
      </div>

      {isLoading && <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--t-13)' }}>Загрузка…</div>}
      {stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Block title="Старые голосования" stats={stats.oldPolls} days={pollDays} onDays={setPollDays} onRun={runPolls} running={cleanPolls.isPending} />
          <Block title="Старые транзакции" stats={stats.oldTransactions} days={txDays} onDays={setTxDays} onRun={runTx} running={cleanTx.isPending} />
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 'var(--r-block)', background: 'var(--accent-tint)', color: 'var(--accent)', fontSize: 'var(--t-13)' }}>
          {msg}
        </div>
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

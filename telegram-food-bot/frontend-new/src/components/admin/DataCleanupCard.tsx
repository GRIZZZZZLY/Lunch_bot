import { useState } from 'react';
import { useCleanupOldPolls, useCleanupOldTransactions, useCleanupStats } from '@/hooks/useAdmin';

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
    <div style={cardStyle}>
      <div style={titleStyle}>Очистка данных</div>

      {isLoading && <div style={muted}>Загрузка…</div>}
      {stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Block
            title="Старые голосования"
            stats={stats.oldPolls}
            days={pollDays}
            onDays={setPollDays}
            onRun={runPolls}
            running={cleanPolls.isPending}
          />
          <Block
            title="Старые транзакции"
            stats={stats.oldTransactions}
            days={txDays}
            onDays={setTxDays}
            onRun={runTx}
            running={cleanTx.isPending}
          />
        </div>
      )}

      {msg && <div style={{ marginTop: 8, color: 'var(--ink-1, #333)', fontSize: 13 }}>{msg}</div>}
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
    <div style={{ background: 'var(--surf-2, #F7F7F9)', borderRadius: 10, padding: 10 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', gap: 8, fontSize: 12, ...muted, marginBottom: 8 }}>
        <span>30д: {stats.count30Days}</span>
        <span>60д: {stats.count60Days}</span>
        <span>90д: {stats.count90Days}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          value={days}
          min={1}
          onChange={(e) => onDays(Math.max(1, Number(e.target.value) || 1))}
          style={{
            width: 80,
            border: '1px solid var(--line-2, #eee)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 13,
          }}
        />
        <span style={{ fontSize: 13 }}>дней</span>
        <button
          onClick={onRun}
          disabled={running}
          style={{ ...btn, background: '#FCDADA', marginLeft: 'auto' }}
        >
          🗑 Удалить
        </button>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surf-1, #fff)',
  borderRadius: 16,
  padding: 14,
  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
};
const titleStyle: React.CSSProperties = { fontWeight: 700, fontSize: 15, marginBottom: 10 };
const btn: React.CSSProperties = {
  border: 'none',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
};
const muted: React.CSSProperties = { color: 'var(--ink-2, #888)' };

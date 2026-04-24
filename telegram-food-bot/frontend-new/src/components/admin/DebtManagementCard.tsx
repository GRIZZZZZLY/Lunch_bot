import {
  useAdminDebtors,
  useDebtStats,
  useForgiveDebt,
  useRemindAllDebtors,
  useRemindDebtor,
} from '@/hooks/useAdmin';
import type { DebtorInfo } from '@/services/admin.service';

export function DebtManagementCard() {
  const { data: debtors = [], isLoading } = useAdminDebtors();
  const { data: stats } = useDebtStats();
  const forgive = useForgiveDebt();
  const remindAll = useRemindAllDebtors();
  const remindOne = useRemindDebtor();

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>Долги</div>
        <button
          onClick={() => remindAll.mutate()}
          disabled={remindAll.isPending || debtors.length === 0}
          style={{ ...btn, background: '#FEE9B6' }}
        >
          📣 Напомнить всем
        </button>
      </div>

      {stats && (
        <div style={statsRow}>
          <Stat label="Должников" value={String(stats.totalDebtors)} />
          <Stat label="Сумма" value={`${stats.totalDebtAmount} ₽`} />
          <Stat label="Средн." value={`${Math.round(stats.avgDebtPerUser)} ₽`} />
          <Stat label="Старый" value={`${stats.oldestDebtAge}д`} />
        </div>
      )}

      {isLoading && <div style={muted}>Загрузка…</div>}
      {!isLoading && debtors.length === 0 && <div style={muted}>Долгов нет</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {debtors.map((d) => (
          <DebtorRow
            key={d.userId}
            debtor={d}
            onForgive={(debtId) => forgive.mutate(debtId)}
            onRemind={(debtId) => remindOne.mutate(debtId)}
          />
        ))}
      </div>
    </div>
  );
}

function DebtorRow({
  debtor,
  onForgive,
  onRemind,
}: {
  debtor: DebtorInfo;
  onForgive: (id: number) => void;
  onRemind: (id: number) => void;
}) {
  return (
    <div style={rowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{debtor.userName}</div>
        <div style={subStyle}>
          {debtor.debtCount} долгов · {debtor.totalDebt} ₽
        </div>
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {debtor.debts.map((d) => (
            <div
              key={d.id}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <span>{d.amount} ₽ → {d.toUser.firstName}</span>
              <button onClick={() => onRemind(d.id)} style={{ ...btn, background: '#EEE', padding: '2px 6px', fontSize: 11 }}>
                🔔
              </button>
              <button
                onClick={() => {
                  if (confirm(`Списать долг ${d.amount} ₽?`)) onForgive(d.id);
                }}
                style={{ ...btn, background: '#FCDADA', padding: '2px 6px', fontSize: 11 }}
              >
                ✗
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{value}</div>
      <div style={{ ...muted, fontSize: 11 }}>{label}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surf-1, #fff)',
  borderRadius: 16,
  padding: 14,
  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
};
const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
};
const titleStyle: React.CSSProperties = { fontWeight: 700, fontSize: 15 };
const statsRow: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  background: 'var(--surf-2, #F7F7F9)',
  borderRadius: 10,
  padding: 10,
};
const rowStyle: React.CSSProperties = {
  padding: '8px 10px',
  background: 'var(--surf-2, #F7F7F9)',
  borderRadius: 10,
};
const btn: React.CSSProperties = {
  border: 'none',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
};
const muted: React.CSSProperties = { color: 'var(--ink-2, #888)', fontSize: 12 };
const subStyle: React.CSSProperties = { color: 'var(--ink-2, #888)', fontSize: 12, marginTop: 2 };

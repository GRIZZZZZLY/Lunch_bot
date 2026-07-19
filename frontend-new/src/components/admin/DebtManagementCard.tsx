import { useState } from 'react';
import {
  useAdminDebtors,
  useDebtStats,
  useForgiveDebt,
  useRemindAllDebtors,
  useRemindDebtor,
} from '@/hooks/useAdmin';
import type { DebtorInfo } from '@/services/admin.service';
import { Button, IconButton } from '@/components/rl/primitives';
import { ConfirmDialog } from '@/shared/ui';

type ForgiveTarget = { id: number; amount: number };

export function DebtManagementCard() {
  const { data: debtors = [], isLoading } = useAdminDebtors();
  const { data: stats } = useDebtStats();
  const forgive = useForgiveDebt();
  const remindAll = useRemindAllDebtors();
  const remindOne = useRemindDebtor();
  const [forgiveTarget, setForgiveTarget] = useState<ForgiveTarget | null>(null);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div className="font-head" style={{ fontWeight: 700, fontSize: 'var(--t-16)' }}>
          Долги
        </div>
        <Button size="sm" variant="warning" icon="bell" loading={remindAll.isPending} disabled={debtors.length === 0} onClick={() => remindAll.mutate()}>
          Напомнить всем
        </Button>
      </div>

      {stats && (
        <div style={{ display: 'flex', gap: 8, padding: 12, borderRadius: 'var(--r-block)', background: 'var(--bg-base)', marginBottom: 12 }}>
          <Stat label="Должников" value={String(stats.totalDebtors)} />
          <Stat label="Сумма" value={`${stats.totalDebtAmount} ₽`} />
          <Stat label="Средн." value={`${Math.round(stats.avgDebtPerUser)} ₽`} />
          <Stat label="Старый" value={`${stats.oldestDebtAge}д`} />
        </div>
      )}

      {isLoading && <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--t-13)' }}>Загрузка…</div>}
      {!isLoading && debtors.length === 0 && <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--t-13)' }}>Долгов нет</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {debtors.map((d) => (
          <DebtorRow
            key={d.userId}
            debtor={d}
            onForgive={(id, amount) => setForgiveTarget({ id, amount })}
            onRemind={(id) => remindOne.mutate(id)}
          />
        ))}
      </div>

      {forgiveTarget && (
        <ConfirmDialog
          title="Списать долг?"
          description={`${forgiveTarget.amount} ₽ будут списаны без оплаты. Действие необратимо.`}
          confirmLabel="Списать"
          destructive
          pending={forgive.isPending}
          onConfirm={() =>
            forgive.mutate(forgiveTarget.id, { onSuccess: () => setForgiveTarget(null) })
          }
          onCancel={() => setForgiveTarget(null)}
        />
      )}
    </div>
  );
}

function DebtorRow({
  debtor,
  onForgive,
  onRemind,
}: {
  debtor: DebtorInfo;
  onForgive: (id: number, amount: number) => void;
  onRemind: (id: number) => void;
}) {
  return (
    <div style={{ padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 'var(--r-block)' }}>
      <div style={{ fontSize: 'var(--t-15)', fontWeight: 600 }}>{debtor.userName}</div>
      <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)', marginTop: 2 }} className="tnum">
        {debtor.debtCount} долгов · {debtor.totalDebt} ₽
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {debtor.debts.map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--t-13)' }}>
            <span style={{ flex: 1 }} className="tnum">
              {d.amount} ₽ → {d.toUser.firstName}
            </span>
            <IconButton size="sm" variant="ghost" name="bell" aria-label="Напомнить" onClick={() => onRemind(d.id)} />
            <IconButton
              size="sm"
              variant="ghost"
              name="x"
              aria-label="Списать"
              style={{ color: 'var(--danger)' }}
              onClick={() => onForgive(d.id, d.amount)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div className="font-head tnum" style={{ fontWeight: 700, fontSize: 'var(--t-15)' }}>{value}</div>
      <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)' }}>{label}</div>
    </div>
  );
}

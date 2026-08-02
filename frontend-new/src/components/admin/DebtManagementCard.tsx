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
import { ConfirmDialog, InlineNotice } from '@/shared/ui';
import { formatPrice } from '@/features/store-run/lib/selectors';
import { pluralize } from '@/shared/lib/pluralize';
import styles from './AdminCards.module.css';

type ForgiveTarget = { id: number; amount: number; who: string; toWhom: string };

export function DebtManagementCard() {
  const { data: debtors = [], isLoading, isError, refetch } = useAdminDebtors();
  const { data: stats } = useDebtStats();
  const forgive = useForgiveDebt();
  const remindAll = useRemindAllDebtors();
  const remindOne = useRemindDebtor();
  const [forgiveTarget, setForgiveTarget] = useState<ForgiveTarget | null>(null);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>Долги</h2>
        <Button
          size="sm"
          variant="warning"
          icon="bell"
          loading={remindAll.isPending}
          disabled={debtors.length === 0 || isError}
          onClick={() => remindAll.mutate()}
        >
          Напомнить всем
        </Button>
      </div>

      {/* Раньше отказ чтения выглядел как «Долгов нет» — на денежном экране
          это прямая ложь. */}
      {isError ? (
        <InlineNotice tone="critical">
          Не удалось загрузить долги.{' '}
          <button type="button" className={styles.retry} onClick={() => refetch()}>
            Повторить
          </button>
        </InlineNotice>
      ) : (
        <>
          {stats && (
            <div className={`${styles.block} ${styles.controls} ${styles.statsRow}`}>
              <Stat label="Должников" value={String(stats.totalDebtors)} />
              {/* formatPrice, а не «{n} ₽»: это было единственное место в
                  продукте, где деньги шли без разрядов. */}
              <Stat label="Сумма" value={formatPrice(stats.totalDebtAmount)} />
              <Stat label="Средн." value={formatPrice(Math.round(stats.avgDebtPerUser))} />
              <Stat label="Старый" value={`${stats.oldestDebtAge} д`} />
            </div>
          )}

          {isLoading && <p className={styles.muted}>Загрузка…</p>}
          {!isLoading && debtors.length === 0 && <p className={styles.muted}>Долгов нет</p>}

          <div className={styles.list}>
            {debtors.map((d) => (
              <DebtorRow
                key={d.userId}
                debtor={d}
                busyId={remindOne.isPending ? remindOne.variables : undefined}
                onForgive={setForgiveTarget}
                onRemind={(id) => remindOne.mutate(id)}
              />
            ))}
          </div>
        </>
      )}

      {forgiveTarget && (
        <ConfirmDialog
          title="Списать долг?"
          /* Кого и кому — раньше диалог называл только сумму, и в списке из
             восьми человек промах закрывал чужой долг навсегда.
             Стрелкой, а не «долг X перед Y»: русские имена в такой фразе
             требуют падежей, а склонять их кодом нельзя — получалось «долг
             Анна Тестова перед Игорь». Стрелка та же, что в строке списка. */
          description={`${forgiveTarget.who} → ${forgiveTarget.toWhom}, ${formatPrice(forgiveTarget.amount)}. Деньги никто не получит, вернуть запись нельзя.`}
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
  busyId,
  onForgive,
  onRemind,
}: {
  debtor: DebtorInfo;
  busyId?: number;
  onForgive: (t: ForgiveTarget) => void;
  onRemind: (id: number) => void;
}) {
  return (
    <div className={styles.block}>
      <div className={styles.blockTitle}>{debtor.userName}</div>
      <div className={`tnum ${styles.rowSub}`}>
        {pluralize(debtor.debtCount, 'долг', 'долга', 'долгов')} · {formatPrice(debtor.totalDebt)}
      </div>
      <div className={`${styles.list} ${styles.notice}`}>
        {debtor.debts.map((d) => (
          <div key={d.id} className={styles.controls}>
            <span className={`tnum ${styles.rowMain}`}>
              {formatPrice(d.amount)} → {d.toUser.firstName}
            </span>
            {/* Подписи были одинаковыми у всех строк: диктор десять раз
                подряд говорил «Списать», не называя, чей это долг. */}
            <IconButton
              size="sm"
              variant="ghost"
              name="bell"
              loading={busyId === d.id}
              aria-label={`Напомнить об этом долге: ${debtor.userName} → ${d.toUser.firstName}, ${formatPrice(d.amount)}`}
              onClick={() => onRemind(d.id)}
            />
            <IconButton
              size="sm"
              variant="ghost"
              name="x"
              className={styles.forgive}
              aria-label={`Списать этот долг: ${debtor.userName} → ${d.toUser.firstName}, ${formatPrice(d.amount)}`}
              onClick={() =>
                onForgive({
                  id: d.id,
                  amount: d.amount,
                  who: debtor.userName,
                  toWhom: d.toUser.firstName,
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.rowMain} style={{ textAlign: 'center' }}>
      <div className={`tnum ${styles.blockTitle}`}>{value}</div>
      <div className={styles.rowSub}>{label}</div>
    </div>
  );
}

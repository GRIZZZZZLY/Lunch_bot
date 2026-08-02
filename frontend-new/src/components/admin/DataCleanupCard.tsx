import { useState, type ChangeEvent } from 'react';
import {
  useCleanupOldPolls,
  useCleanupOldTransactions,
  useCleanupPreview,
  useCleanupStats,
} from '@/hooks/useAdmin';
import { Button, Field } from '@/components/rl/primitives';
import { ConfirmDialog, InlineNotice } from '@/shared/ui';
import { pluralForm, pluralize } from '@/shared/lib/pluralize';
import styles from './AdminCards.module.css';

type CleanupTarget = { kind: 'polls' | 'tx'; days: number };

export function DataCleanupCard() {
  const { data: stats, isLoading, isError, refetch } = useCleanupStats();
  const cleanPolls = useCleanupOldPolls();
  const cleanTx = useCleanupOldTransactions();
  const [pollDays, setPollDays] = useState(30);
  const [txDays, setTxDays] = useState(90);
  const [msg, setMsg] = useState<{ tone: 'info' | 'critical'; text: string } | null>(null);
  const [target, setTarget] = useState<CleanupTarget | null>(null);

  /* Сколько именно уйдёт за выбранный срок. Статистика ниже показывает срезы
     30/60/90, а поле принимает любое число: админ подтверждал необратимое
     удаление за 45 дней, не зная объёма. */
  const preview = useCleanupPreview(
    target ? (target.kind === 'polls' ? 'polls' : 'transactions') : null,
    target?.days ?? 30,
  );

  /* Раньше здесь не было try/catch: при отказе сервера setMsg и setTarget не
     выполнялись, диалог оставался открытым, сообщения не было нигде, а в
     консоли висело необработанное отклонение. Админ жал «Удалить» ещё раз. */
  const runConfirmed = async () => {
    if (!target) return;
    try {
      const res =
        target.kind === 'polls'
          ? await cleanPolls.mutateAsync(target.days)
          : await cleanTx.mutateAsync(target.days);
      const deleted = res.data?.deleted ?? 0;
      const skipped = res.data?.skipped ?? 0;
      const what = target.kind === 'polls' ? ['голосование', 'голосования', 'голосований'] : ['транзакцию', 'транзакции', 'транзакций'];
      setMsg({
        tone: 'info',
        text:
          `Удалено ${pluralize(deleted, what[0], what[1], what[2])}` +
          (skipped
            ? `. Пропущено ${skipped}: за ними ещё висят непогашенные долги.`
            : '.'),
      });
      setTarget(null);
    } catch {
      setMsg({ tone: 'critical', text: 'Не удалось выполнить очистку. Проверьте связь и попробуйте ещё раз.' });
      setTarget(null);
    }
  };

  const targetLabel = target?.kind === 'polls' ? 'голосования' : 'транзакции';

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Очистка данных</h2>

      {isLoading && <p className={styles.muted}>Загрузка…</p>}

      {/* Отказ чтения раньше давал пустую карточку: ни цифр, ни объяснения. */}
      {isError && (
        <InlineNotice tone="critical">
          Не удалось прочитать, сколько накопилось данных.{' '}
          <button type="button" className={styles.retry} onClick={() => refetch()}>
            Повторить
          </button>
        </InlineNotice>
      )}

      {stats && (
        <div className={styles.list}>
          <Block
            title="Старые голосования"
            stats={stats.oldPolls}
            days={pollDays}
            onDays={setPollDays}
            onRun={() => setTarget({ kind: 'polls', days: pollDays })}
            running={cleanPolls.isPending}
            disabled={cleanTx.isPending}
          />
          <Block
            title="Старые транзакции"
            stats={stats.oldTransactions}
            days={txDays}
            onDays={setTxDays}
            onRun={() => setTarget({ kind: 'tx', days: txDays })}
            running={cleanTx.isPending}
            disabled={cleanPolls.isPending}
          />
        </div>
      )}

      {msg && (
        <div className={styles.notice}>
          <InlineNotice tone={msg.tone}>{msg.text}</InlineNotice>
        </div>
      )}

      {target && (
        <ConfirmDialog
          title={target.kind === 'polls' ? 'Удалить старые голосования?' : 'Удалить старые транзакции?'}
          /* Число называем вслух. Раньше диалог говорил только «старше N дней»,
             хотя количество было известно и напечатано строкой выше. */
          description={
            preview.isLoading
              ? `Считаю, сколько записей старше ${target.days} дней попадёт под удаление…`
              : preview.data
                ? `Будет удалено: ${preview.data.deletable}. ` +
                  (preview.data.blockedByDebt
                    ? `Ещё ${preview.data.blockedByDebt} ${pluralForm(preview.data.blockedByDebt, 'останется', 'останутся', 'останутся')} — за ними непогашенные долги. `
                    : '') +
                  'Действие необратимо.'
                : `Будут удалены ${targetLabel} старше ${target.days} дней. Действие необратимо.`
          }
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
  disabled,
}: {
  title: string;
  stats: { count30Days: number; count60Days: number; count90Days: number };
  days: number;
  onDays: (n: number) => void;
  onRun: () => void;
  running: boolean;
  disabled: boolean;
}) {
  return (
    <div className={styles.block}>
      <div className={styles.blockTitle}>{title}</div>
      <div className={`tnum ${styles.counts}`}>
        <span>30д: {stats.count30Days}</span>
        <span>60д: {stats.count60Days}</span>
        <span>90д: {stats.count90Days}</span>
      </div>
      <div className={styles.controls}>
        <div className={styles.daysField}>
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
        <span className={styles.daysUnit}>дней</span>
        {/* Вторая кнопка блокируется, пока идёт первая: обе бьют по одной базе. */}
        <Button
          size="sm"
          variant="danger"
          icon="trash"
          className={styles.pushRight}
          loading={running}
          disabled={disabled}
          onClick={onRun}
        >
          Удалить
        </Button>
      </div>
    </div>
  );
}

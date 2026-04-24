import { useEffect, useState } from 'react';
import type { BudgetCallbacks, BudgetData, Debtor } from '../types';

function formatRub(n: number): string {
  return n.toLocaleString('ru-RU');
}

function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div className="bw-prg">
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

function DebtorRow({
  d,
  onRemind,
}: {
  d: Debtor;
  onRemind?: (id: string) => void;
}) {
  const pillLabel =
    d.status === 'ok' ? 'Оплачено' : d.status === 'late' ? 'Просрочено' : 'Ожидаем';
  const amtSuffix =
    d.status === 'late' && d.overdueMinutes
      ? ` · просрочено ${d.overdueMinutes} мин`
      : d.markedAgoText
      ? ` · ${d.markedAgoText}`
      : '';
  return (
    <div className="bw-debt">
      <div className="pav">{d.initial}</div>
      <div className="tx">
        <div className="name">{d.name}</div>
        <div className="amt">
          {formatRub(d.amount)} ₽{amtSuffix}
        </div>
      </div>
      <span className={`pill ${d.status}`}>{pillLabel}</span>
      {d.status !== 'ok' && onRemind && (
        <button type="button" className="remind" onClick={() => onRemind(d.id)}>
          Напомнить
        </button>
      )}
    </div>
  );
}

/* P1a — awaiting calculation */
export function CompactResponsibleBanner({ cbs }: { cbs: BudgetCallbacks }) {
  return (
    <div className="bw peach compact" style={{ minHeight: 88 }}>
      <div className="role-row">
        <span className="dot" />
        ответственный сегодня
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
        <div style={{ fontSize: 26, lineHeight: 1 }}>👑</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title" style={{ fontSize: 15, margin: 0 }}>
            Вы ответственный
          </div>
          <div className="sub" style={{ fontSize: 12 }}>
            Рассчитайте расходы после получения заказа
          </div>
        </div>
        <button
          type="button"
          className="bw-btn solid"
          style={{ flex: '0 0 auto', padding: '9px 14px' }}
          onClick={cbs.onOpenCalculator}
        >
          Рассчитать
        </button>
      </div>
    </div>
  );
}

/* P1b — awaiting payments */
export function ResponsibleView({
  data,
  cbs,
}: {
  data: BudgetData;
  cbs: BudgetCallbacks;
}) {
  const debtors = data.debtors ?? [];
  const received = data.totalReceived ?? 0;
  const expected = data.totalExpected ?? 0;
  const paid = data.paidCount ?? 0;
  const total = data.participantCount ?? debtors.length;

  return (
    <div className="bw peach">
      <div className="crown-wm" aria-hidden>
        👑
      </div>
      <div className="role-row">
        <span className="dot" />
        ответственный сегодня
      </div>
      <div className="title">Вы ответственный сегодня 👑</div>
      <div className="money-hero">
        <span className="val">{formatRub(received)}</span>
        <span className="unit">₽</span>
        <span className="lbl">из {formatRub(expected)} ₽</span>
      </div>
      <ProgressBar paid={received} total={expected} />
      <div className="bw-meta">
        <span>
          {paid} / {total} оплатили
        </span>
      </div>

      <div className="bw-debtors">
        {debtors.map((d) => (
          <DebtorRow key={d.id} d={d} onRemind={cbs.onRemindDebtor} />
        ))}
      </div>

      <div className="bw-ctas">
        <button type="button" className="bw-btn solid" onClick={cbs.onShareSbp}>
          Поделиться реквизитами СБП
        </button>
      </div>
    </div>
  );
}

/* P1c — everyone paid (mint) */
export function SuccessResponsibleView({
  data,
  cbs,
}: {
  data: BudgetData;
  cbs: BudgetCallbacks;
}) {
  const [countdown, setCountdown] = useState(5);
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          cbs.onCollapseSuccess?.();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cbs]);

  const received = data.totalReceived ?? 0;
  const count = data.participantCount ?? 0;
  return (
    <div className="bw mint">
      <Confetti />
      <div className="success-center">
        <div className="bw-check">✓</div>
        <div className="title">Все оплатили! 🎉</div>
        <div className="sub">
          {formatRub(received)} ₽ получено от {count} участников
        </div>
      </div>
      <div className="bw-collapse-hint">
        <span>свернётся через {countdown}s</span>
        <div className="bw-collapse-bar">
          <div style={{ animation: 'bwCollapse 5s linear both' }} />
        </div>
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ['#fca5a5', '#fde68a', '#a7f3d0', '#c4b5fd', '#fdba74', '#bae6fd'];

export function Confetti({ count = 12 }: { count?: number }) {
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const left = `${Math.round((i / count) * 100 + (i % 3) * 3)}%`;
        const bg = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const delay = `${(i % 5) * 0.12}s`;
        return <i key={i} style={{ left, background: bg, animationDelay: delay }} />;
      })}
    </div>
  );
}

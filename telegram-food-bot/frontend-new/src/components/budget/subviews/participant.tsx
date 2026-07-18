import { useEffect, useState } from 'react';
import type { BudgetCallbacks, BudgetData } from '../types';
import { Confetti } from './responsible';

function formatRub(n: number): string {
  return n.toLocaleString('ru-RU');
}

function SBPIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h3v3h-3zm4 4h3v3h-3zm0-4h-1v1h1z"
        stroke="currentColor"
        strokeWidth={1.8}
      />
    </svg>
  );
}

/* P3a — urgent debt (<5 min window) */
export function UrgentDebtView({
  data,
  cbs,
}: {
  data: BudgetData;
  cbs: BudgetCallbacks;
}) {
  const debt = data.myDebt;
  const deadlineMin = 5;
  // Хуки — до раннего return, иначе смена debt null↔значение ломает порядок хуков.
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, deadlineMin * 60 - Math.floor((debt?.ageMinutes ?? 0) * 60)),
  );
  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  if (!debt) return null;

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const pct = Math.max(0, (secondsLeft / (deadlineMin * 60)) * 100);

  return (
    <div className="bw coral">
      <div className="avatar-wm" aria-hidden>
        {debt.creditor.initial}
      </div>
      <div className="bw-urgent-row">
        <span className="bw-urgent-pill">🔥 Срочно</span>
      </div>
      <div className="money-hero">
        <span className="val">{formatRub(debt.amount)}</span>
        <span className="unit">₽</span>
      </div>
      <div className="sub">
        Вы должны <b>{debt.creditor.name}</b> за обед
      </div>
      <div className="bw-countdown">
        ⏱ Оплатите в течение{' '}
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {mm}:{ss}
        </span>
      </div>
      <div className="bw-prg coral">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="bw-ctas">
        <button type="button" className="bw-btn white" onClick={cbs.onPaySbp}>
          <SBPIcon /> Оплатить через СБП
        </button>
      </div>
      <div className="bw-ctas">
        <button type="button" className="bw-btn ghost" onClick={cbs.onMarkPaid}>
          Отметить как оплачено
        </button>
      </div>
    </div>
  );
}

/* P3b — marked paid, awaiting confirm */
export function WaitingConfirmationView({
  data,
  cbs,
}: {
  data: BudgetData;
  cbs: BudgetCallbacks;
}) {
  const debt = data.myDebt;
  if (!debt) return null;
  return (
    <div className="bw butter">
      <div className="bw-media-row">
        <div className="bw-slow-clock" aria-hidden>
          ⏰
        </div>
        <div className="tx">
          <div className="role-row">
            <span className="dot" />
            участник · ожидание
          </div>
          <div className="title">Ожидаем подтверждения</div>
          <div className="sub">
            Вы отметили оплату <b>{formatRub(debt.amount)} ₽</b>{' '}
            {debt.creditor.name}. Ждём подтверждения.
          </div>
        </div>
      </div>
      <div className="bw-meta">
        <span>отмечено</span>
        <span>{debt.markedAgoText ?? 'только что'}</span>
      </div>
      <div className="bw-ctas">
        <button type="button" className="bw-btn ghost" onClick={cbs.onCancelMark}>
          Отменить отметку
        </button>
      </div>
    </div>
  );
}

/* P3c — confirmed (expanded) */
export function SuccessMessageView({
  data,
  cbs,
}: {
  data: BudgetData;
  cbs: BudgetCallbacks;
}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => {
      setCollapsed(true);
      cbs.onCollapseSuccess?.();
    }, 5000);
    return () => clearTimeout(id);
  }, [cbs]);

  const debt = data.myDebt;
  if (!debt) return null;

  if (collapsed) {
    return (
      <div className="bw-mint-pill">
        <span className="tiny-pip" /> Оплата подтверждена · {formatRub(debt.amount)} ₽{' '}
        {debt.creditor.name}
      </div>
    );
  }

  return (
    <div className="bw mint">
      <Confetti />
      <div className="success-center">
        <div className="bw-check">✓</div>
        <div className="title">Оплата подтверждена! 🎉</div>
        <div className="sub">
          {debt.creditor.name} получил{debt.creditor.name.endsWith('а') ? 'а' : ''}{' '}
          {formatRub(debt.amount)} ₽
        </div>
      </div>
    </div>
  );
}

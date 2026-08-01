/* «Обеденный талон» — активное голосование (система C).
   Таймер живой (useCountdown, B3 закрыт). Строка блюда сама и есть голос:
   одно касание отправляет его, повторное по другой строке — меняет.
   Отзыв голоса — вторичное действие на корешке; админ-блок — secondary
   плюс ghost, оба под ConfirmDialog. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCountdown } from '@/shared/lib/useCountdown';
import { spokenDuration } from '@/shared/lib/spokenTime';
import { ConfirmDialog, Status } from '@/shared/ui';
import { Button } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';
import { pluralVotes } from '../lib/selectors';
import type { PollOptionVM } from '../lib/types';
import styles from '../HomePage.module.css';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function spokenRemaining(h: number, m: number, s: number, expired: boolean): string {
  if (expired) return 'Голосование завершается';
  return `До конца голосования ${spokenDuration(h, m, s)}`;
}

/**
 * Проценты по наибольшему остатку: независимое округление трёх равных долей
 * давало 33 + 33 + 33 = 99 %.
 */
function sharesOf(options: PollOptionVM[], total: number): Map<number, number> {
  const out = new Map<number, number>();
  if (total <= 0) {
    options.forEach((o) => out.set(o.id, 0));
    return out;
  }
  const exact = options.map((o) => ({ id: o.id, value: (o.votes / total) * 100 }));
  const floors = exact.map((e) => ({ id: e.id, floor: Math.floor(e.value), rest: e.value - Math.floor(e.value) }));
  let remainder = 100 - floors.reduce((s, f) => s + f.floor, 0);
  const order = [...floors].sort((a, b) => b.rest - a.rest);
  const bonus = new Set<number>();
  for (const f of order) {
    if (remainder <= 0) break;
    bonus.add(f.id);
    remainder -= 1;
  }
  floors.forEach((f) => out.set(f.id, f.floor + (bonus.has(f.id) ? 1 : 0)));
  return out;
}

export function LunchTicket({
  title,
  options,
  totalVotes,
  endsAt,
  onExpire,
  myChoiceId,
  voting,
  onVote,
  onWithdraw,
  isAdmin,
  onCloseEarly,
  onCancel,
  mutating,
}: {
  title: string;
  options: PollOptionVM[];
  totalVotes: number;
  endsAt: string;
  onExpire?: () => void;
  myChoiceId: number | null;
  voting: boolean;
  onVote: (menuItemId: number) => void;
  onWithdraw: () => void;
  isAdmin: boolean;
  onCloseEarly: () => void;
  onCancel: () => void;
  mutating: boolean;
}) {
  const cd = useCountdown(endsAt);
  const expireFired = useRef(false);
  useEffect(() => {
    if (cd.isExpired && !expireFired.current) {
      expireFired.current = true;
      onExpire?.();
    }
  }, [cd.isExpired, onExpire]);

  const [confirm, setConfirm] = useState<'close' | 'cancel' | null>(null);

  /* Штамп играет на смене голоса, а не на монтировании: иначе открытие
     приложения с уже отданным голосом каждый раз изображало бы новое действие.
     WAAPI, а не CSS-класс: повторный голос должен переигрывать анимацию, а это
     в CSS требует снять класс и дёрнуть reflow. Media query WAAPI не читает —
     проверяем reduced-motion сами. */
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const prevChoice = useRef(myChoiceId);
  useEffect(() => {
    const changed = prevChoice.current !== myChoiceId;
    prevChoice.current = myChoiceId;
    if (!changed || myChoiceId == null) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const dot = dotRefs.current[options.findIndex((o) => o.id === myChoiceId)];
    dot?.animate?.(
      [
        { transform: 'scale(1.35)', opacity: 0.55 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
  }, [myChoiceId, options]);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusIdx, setFocusIdx] = useState(0);

  const leadId = useMemo(
    () => [...options].sort((a, b) => b.votes - a.votes)[0]?.id ?? null,
    [options],
  );
  const shares = useMemo(() => sharesOf(options, totalVotes), [options, totalVotes]);
  const timeLabel =
    cd.hours > 0 ? `${cd.hours}:${pad(cd.minutes)}:${pad(cd.seconds)}` : `${pad(cd.minutes)}:${pad(cd.seconds)}`;

  const hasVoted = myChoiceId !== null;
  const myChoiceIdx = options.findIndex((o) => o.id === myChoiceId);
  const activeIdx = myChoiceIdx >= 0 ? myChoiceIdx : focusIdx;
  const leadName = options.find((o) => o.id === leadId)?.name ?? null;

  /* Стрелки двигают фокус, но не голосуют: в этой radiogroup выбор — сетевая
     мутация, и «выбор следует за фокусом» разослал бы группе лишние голоса.
     Подтверждение — Space или Enter, то есть штатный клик по кнопке. */
  const onKeyDown = (e: ReactKeyboardEvent, idx: number) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (idx + step + options.length) % options.length;
    setFocusIdx(next);
    optionRefs.current[next]?.focus();
  };

  return (
    <section className={styles.group} aria-labelledby="ticket-heading">
      <div className={styles.groupHead}>
        <h2 id="ticket-heading" className={styles.kicker}>
          Обеденный талон
        </h2>
        <Status tone="vote" icon="clock">
          {cd.isExpired ? 'Завершается…' : 'Идёт'}
        </Status>
      </div>

      <div className={styles.timerLine}>
        <span
          className={`tnum ${styles.timer}${cd.totalSeconds <= 60 && !cd.isExpired ? ` ${styles.low}` : ''}`}
          role="timer"
          aria-label={spokenRemaining(cd.hours, cd.minutes, cd.seconds, cd.isExpired)}
        >
          <span aria-hidden="true">{timeLabel}</span>
        </span>
        <span className={`tnum ${styles.timerCap}`}>{pluralVotes(totalVotes)}</span>
      </div>

      {/* Опрос без вариантов возможен, если блюда удалили из меню после
          запуска: пустая radiogroup выглядела бы поломкой вёрстки. */}
      {options.length === 0 ? (
        <p className={styles.emptyOptions}>
          Блюда этого голосования больше нет в меню — голосовать не за что.
        </p>
      ) : (
      <div className={styles.options} role="radiogroup" aria-label={title}>
        {options.map((o, idx) => {
          const share = shares.get(o.id) ?? 0;
          const isLead = o.id === leadId && o.votes > 0;
          const isMine = o.id === myChoiceId;
          return (
            <button
              key={o.id}
              ref={(el) => {
                optionRefs.current[idx] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isMine}
              tabIndex={idx === activeIdx ? 0 : -1}
              disabled={voting}
              className={`${styles.option}${isLead ? ` ${styles.lead}` : ''}${isMine ? ` ${styles.voted}` : ''}`}
              onKeyDown={(e) => onKeyDown(e, idx)}
              onFocus={() => setFocusIdx(idx)}
              onClick={() => {
                if (!isMine) onVote(o.id);
              }}
            >
              <span
                ref={(el) => {
                  dotRefs.current[idx] = el;
                }}
                className={styles.voteDot}
                aria-hidden="true"
              >
                {isMine && <Icon name="check" size={16} stroke={2.4} />}
              </span>
              <span className={styles.optionMain}>
                <span className={styles.optionName}>{o.name}</span>
                <span className={styles.optionSub}>
                  {isMine && <span className={styles.mine}>ваш голос · </span>}
                  <span className="tnum">{pluralVotes(o.votes)}</span>
                </span>
                <span className={styles.bar}>
                  <span className={styles.barFill} style={{ transform: `translateX(${share - 100}%)` }} />
                </span>
              </span>
              <span className={`tnum ${styles.pct}`} aria-hidden="true">
                {share}%
              </span>
            </button>
          );
        })}
      </div>
      )}

      {/* SSE двигает бары молча — расклад проговариваем отдельно. */}
      <p className="sr-only" aria-live="polite">
        {totalVotes > 0 && leadName
          ? `Лидирует ${leadName}, ${shares.get(leadId as number) ?? 0} %. Всего ${pluralVotes(totalVotes)}.`
          : 'Голосов пока нет'}
      </p>

      <div className={styles.perf}>
        <span className={styles.notch} />
      </div>

      <div className={styles.stub}>
        {hasVoted ? (
          <button type="button" className={styles.ghostAction} onClick={onWithdraw} disabled={voting}>
            Отозвать голос
          </button>
        ) : (
          <span className={styles.stubNote}>Голос можно менять, пока идёт таймер</span>
        )}
      </div>

      {isAdmin && (
        <div className={styles.adminRow}>
          <Button variant="secondary" disabled={mutating} onClick={() => setConfirm('close')}>
            Завершить сейчас
          </Button>
          <button
            type="button"
            className={styles.ghostAction}
            disabled={mutating}
            onClick={() => setConfirm('cancel')}
          >
            Отменить
          </button>
        </div>
      )}

      {confirm === 'close' && (
        <ConfirmDialog
          title="Завершить голосование?"
          description="Победитель определится по текущим голосам, участники получат уведомление."
          confirmLabel="Завершить"
          pending={mutating}
          onConfirm={() => {
            setConfirm(null);
            onCloseEarly();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'cancel' && (
        <ConfirmDialog
          title="Отменить голосование?"
          description="Голоса участников будут удалены, восстановить нельзя."
          confirmLabel="Отменить голосование"
          cancelLabel="Оставить"
          destructive
          pending={mutating}
          onConfirm={() => {
            setConfirm(null);
            onCancel();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </section>
  );
}

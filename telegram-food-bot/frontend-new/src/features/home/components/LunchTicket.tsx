/* «Обеденный талон» — активное голосование (система C).
   Таймер живой (useCountdown, B3 закрыт); тап по строке = выбор блюда;
   одна primary CTA; отзыв голоса — вторичное действие; админ-блок —
   secondary-кнопки с подтверждением на стороне страницы. */
import { useEffect, useMemo, useRef } from 'react';
import { useCountdown } from '@/shared/lib/useCountdown';
import { Button, Status } from '@/shared/ui';
import { Icon } from '@/components/rl/Icon';
import { pluralVotes } from '../lib/selectors';
import type { PollOptionVM } from '../lib/types';
import styles from '../HomePage.module.css';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function LunchTicket({
  title,
  options,
  totalVotes,
  endsAt,
  onExpire,
  selectedId,
  myChoiceId,
  hasVoted,
  voting,
  onSelect,
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
  selectedId: number | null;
  myChoiceId: number | null;
  hasVoted: boolean;
  voting: boolean;
  onSelect: (id: number) => void;
  onVote: () => void;
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

  const leadId = useMemo(
    () => [...options].sort((a, b) => b.votes - a.votes)[0]?.id ?? null,
    [options],
  );
  const timeLabel =
    cd.hours > 0 ? `${cd.hours}:${pad(cd.minutes)}:${pad(cd.seconds)}` : `${pad(cd.minutes)}:${pad(cd.seconds)}`;

  const activeChoice = selectedId ?? myChoiceId;
  const canSubmit = selectedId != null && selectedId !== myChoiceId && !voting;

  return (
    <section className={styles.group} aria-label={title}>
      <div className={styles.groupHead}>
        <span className={styles.kicker}>Обеденный талон</span>
        <Status tone="warning" icon="clock">
          {cd.isExpired ? 'Завершается…' : 'Идёт'}
        </Status>
      </div>

      <div className={styles.timerLine}>
        <span className={`tnum ${styles.timer}${cd.totalSeconds <= 60 && !cd.isExpired ? ` ${styles.low}` : ''}`}>
          {timeLabel}
        </span>
        <span className={`tnum ${styles.timerCap}`}>{pluralVotes(totalVotes)}</span>
      </div>

      <div className={styles.options} role="radiogroup" aria-label="Варианты обеда">
        {options.map((o) => {
          const share = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
          const isLead = o.id === leadId && o.votes > 0;
          const isMine = o.id === myChoiceId;
          const isPicked = o.id === activeChoice;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={isPicked}
              className={`${styles.option}${isLead ? ` ${styles.lead}` : ''}`}
              onClick={() => onSelect(o.id)}
            >
              <div className={styles.optionMain}>
                <div className={styles.optionName}>
                  {(isMine || isPicked) && (
                    <span className={styles.check}>
                      <Icon name="check" size={15} stroke={2.4} />
                    </span>
                  )}
                  {o.name}
                </div>
                <div className={styles.optionSub}>
                  {isMine && <span className="mine">ваш голос · </span>}
                  <span className="tnum">{pluralVotes(o.votes)}</span>
                </div>
                <div className={styles.bar}>
                  <span className={styles.barFill} style={{ width: `${share}%` }} />
                </div>
              </div>
              <span className={`tnum ${styles.pct}`}>{share}%</span>
            </button>
          );
        })}
      </div>

      <div className={styles.perf}>
        <span className={styles.notch} />
      </div>

      <div className={styles.ctaWrap}>
        <Button block loading={voting} disabled={!canSubmit} onClick={onVote}>
          {hasVoted ? 'Переголосовать' : 'Голосовать'}
        </Button>
        {hasVoted && (
          <button type="button" className={styles.ghostAction} onClick={onWithdraw} disabled={voting}>
            Отозвать голос
          </button>
        )}
      </div>
      <div className={styles.ctaNote}>тап по блюду выбирает · голос можно менять, пока идёт таймер</div>

      {isAdmin && (
        <div className={styles.adminRow}>
          <Button variant="secondary" disabled={mutating} onClick={onCloseEarly}>
            Завершить сейчас
          </Button>
          <Button variant="ghost" disabled={mutating} onClick={onCancel}>
            Отменить
          </Button>
        </div>
      )}
    </section>
  );
}

/* ROCKET LUNCH — roulette reveal (redesign v2).
   Cycles through `names`, decelerates and lands on `winnerName`.

   Оверлей ведёт себя как лист (BottomSheet): портал у body, фон под inert,
   Telegram «Назад» и Escape закрывают сначала его, фокус возвращается туда,
   откуда открыли. Раньше «Назад» уводил со страницы итогов вместе с рулеткой,
   а «Принято» снимал её одним кадром. Уход — зеркало входа: карточка гаснет
   в центре, затемнение — следом (redesign-v2.css). */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pushOverlay } from '@/lib/backButton';
import { deactivateBackground } from './BottomSheet';
import { Avatar, Button, Confetti } from './primitives';
import { Icon } from './Icon';

/* Карточка уходит за --motion-fast (150 мс), затемнение — за 200: снимаем по
   более долгому. */
const EXIT_MS = 200;

export function RouletteRevealOverlay({
  open,
  names,
  winnerName,
  onClose,
}: {
  open: boolean;
  names: string[];
  winnerName: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <RouletteRun names={names} winnerName={winnerName} onClose={onClose} />
  );
}

function RouletteRun({
  names,
  winnerName,
  onClose,
}: Omit<Parameters<typeof RouletteRevealOverlay>[0], 'open'>) {
  // Ensure the winner is part of the wheel.
  const [{ list, winnerIndex }] = useState(() => {
    const pool = names.includes(winnerName) ? names : [...names, winnerName];
    const wheel = pool.length >= 2 ? pool : [winnerName, winnerName];
    return {
      list: wheel,
      winnerIndex: Math.max(0, wheel.indexOf(winnerName)),
    };
  });
  const [reduceMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [phase, setPhase] = useState<'spin' | 'done'>(() =>
    reduceMotion ? 'done' : 'spin',
  );
  const [idx, setIdx] = useState(() => (reduceMotion ? winnerIndex : 0));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);

  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const releaseRef = useRef<(() => void) | null>(null);
  const onCloseRef = useRef(onClose);

  /* Как у листа: слой снимается со стека сразу, повторный «Назад» во время
     ухода идёт в навигацию; onClose — когда уход доигран. */
  const beginClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    releaseRef.current?.();
    setClosing(true);
    window.setTimeout(() => onCloseRef.current(), reduceMotion ? 0 : EXIT_MS);
  };
  const beginCloseRef = useRef(beginClose);
  // latest-ref: обновление вне рендера (правило react-hooks/refs)
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    beginCloseRef.current = beginClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    /* «Назад» и Escape закрывают и во время прокрутки: это явное «выйти». Тап
       по затемнению — только после остановки, случайное касание розыгрыш не
       прерывает. */
    const registration = pushOverlay(() => beginCloseRef.current());
    releaseRef.current = registration.release;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const reactivateBackground = deactivateBackground();
    cardRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && registration.isTop()) {
        e.stopPropagation();
        beginCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      registration.release();
      // inert снимается до возврата фокуса: внутри inert-поддерева focus() не сработает
      reactivateBackground();
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    let i = 0;
    let delay = 60;
    let count = 0;
    const total = list.length * 3 + winnerIndex; // ends exactly on the winner
    const step = () => {
      i = (i + 1) % list.length;
      setIdx(i);
      count++;
      if (count >= total) {
        setPhase('done');
        return;
      }
      if (count > total - 8) delay += 28; // decelerate
      timer.current = setTimeout(step, delay);
    };
    timer.current = setTimeout(step, delay);
    return () => clearTimeout(timer.current);
  }, [list.length, reduceMotion, winnerIndex]);

  const current = list[idx] ?? winnerName;

  return createPortal(
    <div className="rl" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        className={`glass roulette-scrim${closing ? ' is-closing' : ''}`}
        style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'color-mix(in srgb, var(--canvas) 78%, transparent)' }}
        onClick={phase === 'done' ? beginClose : undefined}
      />
      {/* Центрирующий слой касаний не берёт: он во весь экран лежал поверх
          затемнения, и тап мимо карточки до onClick затемнения не доходил. */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 61, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, pointerEvents: 'none' }}>
        <div
          ref={cardRef}
          tabIndex={-1}
          className={`surf-floating roulette-card${closing ? ' is-closing' : ' anim-pop'}`}
          style={{ position: 'relative', width: '100%', maxWidth: 320, padding: 28, textAlign: 'center', overflow: 'hidden', outline: 'none', pointerEvents: closing ? 'none' : 'auto' }}
        >
          <Confetti fire={phase === 'done'} count={32} />
          <div id={titleId} style={{ fontSize: 'var(--text-13)', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>
            {phase === 'done' ? 'Сегодня заказывает' : 'Выбираем ответственного'}
          </div>
          <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '6px 0 14px' }}>
            <Avatar name={current} size={56} ring={phase === 'done'} />
            <div className="font-head tight" style={{ fontSize: 'var(--text-28)', fontWeight: 700 }}>
              {current}
            </div>
          </div>
          {phase === 'done' && (
            <div className="anim-rise" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, color: 'var(--accent)' }}>
              <Icon name="crown" size={18} /> <span style={{ fontWeight: 600, fontSize: 'var(--text-13)' }}>Ответственный выбран</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {phase === 'done' ? (
              <Button variant="primary" icon="check" style={{ flex: 1 }} onClick={beginClose}>
                Принято
              </Button>
            ) : (
              <Button variant="secondary" loading style={{ flex: 1 }}>
                Крутим…
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

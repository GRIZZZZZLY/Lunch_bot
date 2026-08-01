/* ROCKET LUNCH — roulette reveal (redesign v2).
   Cycles through `names`, decelerates and lands on `winnerName`. */
import { useEffect, useRef, useState } from 'react';
import { Avatar, Button, Confetti } from './primitives';
import { Icon } from './Icon';

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
  const timer = useRef<ReturnType<typeof setTimeout>>();

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

  return (
    <div className="rl" role="dialog" aria-modal="true">
      <div
        className="glass"
        style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'color-mix(in srgb, var(--canvas) 78%, transparent)' }}
        onClick={phase === 'done' ? onClose : undefined}
      />
      <div style={{ position: 'fixed', inset: 0, zIndex: 61, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="surf-floating anim-pop" style={{ position: 'relative', width: '100%', maxWidth: 320, padding: 28, textAlign: 'center', overflow: 'hidden' }}>
          <Confetti fire={phase === 'done'} count={32} />
          <div style={{ fontSize: 'var(--text-13)', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>
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
              <Button variant="primary" icon="check" style={{ flex: 1 }} onClick={onClose}>
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
    </div>
  );
}

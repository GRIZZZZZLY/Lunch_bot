/**
 * Phase 1 (P0-5) — lazy-loaded confetti wrappers.
 *
 * react-confetti + canvas-confetti — тяжёлые библиотеки (~40-60 KB gzip),
 * нужны только в момент «успеха» (платёж подтверждён, голосование завершилось,
 * новый dish одобрен). Грузим on-demand через React.lazy + Suspense, чтобы
 * initial bundle не тащил их.
 *
 * Usage:
 *   import { LazyConfetti } from '@/components/common/LazyConfetti';
 *   <LazyConfetti width={width} height={height} numberOfPieces={200} recycle={false} />
 */
import { lazy, Suspense, type ComponentProps } from 'react';

const ConfettiInner = lazy(() => import('react-confetti'));

type ConfettiProps = ComponentProps<typeof ConfettiInner>;

export function LazyConfetti(props: ConfettiProps) {
  // Suspense fallback null — пока confetti грузится, ничего не показываем.
  // Это нормально: confetti — украшение, не блокирующий контент.
  return (
    <Suspense fallback={null}>
      <ConfettiInner {...props} />
    </Suspense>
  );
}

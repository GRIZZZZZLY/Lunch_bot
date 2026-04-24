import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SkipForward, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RouletteUser {
  id: number;
  firstName: string;
  lastName?: string;
}

interface RouletteRevealOverlayProps {
  isOpen: boolean;
  participants: RouletteUser[];
  winner: RouletteUser | null;
  onClose: () => void;
}

export const RouletteRevealOverlay: React.FC<RouletteRevealOverlayProps> = ({
  isOpen,
  participants,
  winner,
  onClose,
}) => {
  const [phase, setPhase] = useState<'spinning' | 'winner'>('spinning');
  const [canSkip, setCanSkip] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const displayParticipants = useMemo(() => participants.slice(0, 12), [participants]);
  const spinDuration = prefersReducedMotion ? 0.2 : 3;
  const winnerDuration = prefersReducedMotion ? 1.5 : 3.5;

  useEffect(() => {
    if (!isOpen) return;

    setPhase('spinning');
    setCanSkip(false);

    const skipTimer = setTimeout(() => setCanSkip(true), 2000);
    const revealTimer = setTimeout(() => setPhase('winner'), spinDuration * 1000);
    const closeTimer = setTimeout(() => onClose(), (spinDuration + winnerDuration) * 1000);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(revealTimer);
      clearTimeout(closeTimer);
    };
  }, [isOpen, onClose, spinDuration, winnerDuration]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4'
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 8, opacity: 0 }}
            className='w-full max-w-md rounded-3xl border border-white/15 bg-gradient-to-br from-indigo-600/90 via-violet-600/90 to-fuchsia-600/90 p-6 text-white shadow-2xl'
            onClick={e => e.stopPropagation()}
          >
            {canSkip && (
              <button
                type='button'
                onClick={onClose}
                className='absolute right-4 top-4 inline-flex min-h-11 items-center gap-1 rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/30 transition-colors'
                aria-label='Пропустить анимацию'
              >
                <SkipForward className='h-4 w-4' />
                Пропустить
              </button>
            )}

            {phase === 'spinning' ? (
              <div className='space-y-5'>
                <div className='flex items-center justify-center gap-2 text-white/90'>
                  <Sparkles className='h-5 w-5' />
                  <span className='text-sm font-medium tracking-wide'>Запускаем рулетку</span>
                </div>

                <motion.div
                  animate={{ rotate: prefersReducedMotion ? 0 : [0, 360, 720] }}
                  transition={{ duration: spinDuration, ease: 'easeOut' }}
                  className='mx-auto h-44 w-44 rounded-full border border-white/25 bg-white/10 p-3'
                >
                  <div className='relative h-full w-full rounded-full bg-black/10'>
                    {displayParticipants.map((user, idx) => {
                      const angle = (360 / displayParticipants.length) * idx;
                      return (
                        <span
                          key={`${user.id}-${idx}`}
                          className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-semibold'
                          style={{
                            transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-68px)`,
                            transformOrigin: 'center center',
                          }}
                        >
                          {user.firstName}
                        </span>
                      );
                    })}
                  </div>
                </motion.div>

                <div className='space-y-2'>
                  <p className='text-center text-sm text-white/90'>
                    Определяем ответственного за заказ...
                  </p>
                  {!prefersReducedMotion && (
                    <div className='h-1.5 w-full overflow-hidden rounded-full bg-white/20'>
                      <motion.div
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: spinDuration, ease: 'linear' }}
                        className='h-full rounded-full bg-white/80'
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className='space-y-5 text-center'>
                <div className='space-y-2'>
                  <p className='text-sm uppercase tracking-wide text-white/80'>Ответственный</p>
                  <h3 className='text-3xl font-bold'>
                    {winner ? `${winner.firstName}${winner.lastName ? ` ${winner.lastName}` : ''}` : 'Выбран'}
                  </h3>
                  <p className='text-sm text-white/85'>
                    Все заказы отправлены в личные сообщения участникам
                  </p>
                </div>

                <button
                  type='button'
                  onClick={onClose}
                  className={cn(
                    'w-full rounded-xl bg-white/20 px-4 py-3 text-sm font-semibold',
                    'hover:bg-white/30 transition-colors'
                  )}
                >
                  Отлично
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

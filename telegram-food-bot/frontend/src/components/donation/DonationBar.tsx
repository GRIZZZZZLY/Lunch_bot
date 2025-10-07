import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ChevronRight } from 'lucide-react';
import { GlassCard, GlassCardContent } from '../ui/glass-card';
import { DonationModal } from './DonationModal';
import { useHaptic } from '../../hooks/useHaptic';

const DONATION_CONFIG = {
  FIRST_SHOW_DELAY: 30 * 1000,           // Первый показ через 30 сек
  SHOW_INTERVAL: 5 * 60 * 1000,          // Повтор каждые 5 минут
  AUTO_HIDE_TIMEOUT: 10 * 1000,          // Скрыть через 10 сек
  DISMISS_DURATION: 24 * 60 * 60 * 1000, // Dismiss на 24 часа
  SWIPE_THRESHOLD: 100,                   // Порог свайпа для dismiss
};

/**
 * DonationBar - Swipeable notification bar для поддержки проекта
 * 
 * Поведение:
 * - Появляется через 30 сек после загрузки
 * - Повторяется каждые 5 минут
 * - Свайп влево/вправо для dismiss на 24 часа
 * - Тап для открытия модалки
 * - Автоматически скрывается через 10 сек
 */
export const DonationBar: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const haptic = useHaptic();

  // Логика появления через интервалы
  useEffect(() => {
    const checkAndShow = () => {
      const lastDismissed = localStorage.getItem('donation-bar-dismissed');
      const now = Date.now();

      // Проверяем, прошло ли 24 часа с последнего dismiss
      if (!lastDismissed || (now - parseInt(lastDismissed)) > DONATION_CONFIG.DISMISS_DURATION) {
        setIsVisible(true);

        // Автоскрытие через 10 сек
        setTimeout(() => {
          setIsVisible(false);
        }, DONATION_CONFIG.AUTO_HIDE_TIMEOUT);
      }
    };

    // Первый показ через 30 сек после загрузки
    const initialTimer = setTimeout(checkAndShow, DONATION_CONFIG.FIRST_SHOW_DELAY);

    // Потом каждые 5 минут
    const interval = setInterval(checkAndShow, DONATION_CONFIG.SHOW_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('donation-bar-dismissed', Date.now().toString());
    setIsVisible(false);
    haptic.light();
  };

  const handleTap = () => {
    setIsModalOpen(true);
    setIsVisible(false);
    haptic.medium();
  };

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDrag={(e, info) => {
              setDragOffset(info.offset.x);
            }}
            onDragEnd={(e, { offset }) => {
              if (Math.abs(offset.x) > DONATION_CONFIG.SWIPE_THRESHOLD) {
                handleDismiss();
              } else {
                setDragOffset(0);
              }
            }}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ 
              x: dragOffset > 0 ? 300 : dragOffset < 0 ? -300 : 0, 
              opacity: 0,
              transition: { duration: 0.3 }
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-20 left-4 right-4 z-40"
          >
            <GlassCard
              intensity="high"
              className="overflow-hidden shadow-xl cursor-pointer"
              onClick={handleTap}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-peach-500/20 to-coral-500/20" />
              <GlassCardContent className="relative py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 bg-peach-500/20 rounded-xl">
                      <Heart className="size-5 text-peach-500 fill-peach-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-foreground">
                        Помогите проекту
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Свайп → чтобы скрыть
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </div>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <DonationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

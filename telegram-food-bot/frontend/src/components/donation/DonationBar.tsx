import { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Heart, ChevronRight } from 'lucide-react';
import { DonationModal } from './DonationModal';
import { useHaptic } from '../../hooks/useHaptic';
import { DONATION_THEME, getDonationStyles } from '../../styles/donation.theme';
import { useAppStore } from '../../store/useAppStore';
import { ICON_SIZES } from '@/lib/design-tokens';

const DONATION_CONFIG = {
  FIRST_SHOW_DELAY: DONATION_THEME.timing.firstShowDelay,
  SHOW_INTERVAL: DONATION_THEME.timing.showInterval,
  AUTO_HIDE_TIMEOUT: DONATION_THEME.timing.autoHideTimeout,
  DISMISS_DURATION: DONATION_THEME.timing.dismissDuration,
  SWIPE_THRESHOLD: DONATION_THEME.timing.swipeThreshold,
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
  const isDark = useAppStore((s) => s.theme) === 'dark';
  const styles = getDonationStyles(isDark);

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
          <m.div
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
            className="fixed left-4 right-4 z-40"
            style={{ bottom: DONATION_THEME.spacing.barBottom }}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label="Поддержать проект"
              className="overflow-hidden cursor-pointer rounded-2xl transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: styles.gradients.bar,
                boxShadow: styles.shadow.bar,
                border: styles.border.default,
              }}
              onClick={handleTap}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleTap();
                }
              }}
            >
              <div className="relative py-4 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Heart icon with subtle pulse */}
                    <m.div
                      animate={{
                        scale: [1, 1.1, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="p-2 bg-white/20 rounded-xl"
                    >
                      <Heart 
                        size={DONATION_THEME.spacing.iconSize.medium}
                        className="fill-white"
                        style={{ color: 'white' }}
                      />
                    </m.div>
                    
                    <div className="flex-1">
                      <p className="font-bold text-base text-white">
                        Поддержать проект
                      </p>
                      <p className="text-xs mt-0.5 text-white/85">
                        Свайп в сторону чтобы скрыть
                      </p>
                    </div>
                  </div>
                  
                  <ChevronRight 
                    className={`${ICON_SIZES.md} flex-shrink-0`}
                    style={{ color: 'white' }}
                  />
                </div>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <DonationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

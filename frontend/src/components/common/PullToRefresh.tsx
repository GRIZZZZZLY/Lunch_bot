/**
 * Pull to Refresh Component
 * P2 Task: Advanced UX - Pull-to-refresh на всех страницах
 * 
 * Использует react-use для pull-to-refresh gesture
 */

import { useState, useRef, useEffect } from 'react';
import { m, useMotionValue, useTransform, animate } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useHaptic } from '@/hooks/useHaptic';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  disabled?: boolean;
}

/**
 * Pull-to-refresh wrapper
 * 
 * @example
 * ```tsx
 * <PullToRefresh onRefresh={async () => await refetch()}>
 *   <HomePage />
 * </PullToRefresh>
 * ```
 */
export const PullToRefresh = ({
  onRefresh,
  children,
  threshold = 80,
  disabled = false,
}: PullToRefreshProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const haptic = useHaptic();
  
  const y = useMotionValue(0);
  const rotate = useTransform(y, [0, threshold], [0, 360]);
  const opacity = useTransform(y, [0, threshold], [0, 1]);
  const scale = useTransform(y, [0, threshold], [0.5, 1]);

  useEffect(() => {
    if (disabled) return;

    const container = containerRef.current;
    if (!container) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Только если в верху страницы
      if (container.scrollTop > 0) return;
      
      const firstTouch = e.touches[0];
      if (!firstTouch) return;
      startY = firstTouch.clientY;
      isDragging = true;
      setIsPulling(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || isRefreshing) return;

      const firstTouch = e.touches[0];
      if (!firstTouch) return;
      currentY = firstTouch.clientY;
      const diff = currentY - startY;

      // Только pull down
      if (diff > 0) {
        e.preventDefault();
        
        // Resistance effect (чем дальше тянешь, тем сложнее)
        const resistance = 0.5;
        const pullDistance = Math.min(diff * resistance, threshold * 1.5);
        
        y.set(pullDistance);

        // Haptic feedback при достижении threshold
        if (pullDistance >= threshold && !isPulling) {
          haptic.medium();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isDragging) return;

      isDragging = false;
      setIsPulling(false);

      const pullDistance = y.get();

      if (pullDistance >= threshold && !isRefreshing) {
        // Triggered refresh!
        setIsRefreshing(true);
        haptic.notification('success');
        
        // Анимация до threshold позиции
        animate(y, threshold, {
          type: 'spring',
          stiffness: 300,
          damping: 20,
        });

        try {
          await onRefresh();
        } finally {
          // Возврат в исходное положение
          animate(y, 0, {
            type: 'spring',
            stiffness: 300,
            damping: 30,
          });
          
          setTimeout(() => {
            setIsRefreshing(false);
          }, 300);
        }
      } else {
        // Не достигли threshold - возврат
        animate(y, 0, {
          type: 'spring',
          stiffness: 300,
          damping: 20,
        });
      }
    };

    const handleTouchEndEvent = () => {
      void handleTouchEnd();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEndEvent);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEndEvent);
    };
  }, [disabled, isRefreshing, threshold, onRefresh, y, haptic, isPulling]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-y-auto"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Pull indicator */}
      <m.div
        className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center"
        style={{
          y,
          opacity,
        }}
      >
        <m.div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 backdrop-blur-sm shadow-lg"
          style={{
            scale,
            rotate: isRefreshing ? undefined : rotate,
          }}
        >
          <m.div
            animate={isRefreshing ? { rotate: 360 } : {}}
            transition={{
              repeat: isRefreshing ? Infinity : 0,
              duration: 1,
              ease: 'linear',
            }}
          >
            <RefreshCw className="h-6 w-6 text-primary-foreground" />
          </m.div>
        </m.div>
      </m.div>

      {/* Content */}
      <m.div
        style={{ y }}
        className="h-full"
      >
        {children}
      </m.div>

      {/* Debug info (dev only) */}
      {import.meta.env.MODE === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none">
          Pull: {Math.round(y.get())}px / {threshold}px
          {isRefreshing && ' (Refreshing...)'}
        </div>
      )}
    </div>
  );
};

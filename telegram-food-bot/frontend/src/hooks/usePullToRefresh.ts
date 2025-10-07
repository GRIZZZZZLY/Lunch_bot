import { useState, useEffect, useRef, useCallback } from 'react';
import { useTelegram } from './useTelegram';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // px для trigger
  disabled?: boolean;
}

interface UsePullToRefreshReturn {
  isPulling: boolean;
  pullProgress: number; // 0-1
  isRefreshing: boolean;
}

/**
 * usePullToRefresh - hook для реализации pull-to-refresh жеста
 * 
 * Особенности:
 * - Native pull-to-refresh на touch устройствах
 * - Haptic feedback при trigger
 * - Progress indicator (0-1)
 * - Поддержка async refresh функции
 * 
 * @example
 * ```tsx
 * const { isPulling, pullProgress, isRefreshing } = usePullToRefresh({
 *   onRefresh: async () => {
 *     await loadData();
 *   },
 * });
 * 
 * return (
 *   <>
 *     <PullToRefreshIndicator progress={pullProgress} isRefreshing={isRefreshing} />
 *     <div>Content</div>
 *   </>
 * );
 * ```
 */
export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshReturn => {
  const { hapticFeedback } = useTelegram();
  
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const startY = useRef(0);
  const currentY = useRef(0);
  const hasTriggeredHaptic = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    // Только если в самом верху страницы
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      hasTriggeredHaptic.current = false;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    if (window.scrollY !== 0) return;

    currentY.current = e.touches[0].clientY;
    const pullDistance = currentY.current - startY.current;

    if (pullDistance > 0) {
      // Prevent default только если тянем вниз
      if (pullDistance > 10) {
        e.preventDefault();
      }

      setIsPulling(true);
      const progress = Math.min(pullDistance / threshold, 1);
      setPullProgress(progress);

      // Haptic feedback при достижении threshold
      if (progress >= 1 && !hasTriggeredHaptic.current) {
        hapticFeedback.impactOccurred('medium');
        hasTriggeredHaptic.current = true;
      }
    }
  }, [disabled, isRefreshing, threshold, hapticFeedback]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing) return;

    // Trigger refresh если достигли threshold
    if (pullProgress >= 1) {
      setIsRefreshing(true);
      hapticFeedback.notificationOccurred('success');

      try {
        await onRefresh();
      } catch (error) {
        console.error('Pull-to-refresh error:', error);
        hapticFeedback.notificationOccurred('error');
      } finally {
        // Небольшая задержка чтобы пользователь увидел "обновление"
        setTimeout(() => {
          setIsRefreshing(false);
          setIsPulling(false);
          setPullProgress(0);
        }, 300);
      }
    } else {
      // Быстро скрываем индикатор если не достигли threshold
      setIsPulling(false);
      setPullProgress(0);
    }

    // Reset refs
    startY.current = 0;
    currentY.current = 0;
    hasTriggeredHaptic.current = false;
  }, [disabled, isRefreshing, pullProgress, onRefresh, hapticFeedback]);

  useEffect(() => {
    if (disabled) return;

    // Используем passive: false чтобы иметь возможность preventDefault
    const options: AddEventListenerOptions = { passive: false };

    document.addEventListener('touchstart', handleTouchStart, options);
    document.addEventListener('touchmove', handleTouchMove, options);
    document.addEventListener('touchend', handleTouchEnd, options);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  return {
    isPulling: isPulling || isRefreshing,
    pullProgress,
    isRefreshing,
  };
};

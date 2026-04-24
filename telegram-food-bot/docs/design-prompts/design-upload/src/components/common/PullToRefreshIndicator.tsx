import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface PullToRefreshIndicatorProps {
  progress: number; // 0-1
  isRefreshing: boolean;
}

/**
 * PullToRefreshIndicator - индикатор pull-to-refresh
 * 
 * Отображает:
 * - Rotating icon при pull
 * - Progress текст
 * - Loading состояние при refresh
 */
export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  progress,
  isRefreshing,
}) => {
  const rotation = progress * 360;
  const isReady = progress >= 1;

  return (
    <AnimatePresence>
      {(progress > 0 || isRefreshing) && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 25,
          }}
          className="fixed top-0 left-0 right-0 z-40 flex justify-center pt-4"
        >
          <div className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full',
            'bg-background/80 backdrop-blur-sm shadow-lg',
            'border border-border/50'
          )}>
            {/* Icon */}
            <motion.div
              animate={{ 
                rotate: isRefreshing ? 360 : rotation,
              }}
              transition={{
                duration: isRefreshing ? 1 : 0,
                repeat: isRefreshing ? Infinity : 0,
                ease: 'linear',
              }}
              className={cn(
                'transition-colors',
                isRefreshing && 'text-peach-500',
                isReady && !isRefreshing && 'text-mint-500',
                !isReady && !isRefreshing && 'text-muted-foreground'
              )}
            >
              {isRefreshing ? (
                <Loader2 className={ICON_SIZES.md} />
              ) : (
                <RefreshCw className={ICON_SIZES.md} />
              )}
            </motion.div>

            {/* Text */}
            <motion.span
              animate={{
                color: isRefreshing
                  ? 'rgb(var(--peach-500))'
                  : isReady
                  ? 'rgb(var(--mint-500))'
                  : 'rgb(var(--muted-foreground))',
              }}
              className="text-sm font-medium"
            >
              {isRefreshing
                ? 'Обновление...'
                : isReady
                ? 'Отпустите для обновления'
                : 'Потяните вниз'}
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

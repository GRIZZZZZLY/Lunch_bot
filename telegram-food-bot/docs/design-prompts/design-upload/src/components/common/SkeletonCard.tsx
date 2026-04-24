import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface SkeletonCardProps {
  variant?: 'default' | 'hero' | 'achievement' | 'challenge' | 'leaderboard' | 'dish';
  className?: string;
  count?: number; // Количество карточек (для списков)
}

/**
 * Skeleton Card Component
 * 
 * Улучшенный skeleton loader с shimmer эффектом
 * Разные варианты для разных типов контента
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  variant = 'default',
  className = '',
  count = 1,
}) => {
  const renderSkeleton = () => {
    switch (variant) {
      case 'hero':
        return (
          <div className={cn('rounded-2xl p-6 bg-white/5 backdrop-blur-sm', className)}>
            {/* Avatar + Name */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-white/10 animate-shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-6 w-32 bg-white/10 rounded animate-shimmer" />
                <div className="h-4 w-24 bg-white/10 rounded animate-shimmer" />
              </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-8 bg-white/10 rounded animate-shimmer" />
                  <div className="h-4 bg-white/10 rounded animate-shimmer" />
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-white/10 rounded animate-shimmer" />
                <div className="h-4 w-16 bg-white/10 rounded animate-shimmer" />
              </div>
              <div className="h-2 bg-white/10 rounded-full animate-shimmer" />
            </div>
          </div>
        );

      case 'achievement':
        return (
          <div className={cn('rounded-xl p-4 bg-white/5 backdrop-blur-sm', className)}>
            {/* Icon + Text */}
            <div className="flex items-start gap-3">
              <div className={`${ICON_SIZES['2xl']} rounded-lg bg-white/10 animate-shimmer shrink-0`} />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 bg-white/10 rounded animate-shimmer" />
                <div className="h-4 w-full bg-white/10 rounded animate-shimmer" />
                <div className="h-4 w-3/4 bg-white/10 rounded animate-shimmer" />
              </div>
            </div>

            {/* Badge */}
            <div className="mt-3 flex items-center gap-2">
              <div className="h-6 w-16 bg-white/10 rounded-full animate-shimmer" />
              <div className="h-6 w-20 bg-white/10 rounded-full animate-shimmer" />
            </div>
          </div>
        );

      case 'challenge':
        return (
          <div className={cn('rounded-xl p-4 bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm', className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 animate-shimmer" />
                <div className="h-5 w-32 bg-white/10 rounded animate-shimmer" />
              </div>
              <div className="h-6 w-16 bg-white/10 rounded-full animate-shimmer" />
            </div>

            {/* Description */}
            <div className="space-y-2 mb-3">
              <div className="h-4 w-full bg-white/10 rounded animate-shimmer" />
              <div className="h-4 w-2/3 bg-white/10 rounded animate-shimmer" />
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-16 bg-white/10 rounded animate-shimmer" />
                <div className="h-4 w-12 bg-white/10 rounded animate-shimmer" />
              </div>
              <div className="h-3 bg-white/10 rounded-full animate-shimmer" />
            </div>

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between">
              <div className="h-5 w-24 bg-white/10 rounded animate-shimmer" />
              <div className="h-5 w-20 bg-white/10 rounded animate-shimmer" />
            </div>
          </div>
        );

      case 'leaderboard':
        return (
          <div className={cn('rounded-xl p-4 bg-white/5 backdrop-blur-sm', className)}>
            <div className="flex items-center gap-4">
              {/* Rank */}
              <div className={`${ICON_SIZES.xl} rounded-full bg-white/10 animate-shimmer shrink-0`} />
              
              {/* Avatar */}
              <div className={`${ICON_SIZES['2xl']} rounded-full bg-white/10 animate-shimmer shrink-0`} />
              
              {/* Name + Stats */}
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 bg-white/10 rounded animate-shimmer" />
                <div className="h-4 w-24 bg-white/10 rounded animate-shimmer" />
              </div>

              {/* XP */}
              <div className="text-right space-y-2">
                <div className="h-6 w-20 bg-white/10 rounded animate-shimmer ml-auto" />
                <div className="h-4 w-16 bg-white/10 rounded animate-shimmer ml-auto" />
              </div>
            </div>
          </div>
        );

      case 'dish':
        return (
          <div className={cn('rounded-xl overflow-hidden bg-white/5 backdrop-blur-sm', className)}>
            {/* Image */}
            <div className="h-48 bg-white/10 animate-shimmer" />
            
            {/* Content */}
            <div className="p-4 space-y-3">
              <div className="h-6 w-3/4 bg-white/10 rounded animate-shimmer" />
              <div className="h-4 w-full bg-white/10 rounded animate-shimmer" />
              <div className="h-4 w-5/6 bg-white/10 rounded animate-shimmer" />
              
              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <div className="h-5 w-20 bg-white/10 rounded animate-shimmer" />
                <div className="h-8 w-24 bg-white/10 rounded-lg animate-shimmer" />
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className={cn('rounded-xl p-6 bg-white/5 backdrop-blur-sm', className)}>
            <div className="space-y-3">
              <div className="h-5 w-3/4 bg-white/10 rounded animate-shimmer" />
              <div className="h-4 w-full bg-white/10 rounded animate-shimmer" />
              <div className="h-4 w-5/6 bg-white/10 rounded animate-shimmer" />
            </div>
          </div>
        );
    }
  };

  if (count === 1) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {renderSkeleton()}
      </motion.div>
    );
  }

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ delay: i * 0.1 }}
        >
          {renderSkeleton()}
        </motion.div>
      ))}
    </>
  );
};

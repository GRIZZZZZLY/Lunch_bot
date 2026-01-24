/**
 * StreakBadge - Компактный бейдж с серией дней
 * Используется в навигации/профиле
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreakBadgeProps {
  streak: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizeClasses = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-3 py-1.5',
  lg: 'text-base px-4 py-2',
};

const iconSizes = {
  sm: 12,
  md: 16,
  lg: 20,
};

export const StreakBadge: React.FC<StreakBadgeProps> = ({
  streak,
  size = 'md',
  showLabel = false,
  animated = true,
  onClick,
  className,
}) => {
  if (streak === 0) return null;

  const getStreakColor = (days: number) => {
    if (days >= 30) return 'from-purple-500 to-pink-500';
    if (days >= 14) return 'from-blue-500 to-cyan-500';
    if (days >= 7) return 'from-yellow-500 to-orange-500';
    return 'from-orange-500 to-red-500';
  };

  const badge = (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold',
        'bg-gradient-to-r text-white shadow-lg',
        getStreakColor(streak),
        sizeClasses[size],
        onClick && 'cursor-pointer hover:scale-105 transition-transform',
        className
      )}
      onClick={onClick}
    >
      <Flame size={iconSizes[size]} className="fill-current" />
      <span>{streak}</span>
      {showLabel && <span className="text-xs opacity-90">дней</span>}
    </div>
  );

  if (!animated) return badge;

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 15,
      }}
    >
      {badge}
    </motion.div>
  );
};

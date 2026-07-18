import React, { useEffect, useState } from 'react';
import { m } from 'framer-motion';
import { cn } from '../../lib/utils';

interface CircularProgressTimerProps {
  endTime: string | Date;
  size?: 'sm' | 'md' | 'lg';
  showTime?: boolean;
  className?: string;
  onExpire?: () => void;
}

const sizes = {
  sm: { width: 48, stroke: 3, fontSize: 'text-xs' },
  md: { width: 64, stroke: 4, fontSize: 'text-sm' },
  lg: { width: 80, stroke: 5, fontSize: 'text-base' },
};

export const CircularProgressTimer: React.FC<CircularProgressTimerProps> = ({
  endTime,
  size = 'md',
  showTime = true,
  className,
  onExpire,
}) => {
  const [progress, setProgress] = useState(100);
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [isLastMinute, setIsLastMinute] = useState(false);

  const { width, stroke, fontSize } = sizes[size];
  const radius = (width - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const endDate = new Date(endTime);
    const startTime = Date.now();
    const totalDuration = endDate.getTime() - startTime;

    if (totalDuration <= 0) {
      setIsExpired(true);
      setProgress(0);
      setTimeLeft('0:00');
      onExpire?.();
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = endDate.getTime() - now;

      if (remaining <= 0) {
        setIsExpired(true);
        setProgress(0);
        setTimeLeft('0:00');
        onExpire?.();
        return;
      }

      const progressPercent = (remaining / totalDuration) * 100;
      setProgress(Math.max(0, Math.min(100, progressPercent)));

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      
      setIsLastMinute(remaining < 60000);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [endTime, onExpire]);

  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const getGradientColors = () => {
    if (isExpired) return { start: '#9ca3af', end: '#6b7280' };
    if (isLastMinute) return { start: '#ef4444', end: '#dc2626' };
    if (progress < 30) return { start: '#f97316', end: '#ea580c' };
    return { start: '#22c55e', end: '#16a34a' };
  };

  const colors = getGradientColors();
  const gradientId = `timer-gradient-${size}`;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={width}
        height={width}
        className={cn(
          'transform -rotate-90',
          isLastMinute && 'animate-pulse'
        )}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.start} />
            <stop offset="100%" stopColor={colors.end} />
          </linearGradient>
        </defs>
        
        {/* Background circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-gray-200 dark:text-gray-700"
        />
        
        {/* Progress circle */}
        <m.circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </svg>

      {showTime && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              'font-bold tabular-nums',
              fontSize,
              isExpired && 'text-gray-400 dark:text-gray-500',
              isLastMinute && !isExpired && 'text-red-500 animate-pulse',
              !isLastMinute && !isExpired && 'text-gray-700 dark:text-gray-200'
            )}
          >
            {isExpired ? '—' : timeLeft}
          </span>
        </div>
      )}
    </div>
  );
};

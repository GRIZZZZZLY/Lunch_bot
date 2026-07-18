import React from 'react';
import { useTelegram } from '../../hooks/useTelegram';

const variantClasses = {
  primary: 'bg-primary-food-700 text-white hover:bg-primary-food-800 focus:ring-primary-food-500 active:bg-primary-food-900 shadow-md shadow-primary-food-700/30 dark:bg-peach-500 dark:hover:bg-peach-600 dark:text-slate-900 dark:shadow-peach-500/30',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 active:bg-gray-400 dark:bg-bluegray-600 dark:text-bluegray-200 dark:hover:bg-bluegray-500',
  destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 active:bg-red-800 dark:bg-error-soft-400 dark:hover:bg-error-soft-300 dark:text-slate-900',
  ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500 active:bg-gray-200 dark:text-bluegray-300 dark:hover:bg-bluegray-800/50',
};

const sizeClasses = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};


export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  haptic?: boolean;
}

/**
 * Кнопка с интеграцией Telegram WebApp
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  onClick,
  type = 'button',
  className = '',
  haptic = true,
}) => {
  const { hapticFeedback } = useTelegram();

  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 transform-gpu focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 hover:shadow-lg active:shadow-sm';

  const widthClasses = fullWidth ? 'w-full' : '';

  const handleClick = () => {
    if (disabled || loading) return;

    if (haptic) {
      hapticFeedback.impactOccurred('light');
    }

    onClick?.();
  };

  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    widthClasses,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={handleClick}
    >
      {loading && (
        <svg 
          className="animate-spin -ml-1 mr-3 h-5 w-5" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};

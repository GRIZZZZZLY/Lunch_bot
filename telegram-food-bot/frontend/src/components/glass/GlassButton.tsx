import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGlassStyles, type GlassVariant, type GlassTheme } from '@/lib/glassmorphism';
import { useHaptic } from '@/hooks/useHaptic';
import { ICON_SIZES } from '@/lib/design-tokens';

export interface GlassButtonProps {
  children?: React.ReactNode;
  icon?: LucideIcon;
  label?: string;
  variant?: GlassVariant;
  theme?: GlassTheme;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  haptic?: boolean;
}

/**
 * GlassButton - премиальная кнопка с glassmorphism эффектом
 * 
 * @component
 * @example
 * ```tsx
 * import { UtensilsCrossed } from 'lucide-react';
 * 
 * <GlassButton 
 *   icon={UtensilsCrossed} 
 *   label="Меню"
 *   onClick={() => navigate('/menu')}
 * />
 * ```
 */
export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      children,
      icon: Icon,
      label,
      variant = 'light',
      theme = 'light',
      size = 'md',
      disabled = false,
      onClick,
      className,
      haptic = true,
    },
    ref
  ) => {
    const hapticFeedback = useHaptic();
    const glassStyles = getGlassStyles(variant, theme);
    
    const sizes = {
      sm: {
        button: 'w-16 h-16 p-2',
        icon: 20,
        text: 'text-xs',
        gap: 'gap-1',
      },
      md: {
        button: 'w-[72px] h-[72px] p-3',
        icon: 24,
        text: 'text-sm',
        gap: 'gap-1',
      },
      lg: {
        button: 'w-24 h-24 p-4',
        icon: 28,
        text: 'text-base',
        gap: 'gap-2',
      },
    };
    
    const sizeConfig = sizes[size];
    
    const handleClick = () => {
      if (disabled) return;
      
      if (haptic) {
        hapticFeedback.medium();
      }
      
      onClick?.();
    };
    
    const baseClasses = cn(
      'flex flex-col items-center justify-center',
      'rounded-2xl',
      'transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-primary-food-500 focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      !disabled && 'hover:scale-105 active:scale-95',
      sizeConfig.button,
      sizeConfig.gap,
      className
    );
    
    return (
      <motion.button
        ref={ref}
        className={baseClasses}
        style={glassStyles}
        onClick={handleClick}
        disabled={disabled}
        whileHover={!disabled ? { 
          y: -2,
          boxShadow: '0 12px 24px rgba(0, 0, 0, 0.15)' 
        } : {}}
        whileTap={!disabled ? { 
          scale: 0.98 
        } : {}}
        transition={{ duration: 0.2 }}
      >
        {Icon && (
          <Icon 
            size={sizeConfig.icon} 
            strokeWidth={2}
            className="text-current"
          />
        )}
        
        {label && (
          <span className={cn('font-medium', sizeConfig.text)}>
            {label}
          </span>
        )}
        
        {children}
      </motion.button>
    );
  }
);

GlassButton.displayName = 'GlassButton';

/**
 * GlassActionButtons - набор из 4 action buttons для главного экрана
 */
export interface ActionButton {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

export interface GlassActionButtonsProps {
  buttons: [ActionButton, ActionButton, ActionButton, ActionButton];
  theme?: GlassTheme;
  className?: string;
}

export const GlassActionButtons: React.FC<GlassActionButtonsProps> = ({
  buttons,
  theme = 'light',
  className,
}) => {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4', className)}>
      {buttons.map((button, index) => (
        <motion.div
          key={button.label}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            delay: index * 0.1,
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1]
          }}
        >
          <GlassButton
            icon={button.icon}
            label={button.label}
            onClick={button.onClick}
            theme={theme}
          />
        </motion.div>
      ))}
    </div>
  );
};

GlassActionButtons.displayName = 'GlassActionButtons';

/**
 * GlassIconButton - маленькая иконочная glass кнопка
 */
export interface GlassIconButtonProps {
  icon: LucideIcon;
  onClick?: () => void;
  variant?: GlassVariant;
  theme?: GlassTheme;
  className?: string;
  'aria-label'?: string;
}

export const GlassIconButton: React.FC<GlassIconButtonProps> = ({
  icon: Icon,
  onClick,
  variant = 'light',
  theme = 'light',
  className,
  'aria-label': ariaLabel,
}) => {
  const hapticFeedback = useHaptic();
  const glassStyles = getGlassStyles(variant, theme);
  
  const handleClick = () => {
    hapticFeedback.light();
    onClick?.();
  };
  
  return (
    <motion.button
      className={cn(
        'w-10 h-10 rounded-full',
        'flex items-center justify-center',
        'transition-all duration-200',
        'hover:scale-110 active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-primary-food-500',
        className
      )}
      style={glassStyles}
      onClick={handleClick}
      aria-label={ariaLabel}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <Icon className={ICON_SIZES.md} strokeWidth={2} />
    </motion.button>
  );
};

GlassIconButton.displayName = 'GlassIconButton';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getGlassStyles, type GlassVariant, type GlassTheme } from '@/lib/glassmorphism';

export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: GlassVariant;
  theme?: GlassTheme;
  gradient?: {
    from: string;
    to: string;
  };
  animate?: boolean;
  hover?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * GlassCard - премиальная карточка с glassmorphism эффектом
 * 
 * @component
 * @example
 * ```tsx
 * // Базовое использование
 * <GlassCard>
 *   <p>Content</p>
 * </GlassCard>
 * 
 * // С градиентом (для Hero card)
 * <GlassCard 
 *   gradient={{
 *     from: 'rgba(255, 237, 213, 0.7)',
 *     to: 'rgba(254, 215, 170, 0.7)'
 *   }}
 * >
 *   <h1>₽1,450</h1>
 * </GlassCard>
 * 
 * // С анимацией и hover
 * <GlassCard animate hover>
 *   <p>Interactive card</p>
 * </GlassCard>
 * ```
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      className,
      variant = 'medium',
      theme = 'light',
      gradient,
      animate = true,
      hover = false,
      onClick,
      style,
    },
    ref
  ) => {
    const glassStyles = getGlassStyles(variant, theme);
    
    const cardStyle: React.CSSProperties = {
      ...glassStyles,
      ...(gradient && {
        background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
      }),
      ...style,
    };
    
    const baseClasses = cn(
      'rounded-xl transition-all duration-200',
      hover && 'hover:shadow-xl cursor-pointer',
      onClick && 'cursor-pointer',
      className
    );
    
    // Варианты анимации
    const animationVariants = {
      initial: { 
        opacity: 0 
      },
      animate: { 
        opacity: 1,
        transition: {
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1] as [number, number, number, number]
        }
      },
      exit: { 
        opacity: 0 
      },
    };
    
    const hoverVariants = hover ? {
      whileHover: {
        y: -4,
        transition: { duration: 0.2 }
      },
      whileTap: {
        y: 0,
      }
    } : {};
    
    if (animate) {
      return (
        <motion.div
          ref={ref}
          className={baseClasses}
          style={cardStyle}
          variants={animationVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          {...hoverVariants}
          onClick={onClick}
        >
          {children}
        </motion.div>
      );
    }
    
    return (
      <div
        ref={ref}
        className={baseClasses}
        style={cardStyle}
        onClick={onClick}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

/**
 * GlassHeroCard - специализированная карточка для Hero section
 * с поддержкой time-based градиентов
 */
export interface GlassHeroCardProps extends Omit<GlassCardProps, 'children' | 'gradient'> {
  gradient: {
    from: string;
    to: string;
  };
  value: string | number;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  textColor?: string;
}

export const GlassHeroCard: React.FC<GlassHeroCardProps> = ({
  gradient,
  value,
  label,
  sublabel,
  icon,
  textColor = '#1F2937',
  className,
  ...props
}) => {
  return (
    <GlassCard
      gradient={gradient}
      variant="medium"
      animate
      hover
      className={cn('p-6', className)}
      {...props}
    >
      <div className="space-y-3">
        {/* Label */}
        <div className="flex items-center justify-between">
          <p 
            className="text-sm font-medium"
            style={{ color: textColor, opacity: 0.8 }}
          >
            {label}
          </p>
          {icon && (
            <div style={{ color: textColor, opacity: 0.6 }}>
              {icon}
            </div>
          )}
        </div>
        
        {/* Value (Count-up animation) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <h1 
            className="text-5xl font-bold"
            style={{ color: textColor }}
          >
            {value}
          </h1>
        </motion.div>
        
        {/* Sublabel */}
        {sublabel && (
          <p 
            className="text-sm"
            style={{ color: textColor, opacity: 0.7 }}
          >
            {sublabel}
          </p>
        )}
      </div>
    </GlassCard>
  );
};

GlassHeroCard.displayName = 'GlassHeroCard';

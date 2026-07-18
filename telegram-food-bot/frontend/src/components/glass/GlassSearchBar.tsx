import React, { useState, useCallback } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGlassTailwindClasses, type GlassVariant, type GlassTheme } from '@/lib/glassmorphism';
import { useHaptic } from '@/hooks/useHaptic';
import { useTelegram } from '@/hooks/useTelegram';
import { ICON_SIZES } from '@/lib/design-tokens';

export interface GlassSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  variant?: GlassVariant;
  theme?: GlassTheme;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * GlassSearchBar - поисковая строка с glassmorphism эффектом
 * 
 * @component
 * @example
 * ```tsx
 * const [query, setQuery] = useState('');
 * 
 * <GlassSearchBar
 *   value={query}
 *   onChange={setQuery}
 *   placeholder="Поиск блюд..."
 * />
 * ```
 */
export const GlassSearchBar: React.FC<GlassSearchBarProps> = ({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = 'Поиск...',
  variant = 'medium',
  theme = 'light',
  className,
  autoFocus = false,
  disabled = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const haptic = useHaptic();
  const { colorScheme } = useTelegram();
  
  const isDark = colorScheme === 'dark';
  const effectiveTheme = theme === 'light' && isDark ? 'dark' : theme;
  
  const glassClasses = getGlassTailwindClasses(variant, effectiveTheme);
  
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    haptic.light();
    onFocus?.();
  }, [haptic, onFocus]);
  
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);
  
  const handleClear = useCallback(() => {
    onChange('');
    haptic.light();
  }, [onChange, haptic]);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);
  
  return (
    <m.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200',
        glassClasses,
        isFocused && 'ring-2 ring-primary-food-500/50 shadow-lg',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      {/* Search Icon */}
      <m.div
        animate={{
          scale: isFocused ? 1.1 : 1,
          color: isFocused ? (isDark ? '#fb923c' : '#ea580c') : (isDark ? '#9ca3af' : '#6b7280')
        }}
        transition={{ duration: 0.2 }}
      >
        <Search className={ICON_SIZES.md} />
      </m.div>
      
      {/* Input */}
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className={cn(
          'flex-1 bg-transparent outline-none text-base',
          'placeholder:text-gray-400 dark:placeholder:text-gray-400 dark:text-gray-400',
          'text-gray-900 dark:text-white',
          'transition-colors duration-200'
        )}
      />
      
      {/* Clear Button */}
      <AnimatePresence>
        {value && (
          <m.button
            type="button"
            onClick={handleClear}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={cn(
              'p-1 rounded-full transition-colors duration-200',
              'hover:bg-gray-200/50 dark:hover:bg-gray-700/50',
              'text-gray-500 dark:text-gray-400'
            )}
            aria-label="Очистить"
          >
            <X className={ICON_SIZES.sm} />
          </m.button>
        )}
      </AnimatePresence>
    </m.div>
  );
};

GlassSearchBar.displayName = 'GlassSearchBar';

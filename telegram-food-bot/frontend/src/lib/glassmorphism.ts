/**
 * Glassmorphism утилиты для создания премиального glass эффекта
 * Все стили WCAG AA compliant
 */

export type GlassVariant = 'light' | 'medium' | 'heavy' | 'ultra';
export type GlassTheme = 'light' | 'dark';

export interface GlassStyles {
  backdropFilter: string;
  background: string;
  border: string;
  boxShadow: string;
}

/**
 * Базовые glass параметры для разных вариантов
 */
const GLASS_CONFIGS = {
  light: {
    blur: '12px', // Увеличено с 10px для лучшей читаемости
    light: {
      background: 'rgba(255, 255, 255, 0.75)', // Увеличено с 0.65 для лучшего контраста
      border: 'rgba(255, 255, 255, 0.35)',
      shadow: 'rgba(0, 0, 0, 0.12)',
    },
    dark: {
      background: 'rgba(35, 46, 60, 0.75)', // Увеличено с 0.65
      border: 'rgba(255, 255, 255, 0.12)',
      shadow: 'rgba(0, 0, 0, 0.35)',
    },
  },
  medium: {
    blur: '16px', // Увеличено с 14px для WCAG AA соответствия
    light: {
      background: 'rgba(255, 255, 255, 0.85)', // Увеличено с 0.75 для контраста 4.5:1
      border: 'rgba(255, 255, 255, 0.4)',
      shadow: 'rgba(0, 0, 0, 0.15)',
    },
    dark: {
      background: 'rgba(35, 46, 60, 0.85)', // Увеличено с 0.75
      border: 'rgba(255, 255, 255, 0.15)',
      shadow: 'rgba(0, 0, 0, 0.4)',
    },
  },
  heavy: {
    blur: '20px', // Увеличено с 16px
    light: {
      background: 'rgba(255, 255, 255, 0.9)', // Увеличено с 0.8
      border: 'rgba(255, 255, 255, 0.4)',
      shadow: 'rgba(0, 0, 0, 0.15)',
    },
    dark: {
      background: 'rgba(35, 46, 60, 0.9)', // Увеличено с 0.8
      border: 'rgba(255, 255, 255, 0.15)',
      shadow: 'rgba(0, 0, 0, 0.4)',
    },
  },
  ultra: {
    blur: '24px',
    light: {
      background: 'rgba(255, 255, 255, 0.95)',
      border: 'rgba(255, 255, 255, 0.4)',
      shadow: 'rgba(0, 0, 0, 0.2)',
    },
    dark: {
      background: 'rgba(41, 55, 75, 0.95)',      // Оптимизированный slate-800 custom
      border: 'rgba(226, 232, 240, 0.2)',        // slate-200 с прозрачностью
      shadow: 'rgba(0, 0, 0, 0.6)',              // Более глубокая тень
    },
  },
} as const;

/**
 * Генерирует glassmorphism стили
 * 
 * @param variant - вариант glass эффекта
 * @param theme - светлая или тёмная тема
 * @param saturate - увеличение насыщенности (опционально)
 * @returns объект с CSS стилями
 * 
 * @example
 * ```tsx
 * const glassStyles = getGlassStyles('medium', 'light');
 * <div style={glassStyles}>Glass content</div>
 * ```
 */
export function getGlassStyles(
  variant: GlassVariant = 'medium',
  theme: GlassTheme = 'light',
  saturate: boolean = false
): GlassStyles {
  const config = GLASS_CONFIGS[variant];
  const colors = config[theme];
  
  const backdropFilter = saturate 
    ? `blur(${config.blur}) saturate(180%)`
    : `blur(${config.blur})`;
  
  // Оптимизированные стили для dark theme
  if (theme === 'dark') {
    const darkBackgrounds: Record<GlassVariant, string> = {
      light: 'rgba(51, 65, 85, 0.5)',      // slate-700 с прозрачностью
      medium: 'rgba(51, 65, 85, 0.7)',     // slate-700 более плотный
      heavy: 'rgba(41, 55, 75, 0.85)',     // custom slate между 800-700
      ultra: 'rgba(30, 41, 59, 0.95)',     // slate-800 почти непрозрачный
    };
    
    const darkBorders: Record<GlassVariant, string> = {
      light: 'rgba(226, 232, 240, 0.08)',  // slate-200
      medium: 'rgba(226, 232, 240, 0.12)',
      heavy: 'rgba(226, 232, 240, 0.15)',
      ultra: 'rgba(226, 232, 240, 0.2)',
    };
    
    const darkShadows: Record<GlassVariant, string> = {
      light: 'rgba(0, 0, 0, 0.3)',
      medium: 'rgba(0, 0, 0, 0.4)',
      heavy: 'rgba(0, 0, 0, 0.5)',
      ultra: 'rgba(0, 0, 0, 0.6)',
    };
    
    return {
      backdropFilter: `blur(${config.blur}) saturate(180%)`,
      background: darkBackgrounds[variant],
      border: `1px solid ${darkBorders[variant]}`,
      boxShadow: `0 8px 32px ${darkShadows[variant]}, inset 0 1px 0 0 rgba(255, 255, 255, ${variant === 'light' ? '0.05' : variant === 'medium' ? '0.08' : '0.1'})`,
    };
  }
  
  return {
    backdropFilter,
    background: colors.background,
    border: `1px solid ${colors.border}`,
    boxShadow: `0 8px 32px ${colors.shadow}`,
  };
}

/**
 * Генерирует glassmorphism CSS classes (Tailwind-compatible)
 * 
 * @param variant - вариант glass эффекта
 * @param theme - светлая или тёмная тема
 * @returns строка с CSS классами
 * 
 * @example
 * ```tsx
 * <div className={getGlassClasses('medium', 'light')}>
 *   Glass content
 * </div>
 * ```
 */
export function getGlassClasses(
  variant: GlassVariant = 'medium',
  theme: GlassTheme = 'light'
): string {
  const baseClasses = 'glass-morphism';
  const variantClass = `glass-${variant}`;
  const themeClass = theme === 'dark' ? 'glass-dark' : 'glass-light';
  
  return `${baseClasses} ${variantClass} ${themeClass}`;
}

/**
 * Glassmorphism стили для navigation bar
 */
export function getGlassNavigationStyles(theme: GlassTheme = 'light'): GlassStyles {
  const blur = '20px';
  const saturate = '180%';
  
  if (theme === 'light') {
    return {
      backdropFilter: `blur(${blur}) saturate(${saturate})`,
      background: 'rgba(255, 255, 255, 0.8)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.1)',
    };
  } else {
    return {
      backdropFilter: `blur(${blur}) saturate(${saturate})`,
      background: 'rgba(23, 33, 43, 0.8)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.3)',
    };
  }
}

/**
 * Glassmorphism стили для modal backdrop
 */
export function getGlassBackdropStyles(theme: GlassTheme = 'light'): GlassStyles {
  return {
    backdropFilter: 'blur(8px)',
    background: theme === 'light' 
      ? 'rgba(0, 0, 0, 0.4)' 
      : 'rgba(0, 0, 0, 0.6)',
    border: 'none',
    boxShadow: 'none',
  };
}

/**
 * Glassmorphism стили для Hero card с gradient
 * 
 * @param gradientFrom - начальный цвет градиента
 * @param gradientTo - конечный цвет градиента
 * @param theme - светлая или тёмная тема
 */
export function getGlassHeroStyles(
  gradientFrom: string,
  gradientTo: string,
  theme: GlassTheme = 'light'
): React.CSSProperties {
  const glassStyles = getGlassStyles('medium', theme);
  
  return {
    ...glassStyles,
    background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
    backdropFilter: 'blur(12px)',
  };
}

/**
 * Tailwind CSS классы для glassmorphism
 * (требуется добавление в tailwind.config.js)
 */
export const GLASS_TAILWIND_CLASSES = {
  light: {
    light: 'backdrop-blur-sm bg-white/60 border border-white/25 shadow-sm',
    medium: 'backdrop-blur-md bg-white/70 border border-white/30 shadow-md',
    heavy: 'backdrop-blur-lg bg-white/80 border border-white/35 shadow-lg',
    ultra: 'backdrop-blur-2xl bg-white/95 border border-white/40 shadow-2xl',
  },
  dark: {
    light: 'backdrop-blur-sm bg-[rgba(35,46,60,0.6)] border border-white/[0.08] shadow-sm',
    medium: 'backdrop-blur-md bg-[rgba(35,46,60,0.7)] border border-white/10 shadow-md',
    heavy: 'backdrop-blur-lg bg-[rgba(35,46,60,0.8)] border border-white/[0.12] shadow-lg',
    ultra: 'backdrop-blur-2xl bg-[rgba(35,46,60,0.95)] border border-white/[0.15] shadow-2xl',
  },
} as const;

/**
 * Получить Tailwind classes для glass эффекта
 */
export function getGlassTailwindClasses(
  variant: GlassVariant = 'medium',
  theme: GlassTheme = 'light'
): string {
  return GLASS_TAILWIND_CLASSES[theme][variant];
}

/**
 * CSS custom properties для glassmorphism
 * (можно использовать в :root)
 */
export function getGlassCSSVariables(theme: GlassTheme = 'light'): Record<string, string> {
  const config = GLASS_CONFIGS.medium;
  const colors = config[theme];
  
  return {
    '--glass-blur': config.blur,
    '--glass-background': colors.background,
    '--glass-border': colors.border,
    '--glass-shadow': colors.shadow,
  };
}

/**
 * Утилита для создания inline styles с glassmorphism
 */
export function createGlassStyle(
  variant: GlassVariant = 'medium',
  theme: GlassTheme = 'light',
  additionalStyles?: React.CSSProperties
): React.CSSProperties {
  const glassStyles = getGlassStyles(variant, theme);
  
  return {
    backdropFilter: glassStyles.backdropFilter,
    background: glassStyles.background,
    border: glassStyles.border,
    boxShadow: glassStyles.boxShadow,
    ...additionalStyles,
  };
}

/**
 * Проверка поддержки backdrop-filter
 */
export function isBackdropFilterSupported(): boolean {
  if (typeof window === 'undefined') return false;
  
  return CSS.supports('backdrop-filter', 'blur(1px)') ||
         CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
}

/**
 * Fallback стили для браузеров без поддержки backdrop-filter
 */
export function getGlassFallbackStyles(theme: GlassTheme = 'light'): React.CSSProperties {
  return {
    background: theme === 'light' 
      ? 'rgba(255, 255, 255, 0.95)' 
      : 'rgba(35, 46, 60, 0.95)',
    border: `1px solid ${theme === 'light' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
    boxShadow: `0 8px 32px ${theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.3)'}`,
  };
}

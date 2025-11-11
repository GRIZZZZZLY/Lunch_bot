/**
 * 🎨 ЦЕНТРАЛИЗОВАННЫЕ ДИЗАЙН-ТОКЕНЫ
 * 
 * Single source of truth для всех дизайн-значений.
 * Использовать вместо magic numbers в компонентах.
 * 
 * @version 2.0.0
 * @date 2025-11-10
 */

/**
 * 🎯 ICON_SIZES - Tailwind классы для иконок
 * Используйте вместо inline размеров (size-3, w-5 h-5, etc.)
 * 
 * @example
 * // ❌ OLD:
 * <Icon className="size-5" />
 * <Icon className="w-6 h-6" />
 * 
 * // ✅ NEW:
 * import { ICON_SIZES } from '@/lib/design-tokens';
 * <Icon className={ICON_SIZES.md} />
 * <Icon className={ICON_SIZES.lg} />
 */
export const ICON_SIZES = {
  xs: 'size-3',     // 12px (0.75rem) - inline badges, metadata icons
  sm: 'size-4',     // 16px (1rem) - inline text, small buttons
  md: 'size-5',     // 20px (1.25rem) - DEFAULT - standard buttons, list items
  lg: 'size-6',     // 24px (1.5rem) - headers, emphasized actions
  xl: 'size-8',     // 32px (2rem) - hero sections, feature icons
  '2xl': 'size-12', // 48px (3rem) - empty states, celebrations, large illustrations
} as const;

export const DESIGN_TOKENS = {
  /**
   * 📏 SPACING - 8pt Grid System
   * Только четные значения для визуальной согласованности
   */
  spacing: {
    none: '0',         // 0px
    xs: '0.5rem',      // 8px - tight spacing
    sm: '1rem',        // 16px - DEFAULT card padding
    md: '1.5rem',      // 24px - comfortable padding
    lg: '2rem',        // 32px - section padding
    xl: '3rem',        // 48px - page padding
  },

  /**
   * 🔘 RADIUS - Border Radius
   * Только 4 варианта для всего приложения
   */
  radius: {
    sm: '0.5rem',      // 8px - buttons, inputs
    md: '0.75rem',     // 12px - cards (DEFAULT)
    lg: '1rem',        // 16px - large cards
    full: '9999px',    // ∞ - avatars, badges
  },

  /**
   * 🎨 ICON SIZE - Стандартизированные размеры иконок (rem values)
   * Для Tailwind классов используйте ICON_SIZES
   */
  iconSize: {
    xs: '1rem',        // 16px - inline text icons
    sm: '1.25rem',     // 20px - list items, badges
    md: '1.5rem',      // 24px - DEFAULT (buttons, headers)
    lg: '2rem',        // 32px - feature icons, quick actions
    xl: '3rem',        // 48px - empty states, celebrations
  },

  /**
   * 🌑 SHADOWS - Box Shadows
   * От subtle до dramatic
   */
  shadow: {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  },

  /**
   * ⏱️ ANIMATION - Transition Durations
   * Стандартные скорости анимаций
   */
  animation: {
    fast: '150ms',     // micro-interactions (hover)
    base: '200ms',     // DEFAULT transitions
    slow: '300ms',     // complex animations
    slower: '500ms',   // page transitions
  },

  /**
   * 🎭 EASING - Animation Easing Functions
   */
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // bouncy
  },

  /**
   * 🔤 TYPOGRAPHY - Font Sizes
   * Четкая иерархия с минимум 4px разницей между уровнями
   */
  fontSize: {
    xs: '0.75rem',     // 12px - captions, metadata
    sm: '0.875rem',    // 14px - body text
    base: '1rem',      // 16px - DEFAULT
    lg: '1.125rem',    // 18px - subheadings
    xl: '1.25rem',     // 20px - card headings
    '2xl': '1.5rem',   // 24px - page headings
    '3xl': '1.875rem', // 30px - hero headings
  },

  /**
   * ⚖️ FONT WEIGHTS
   */
  fontWeight: {
    normal: 400,       // body text
    medium: 500,       // emphasis, buttons
    semibold: 600,     // subheadings
    bold: 700,         // headings, numbers
  },

  /**
   * 📐 LINE HEIGHT
   */
  lineHeight: {
    tight: 1.25,       // headings
    normal: 1.5,       // body text
    relaxed: 1.75,     // large text blocks
  },

  /**
   * 🎨 COLOR SEMANTIC TOKENS
   * Семантические названия цветов для разных контекстов
   */
  color: {
    // Основные акценты
    primary: 'peach',        // orange - еда, действия
    success: 'mint',         // green - успех
    premium: 'lavender',     // purple - выбранные элементы
    danger: 'coral',         // red - ошибки, срочность
    warning: 'butter',       // yellow - предупреждения
    
    // Нейтральные
    neutral: 'gray',
    muted: 'gray-400',
  },
} as const;

/**
 * 🎨 SEMANTIC COLORS - Унифицированная цветовая система
 * Заменяет разрозненные green-500, amber-500, red-500 на semantic naming
 */
export const SEMANTIC_COLORS = {
  /**
   * ✅ SUCCESS - Успешные операции, подтверждения, оплаты
   * Психология: Деньги, "всё в порядке", успокаивает
   */
  success: {
    light: 'mint-500',       // #5CAE87 - light mode default
    dark: 'mint-300',        // #9ED6B9 - dark mode default
    bg: 'mint-50',           // Light backgrounds
    bgAlpha: 'mint-500/10',  // Semi-transparent backgrounds
    border: 'mint-500/30',   // Borders
    hover: 'mint-600',       // Hover states
    text: 'mint-700',        // Dark text on light bg
    textDark: 'mint-300',    // Light text on dark bg
  },
  
  /**
   * ⏳ WARNING - Ожидание, pending states, требует внимания
   * Психология: Внимание без тревоги, заметный но не стрессовый
   */
  warning: {
    light: 'butter-500',     // #FFBF1F - light mode default
    dark: 'butter-300',      // #FFD966 - dark mode default
    bg: 'butter-50',
    bgAlpha: 'butter-500/10',
    border: 'butter-500/30',
    hover: 'butter-600',
    text: 'butter-700',
    textDark: 'butter-300',
  },
  
  /**
   * ❌ ERROR / DANGER - Ошибки, долги, срочные действия
   * Психология: Срочность, активирует симпатическую нервную систему
   */
  error: {
    light: 'coral-500',      // #FF5A4A - light mode default
    dark: 'coral-300',       // #FF9B92 - dark mode default
    bg: 'coral-50',
    bgAlpha: 'coral-500/10',
    border: 'coral-500/30',
    hover: 'coral-600',
    text: 'coral-700',
    textDark: 'coral-300',
  },
  
  /**
   * ℹ️ INFO - Информационные блоки, подсказки, premium features
   * Психология: Нейтрально-позитивный, premium feel
   */
  info: {
    light: 'lavender-500',   // #8B5CF6 - light mode default
    dark: 'lavender-300',    // #C4B5FD - dark mode default
    bg: 'lavender-50',
    bgAlpha: 'lavender-500/10',
    border: 'lavender-500/30',
    hover: 'lavender-600',
    text: 'lavender-700',
    textDark: 'lavender-300',
  },
  
  /**
   * 🎨 PRIMARY - Основные действия, кнопки CTA, акценты
   * Психология: Еда, энергия, активность
   */
  primary: {
    light: 'peach-500',      // #FF7851 - light mode default
    dark: 'peach-300',       // #FFB38F - dark mode default
    bg: 'peach-50',
    bgAlpha: 'peach-500/10',
    border: 'peach-500/30',
    hover: 'peach-600',
    text: 'peach-700',
    textDark: 'peach-300',
  },
  
  /**
   * ⚪ NEUTRAL - Нейтральные элементы, defaults
   */
  neutral: {
    light: 'muted',
    dark: 'muted-foreground',
    bg: 'muted/50',
    border: 'border',
    hover: 'muted/70',
    text: 'muted-foreground',
  },
} as const;

/**
 * 🔧 DESIGN_TOKENS_EXTENDED - Дополнительные токены
 */
export const DESIGN_TOKENS_EXTENDED = {
  /**
   * 🎯 Z-INDEX - Слои наложения
   */
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    overlay: 30,
    modal: 40,
    popover: 50,
    toast: 60,
    tooltip: 70,
  },

  /**
   * 📱 BREAKPOINTS - Responsive Design
   */
  breakpoint: {
    sm: '640px',       // mobile landscape
    md: '768px',       // tablet
    lg: '1024px',      // desktop
    xl: '1280px',      // large desktop
  },

  /**
   * 🃏 CARD VARIANTS - Стандартные padding + radius для карточек
   */
  card: {
    compact: {
      padding: '0.75rem',    // 12px
      radius: '0.5rem',      // 8px
    },
    default: {
      padding: '1rem',       // 16px
      radius: '0.75rem',     // 12px
    },
    comfortable: {
      padding: '1.5rem',     // 24px
      radius: '0.75rem',     // 12px
    },
    spacious: {
      padding: '2rem',       // 32px
      radius: '1rem',        // 16px
    },
  },
} as const;

/**
 * 🎨 GRADIENT PRESETS
 * Стандартизированные градиенты для всего приложения
 */
export const GRADIENTS = {
  // Основные градиенты (135deg для визуальной динамики)
  peach: 'linear-gradient(135deg, #FF7851 0%, #FF9870 100%)',
  peachDark: 'linear-gradient(135deg, #FFB38F 0%, #FFCCAD 100%)',
  
  mint: 'linear-gradient(135deg, #5CAE87 0%, #7BC4A3 100%)',
  mintDark: 'linear-gradient(135deg, #9ED6B9 0%, #BBF7D1 100%)',
  
  lavender: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
  lavenderDark: 'linear-gradient(135deg, #C4B5FD 0%, #DDD6FE 100%)',
  
  coral: 'linear-gradient(135deg, #FF5A4A 0%, #FF7B6E 100%)',
  coralDark: 'linear-gradient(135deg, #FF9B92 0%, #FFC9C3 100%)',
  
  butter: 'linear-gradient(135deg, #FFBF1F 0%, #FFCC42 100%)',
  butterDark: 'linear-gradient(135deg, #FFD966 0%, #FFE68A 100%)',
  
  // Нейтральные градиенты для карточек
  cardLight: 'linear-gradient(135deg, #FFFFFF 0%, #F9FAFB 100%)',
  cardDark: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
  
  // Мягкие фоновые градиенты
  backgroundLight: 'linear-gradient(180deg, #FAFAFA 0%, #FFFFFF 100%)',
  backgroundDark: 'linear-gradient(180deg, #09090B 0%, #18181B 100%)',
} as const;

/**
 * 🎯 TYPE HELPERS
 */
export type SpacingKey = keyof typeof DESIGN_TOKENS.spacing;
export type RadiusKey = keyof typeof DESIGN_TOKENS.radius;
export type IconSizeKey = keyof typeof DESIGN_TOKENS.iconSize;
export type IconSizeClass = keyof typeof ICON_SIZES;
export type ShadowKey = keyof typeof DESIGN_TOKENS.shadow;
export type AnimationKey = keyof typeof DESIGN_TOKENS.animation;
export type FontSizeKey = keyof typeof DESIGN_TOKENS.fontSize;
export type CardVariant = keyof typeof DESIGN_TOKENS_EXTENDED.card;
export type GradientKey = keyof typeof GRADIENTS;

/**
 * 🔧 UTILITY FUNCTIONS
 */

/**
 * Получить значение spacing по ключу
 */
export const getSpacing = (key: SpacingKey): string => {
  return DESIGN_TOKENS.spacing[key];
};

/**
 * Получить значение radius по ключу
 */
export const getRadius = (key: RadiusKey): string => {
  return DESIGN_TOKENS.radius[key];
};

/**
 * Получить градиент по ключу
 */
export const getGradient = (key: GradientKey): string => {
  return GRADIENTS[key];
};

/**
 * Создать CSS переменную для градиента
 */
export const gradientToCss = (gradient: string): React.CSSProperties => {
  return { backgroundImage: gradient };
};

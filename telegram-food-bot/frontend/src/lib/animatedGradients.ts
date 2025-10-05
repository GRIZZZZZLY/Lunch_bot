import { TimeOfDay } from '@/hooks/useTimeBasedGradient';

/**
 * Варианты анимированных градиентов
 */
export type GradientVariant = 'diagonal' | 'radial' | 'wave' | 'mesh' | 'aurora';

/**
 * Скорость анимации
 */
export type AnimationSpeed = 'slow' | 'medium' | 'fast';

/**
 * Интенсивность градиента
 */
export type IntensityLevel = 'subtle' | 'medium' | 'vibrant';

/**
 * Конфигурация цветов для градиента
 */
export interface GradientColors {
  primary: string[];
  secondary?: string[];
  accent?: string[];
}

/**
 * Параметры анимированного градиента
 */
export interface AnimatedGradientConfig {
  variant: GradientVariant;
  speed: AnimationSpeed;
  intensity: IntensityLevel;
  timeOfDay?: TimeOfDay | 'auto';
  theme?: 'light' | 'dark' | 'auto';
  overlay?: boolean;
  colors?: GradientColors;
}

/**
 * Длительность анимации в секундах для каждой скорости
 */
export const ANIMATION_DURATIONS: Record<AnimationSpeed, number> = {
  slow: 35,
  medium: 18,
  fast: 10,
};

/**
 * Tailwind классы анимации для каждого варианта
 */
export const ANIMATION_CLASSES: Record<GradientVariant, string> = {
  diagonal: 'animate-gradient-xy',
  radial: 'animate-gradient-radial',
  wave: 'animate-gradient-wave',
  mesh: 'animate-gradient-mesh',
  aurora: 'animate-gradient-aurora',
};

/**
 * Настройки opacity для каждого уровня интенсивности
 */
export const INTENSITY_OPACITY: Record<IntensityLevel, number> = {
  subtle: 0.7,
  medium: 0.8,
  vibrant: 1.0,
};

/**
 * Настройки blur для каждого уровня интенсивности
 */
export const INTENSITY_BLUR: Record<IntensityLevel, number> = {
  subtle: 60,
  medium: 40,
  vibrant: 20,
};

/**
 * Цветовые палитры для каждого времени суток (light theme)
 */
export const TIME_OF_DAY_COLORS_LIGHT: Record<TimeOfDay, GradientColors> = {
  morning: {
    primary: [
      'rgba(255, 247, 237, 0.6)', // primary-food-50
      'rgba(255, 237, 213, 0.8)', // primary-food-100
      'rgba(254, 215, 170, 0.7)', // primary-food-200
      'rgba(253, 186, 116, 0.6)', // primary-food-300
    ],
    secondary: [
      'rgba(251, 146, 60, 0.5)',  // primary-food-400
      'rgba(249, 115, 22, 0.4)',  // primary-food-500
    ],
  },
  afternoon: {
    primary: [
      'rgba(251, 146, 60, 0.5)',  // primary-food-400
      'rgba(249, 115, 22, 0.6)',  // primary-food-500
      'rgba(234, 88, 12, 0.5)',   // primary-food-600
    ],
    secondary: [
      'rgba(253, 186, 116, 0.4)', // primary-food-300
      'rgba(194, 65, 12, 0.4)',   // primary-food-700
    ],
  },
  evening: {
    primary: [
      'rgba(194, 65, 12, 0.4)',   // primary-food-700
      'rgba(154, 52, 18, 0.5)',   // primary-food-800
      'rgba(124, 45, 18, 0.4)',   // primary-food-900
    ],
    secondary: [
      'rgba(234, 88, 12, 0.4)',   // primary-food-600
      'rgba(249, 115, 22, 0.3)',  // primary-food-500
    ],
  },
  night: {
    primary: [
      'rgba(124, 45, 18, 0.3)',   // primary-food-900
      'rgba(154, 52, 18, 0.4)',   // primary-food-800
      'rgba(194, 65, 12, 0.3)',   // primary-food-700
    ],
    secondary: [
      'rgba(234, 88, 12, 0.25)',  // primary-food-600
      'rgba(154, 52, 18, 0.3)',   // primary-food-800
    ],
  },
};

/**
 * Цветовые палитры для каждого времени суток (dark theme)
 */
export const TIME_OF_DAY_COLORS_DARK: Record<TimeOfDay, GradientColors> = {
  morning: {
    primary: [
      'rgba(255, 237, 213, 0.08)', // primary-food-100
      'rgba(254, 215, 170, 0.12)', // primary-food-200
      'rgba(253, 186, 116, 0.1)',  // primary-food-300
      'rgba(251, 146, 60, 0.08)',  // primary-food-400
    ],
    secondary: [
      'rgba(249, 115, 22, 0.06)',  // primary-food-500
      'rgba(234, 88, 12, 0.05)',   // primary-food-600
    ],
  },
  afternoon: {
    primary: [
      'rgba(251, 146, 60, 0.1)',   // primary-food-400
      'rgba(249, 115, 22, 0.12)',  // primary-food-500
      'rgba(234, 88, 12, 0.1)',    // primary-food-600
    ],
    secondary: [
      'rgba(253, 186, 116, 0.06)', // primary-food-300
      'rgba(194, 65, 12, 0.08)',   // primary-food-700
    ],
  },
  evening: {
    primary: [
      'rgba(194, 65, 12, 0.1)',    // primary-food-700
      'rgba(154, 52, 18, 0.12)',   // primary-food-800
      'rgba(124, 45, 18, 0.1)',    // primary-food-900
    ],
    secondary: [
      'rgba(234, 88, 12, 0.08)',   // primary-food-600
      'rgba(249, 115, 22, 0.06)',  // primary-food-500
    ],
  },
  night: {
    primary: [
      'rgba(124, 45, 18, 0.08)',   // primary-food-900
      'rgba(154, 52, 18, 0.1)',    // primary-food-800
      'rgba(194, 65, 12, 0.08)',   // primary-food-700
    ],
    secondary: [
      'rgba(234, 88, 12, 0.05)',   // primary-food-600
      'rgba(154, 52, 18, 0.07)',   // primary-food-800
    ],
  },
};

/**
 * Получить цветовую палитру для времени суток и темы
 */
export function getTimeOfDayColors(
  timeOfDay: TimeOfDay,
  isDark: boolean
): GradientColors {
  return isDark 
    ? TIME_OF_DAY_COLORS_DARK[timeOfDay]
    : TIME_OF_DAY_COLORS_LIGHT[timeOfDay];
}

/**
 * Генерация CSS градиента для diagonal варианта
 */
export function generateDiagonalGradient(colors: string[]): string {
  const colorStops = colors
    .map((color, index) => {
      const position = (index / (colors.length - 1)) * 100;
      return `${color} ${position}%`;
    })
    .join(', ');
  
  return `linear-gradient(135deg, ${colorStops})`;
}

/**
 * Генерация CSS градиента для radial варианта
 */
export function generateRadialGradient(colors: string[]): string {
  const colorStops = colors
    .map((color, index) => {
      const position = (index / (colors.length - 1)) * 100;
      return `${color} ${position}%`;
    })
    .join(', ');
  
  return `radial-gradient(circle at center, ${colorStops})`;
}

/**
 * Генерация CSS градиента для wave варианта
 */
export function generateWaveGradient(colors: string[]): string {
  const colorStops = colors
    .map((color, index) => {
      const position = (index / (colors.length - 1)) * 100;
      return `${color} ${position}%`;
    })
    .join(', ');
  
  return `linear-gradient(90deg, ${colorStops})`;
}

/**
 * Генерация CSS градиента для mesh варианта
 */
export function generateMeshGradient(colors: GradientColors): string {
  const { primary, secondary = [], accent = [] } = colors;
  
  const gradients: string[] = [];
  
  // Радиальные градиенты по углам
  if (primary[0]) {
    gradients.push(`radial-gradient(at 0% 0%, ${primary[0]} 0%, transparent 50%)`);
  }
  if (primary[1] || secondary[0]) {
    gradients.push(`radial-gradient(at 100% 0%, ${primary[1] || secondary[0]} 0%, transparent 50%)`);
  }
  if (primary[2] || secondary[1]) {
    gradients.push(`radial-gradient(at 100% 100%, ${primary[2] || secondary[1]} 0%, transparent 50%)`);
  }
  if (primary[3] || accent[0]) {
    gradients.push(`radial-gradient(at 0% 100%, ${primary[3] || accent[0]} 0%, transparent 50%)`);
  }
  
  return gradients.join(', ');
}

/**
 * Генерация CSS градиента для aurora варианта
 */
export function generateAuroraGradient(colors: string[]): string {
  const colorStops = colors
    .map((color, index) => {
      const position = (index / (colors.length - 1)) * 100;
      return `${color} ${position}%`;
    })
    .join(', ');
  
  return `radial-gradient(ellipse at top, ${colorStops})`;
}

/**
 * Получить CSS градиент в зависимости от варианта
 */
export function getGradientByVariant(
  variant: GradientVariant,
  colors: GradientColors
): string {
  switch (variant) {
    case 'diagonal':
      return generateDiagonalGradient(colors.primary);
    case 'radial':
      return generateRadialGradient(colors.primary);
    case 'wave':
      return generateWaveGradient(colors.primary);
    case 'mesh':
      return generateMeshGradient(colors);
    case 'aurora':
      return generateAuroraGradient(colors.primary);
    default:
      return generateDiagonalGradient(colors.primary);
  }
}

/**
 * Получить класс размера background для варианта
 */
export function getBackgroundSize(variant: GradientVariant): string {
  switch (variant) {
    case 'diagonal':
    case 'radial':
      return '200% 200%';
    case 'wave':
      return '400% 100%';
    case 'mesh':
    case 'aurora':
      return '300% 300%';
    default:
      return '200% 200%';
  }
}

/**
 * Получить стили для анимированного градиента
 */
export function getAnimatedGradientStyles(config: AnimatedGradientConfig): React.CSSProperties {
  const {
    variant,
    speed,
    intensity,
  } = config;
  
  const duration = ANIMATION_DURATIONS[speed];
  const opacity = INTENSITY_OPACITY[intensity];
  const blur = INTENSITY_BLUR[intensity];
  const backgroundSize = getBackgroundSize(variant);
  
  const styles: React.CSSProperties = {
    opacity,
    backgroundSize,
    animationDuration: `${duration}s`,
  };
  
  // Aurora эффект использует blur
  if (variant === 'aurora') {
    styles.filter = `blur(${blur}px)`;
  }
  
  return styles;
}

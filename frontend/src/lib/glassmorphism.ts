/**
 * Glassmorphism утилиты для создания премиального glass эффекта
 * Все стили WCAG AA compliant
 */

export type GlassVariant = "light" | "medium" | "heavy" | "ultra";
export type GlassTheme = "light" | "dark";

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
    blur: "12px", // Увеличено с 10px для лучшей читаемости
    light: {
      background: "rgba(255, 255, 255, 0.75)", // Увеличено с 0.65 для лучшего контраста
      border: "rgba(255, 255, 255, 0.35)",
      shadow: "rgba(0, 0, 0, 0.12)",
    },
    dark: {
      background: "rgba(35, 46, 60, 0.75)", // Увеличено с 0.65
      border: "rgba(255, 255, 255, 0.12)",
      shadow: "rgba(0, 0, 0, 0.35)",
    },
  },
  medium: {
    blur: "16px", // Увеличено с 14px для WCAG AA соответствия
    light: {
      background: "rgba(255, 255, 255, 0.85)", // Увеличено с 0.75 для контраста 4.5:1
      border: "rgba(255, 255, 255, 0.4)",
      shadow: "rgba(0, 0, 0, 0.15)",
    },
    dark: {
      background: "rgba(35, 46, 60, 0.85)", // Увеличено с 0.75
      border: "rgba(255, 255, 255, 0.15)",
      shadow: "rgba(0, 0, 0, 0.4)",
    },
  },
  heavy: {
    blur: "20px", // Увеличено с 16px
    light: {
      background: "rgba(255, 255, 255, 0.9)", // Увеличено с 0.8
      border: "rgba(255, 255, 255, 0.4)",
      shadow: "rgba(0, 0, 0, 0.15)",
    },
    dark: {
      background: "rgba(35, 46, 60, 0.9)", // Увеличено с 0.8
      border: "rgba(255, 255, 255, 0.15)",
      shadow: "rgba(0, 0, 0, 0.4)",
    },
  },
  ultra: {
    blur: "24px",
    light: {
      background: "rgba(255, 255, 255, 0.95)",
      border: "rgba(255, 255, 255, 0.4)",
      shadow: "rgba(0, 0, 0, 0.2)",
    },
    dark: {
      background: "rgba(41, 55, 75, 0.95)", // Оптимизированный slate-800 custom
      border: "rgba(226, 232, 240, 0.2)", // slate-200 с прозрачностью
      shadow: "rgba(0, 0, 0, 0.6)", // Более глубокая тень
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
  variant: GlassVariant = "medium",
  theme: GlassTheme = "light",
  saturate: boolean = false,
): GlassStyles {
  const config = GLASS_CONFIGS[variant];
  const colors = config[theme];

  const backdropFilter = saturate
    ? `blur(${config.blur}) saturate(180%)`
    : `blur(${config.blur})`;

  // Оптимизированные стили для dark theme
  if (theme === "dark") {
    const darkBackgrounds: Record<GlassVariant, string> = {
      light: "rgba(51, 65, 85, 0.5)", // slate-700 с прозрачностью
      medium: "rgba(51, 65, 85, 0.7)", // slate-700 более плотный
      heavy: "rgba(41, 55, 75, 0.85)", // custom slate между 800-700
      ultra: "rgba(30, 41, 59, 0.95)", // slate-800 почти непрозрачный
    };

    const darkBorders: Record<GlassVariant, string> = {
      light: "rgba(226, 232, 240, 0.08)", // slate-200
      medium: "rgba(226, 232, 240, 0.12)",
      heavy: "rgba(226, 232, 240, 0.15)",
      ultra: "rgba(226, 232, 240, 0.2)",
    };

    const darkShadows: Record<GlassVariant, string> = {
      light: "rgba(0, 0, 0, 0.3)",
      medium: "rgba(0, 0, 0, 0.4)",
      heavy: "rgba(0, 0, 0, 0.5)",
      ultra: "rgba(0, 0, 0, 0.6)",
    };

    return {
      backdropFilter: `blur(${config.blur}) saturate(180%)`,
      background: darkBackgrounds[variant],
      border: `1px solid ${darkBorders[variant]}`,
      boxShadow: `0 8px 32px ${darkShadows[variant]}, inset 0 1px 0 0 rgba(255, 255, 255, ${variant === "light" ? "0.05" : variant === "medium" ? "0.08" : "0.1"})`,
    };
  }

  return {
    backdropFilter,
    background: colors.background,
    border: `1px solid ${colors.border}`,
    boxShadow: `0 8px 32px ${colors.shadow}`,
  };
}

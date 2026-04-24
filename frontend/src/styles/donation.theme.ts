/**
 * Design tokens для компонентов поддержки проекта
 * Премиум темная тема с легким фиолетовым свечением
 */

export const DONATION_THEME = {
  colors: {
    primary: '#8B5CF6',
    primaryLight: '#C4B5FD',
    primaryDark: '#6D28D9',
    accent: '#D86A2C',
    shadow: 'rgba(139, 92, 246, 0.12)',
    shadowLight: 'rgba(216, 106, 44, 0.10)',
    shadowDark: 'rgba(109, 40, 217, 0.20)',
    text: '#F5F7FA',
    textSecondary: '#D7DCE2',
    glow: 'rgba(167, 139, 250, 0.16)',
    darkBase: '#1F2A36',
    darkDeep: '#17212B',
  },
  
  gradients: {
    // Dark theme - фиолетово-лавандовый градиент (без "белого" хвоста справа)
    bar: `linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)`,
    button: `linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)`,
    buttonHover: `linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)`,
    shine: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.18), transparent)',
    modalHeader: `linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)`,
  },

  // Light theme - оранжево-красный градиент
  gradientsLight: {
    bar: `linear-gradient(135deg, #FB923C 0%, #F97316 50%, #EF4444 100%)`,
    button: `linear-gradient(135deg, #FB923C 0%, #F97316 50%, #EF4444 100%)`,
    buttonHover: `linear-gradient(135deg, #F97316 0%, #EF4444 50%, #DC2626 100%)`,
    shine: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.24), transparent)',
    modalHeader: `linear-gradient(135deg, #FB923C 0%, #F97316 50%, #EF4444 100%)`,
  },
  
  animation: {
    pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    shine: 'shine 3s linear infinite',
    glow: 'glow 2s ease-in-out infinite',
    float: 'float 3s ease-in-out infinite',
  },
  
  spacing: {
    barBottom: '96px', // bottom-24 (6rem)
    barPadding: '16px', // p-4
    buttonPadding: '20px', // p-5
    iconSize: {
      small: 18,
      medium: 22,
      large: 28, // уменьшено с 32
      xlarge: 40, // уменьшено с 48
    },
  },
  
  shadow: {
    // Dark theme - purple glow
    bar: `
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      0 8px 20px rgba(139, 92, 246, 0.35)
    `,
    barHover: `
      inset 0 1px 0 rgba(255, 255, 255, 0.24),
      0 12px 28px rgba(139, 92, 246, 0.45)
    `,
    button: `
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      0 10px 24px rgba(139, 92, 246, 0.35)
    `,
    buttonHover: `
      inset 0 1px 0 rgba(255, 255, 255, 0.24),
      0 14px 32px rgba(139, 92, 246, 0.45)
    `,
    glow: '0 0 24px rgba(167, 139, 250, 0.5)',
  },

  // Light theme - orange/red glow
  shadowLight: {
    bar: `
      inset 0 1px 0 rgba(255, 255, 255, 0.24),
      0 8px 20px rgba(249, 115, 22, 0.38)
    `,
    barHover: `
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 12px 28px rgba(239, 68, 68, 0.45)
    `,
    button: `
      inset 0 1px 0 rgba(255, 255, 255, 0.24),
      0 10px 24px rgba(249, 115, 22, 0.38)
    `,
    buttonHover: `
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 14px 32px rgba(239, 68, 68, 0.48)
    `,
    glow: '0 0 24px rgba(251, 146, 60, 0.55)',
  },

  border: {
    default: 'none',
    hover: 'none',
  },

  borderLight: {
    default: '1.5px solid rgba(255, 255, 255, 0.3)',
    hover: '1.5px solid rgba(255, 255, 255, 0.48)',
  },
  
  borderRadius: {
    bar: '16px', // rounded-2xl
    button: '16px', // rounded-2xl
    icon: '12px', // rounded-xl
  },
  
  timing: {
    firstShowDelay: 45 * 1000, // 45 секунд
    showInterval: 10 * 60 * 1000, // 10 минут
    autoHideTimeout: 15 * 1000, // 15 секунд
    dismissDuration: 48 * 60 * 60 * 1000, // 48 часов
    swipeThreshold: 100, // px
  },
} as const;

export type DonationTheme = typeof DONATION_THEME;

/**
 * Возвращает варианты стилей (градиенты/тени/границы) для нужной темы.
 * Dark - фиолетово-лавандовый, Light - оранжево-красный.
 */
export const getDonationStyles = (isDark: boolean) => ({
  gradients: isDark ? DONATION_THEME.gradients : DONATION_THEME.gradientsLight,
  shadow: isDark ? DONATION_THEME.shadow : DONATION_THEME.shadowLight,
  border: isDark ? DONATION_THEME.border : DONATION_THEME.borderLight,
});

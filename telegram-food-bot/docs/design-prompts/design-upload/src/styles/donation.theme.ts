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
    // Темная основа + легкое фиолетовое свечение
    bar: `
      linear-gradient(135deg, 
        rgba(139, 92, 246, 0.16) 0%, 
        rgba(216, 106, 44, 0.08) 100%
      ),
      linear-gradient(135deg, #1F2A36 0%, #17212B 100%)
    `,
    button: `
      linear-gradient(135deg, 
        rgba(139, 92, 246, 0.18) 0%, 
        rgba(216, 106, 44, 0.10) 100%
      ),
      linear-gradient(135deg, #1F2A36 0%, #17212B 100%)
    `,
    buttonHover: `
      linear-gradient(135deg, 
        rgba(139, 92, 246, 0.24) 0%, 
        rgba(216, 106, 44, 0.12) 100%
      ),
      linear-gradient(135deg, #1F2A36 0%, #17212B 100%)
    `,
    shine: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.08), transparent)',
    modalHeader: `
       linear-gradient(135deg, 
         rgba(139, 92, 246, 0.22) 0%, 
         rgba(216, 106, 44, 0.10) 100%
       ),
       linear-gradient(135deg, #1F2A36 0%, #17212B 100%)
     `,
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
    // Комбо: внутреннее свечение + внешняя тень
    bar: `
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 4px 12px rgba(139, 92, 246, 0.12)
    `,
    barHover: `
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 8px 20px rgba(139, 92, 246, 0.18)
    `,
    button: `
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 8px 16px rgba(139, 92, 246, 0.14)
    `,
    buttonHover: `
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 12px 24px rgba(139, 92, 246, 0.18)
    `,
    glow: '0 0 20px rgba(167, 139, 250, 0.18)',
  },
  
  border: {
    default: '1.5px solid rgba(167, 139, 250, 0.28)',
    hover: '1.5px solid rgba(167, 139, 250, 0.4)',
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

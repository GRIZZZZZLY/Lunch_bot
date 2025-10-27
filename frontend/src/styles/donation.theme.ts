/**
 * Design tokens для компонентов поддержки проекта
 * Премиум темная тема с легким фиолетовым свечением
 */

export const DONATION_THEME = {
  colors: {
    primary: '#7C3AED', // Purple 600 - глубокий пурпурный
    primaryLight: '#A78BFA', // Purple 400 - средний
    primaryDark: '#6D28D9', // Purple 700 - темный
    accent: '#8B5CF6', // Purple 500 - акцент
    shadow: 'rgba(124, 58, 237, 0.15)', // Легкая пурпурная тень
    shadowLight: 'rgba(124, 58, 237, 0.1)',
    shadowDark: 'rgba(109, 40, 217, 0.25)',
    text: '#E5E7EB', // Gray 200 - мягкий белый (не слепит!)
    textSecondary: '#D1D5DB', // Gray 300 - приглушенный текст
    glow: 'rgba(167, 139, 250, 0.2)', // Еле заметное свечение
    // Темные фоновые цвета
    darkBase: '#1F2937', // Gray 800 - основа
    darkDeep: '#111827', // Gray 900 - глубокий
  },
  
  gradients: {
    // Темная основа + легкое фиолетовое свечение
    bar: `
      linear-gradient(135deg, 
        rgba(124, 58, 237, 0.25) 0%, 
        rgba(109, 40, 217, 0.15) 100%
      ),
      linear-gradient(135deg, #1F2937 0%, #111827 100%)
    `,
    button: `
      linear-gradient(135deg, 
        rgba(124, 58, 237, 0.25) 0%, 
        rgba(109, 40, 217, 0.15) 100%
      ),
      linear-gradient(135deg, #1F2937 0%, #111827 100%)
    `,
    buttonHover: `
      linear-gradient(135deg, 
        rgba(139, 92, 246, 0.3) 0%, 
        rgba(124, 58, 237, 0.2) 100%
      ),
      linear-gradient(135deg, #1F2937 0%, #111827 100%)
    `,
    shine: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.08), transparent)',
    modalHeader: `
      linear-gradient(135deg, 
        rgba(124, 58, 237, 0.3) 0%, 
        rgba(109, 40, 217, 0.2) 100%
      ),
      linear-gradient(135deg, #1F2937 0%, #111827 100%)
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
      0 4px 12px rgba(124, 58, 237, 0.15)
    `,
    barHover: `
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 8px 20px rgba(124, 58, 237, 0.2)
    `,
    button: `
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 8px 16px rgba(124, 58, 237, 0.15)
    `,
    buttonHover: `
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 12px 24px rgba(124, 58, 237, 0.2)
    `,
    glow: '0 0 20px rgba(167, 139, 250, 0.25)',
  },
  
  border: {
    default: '1.5px solid rgba(167, 139, 250, 0.35)',
    hover: '1.5px solid rgba(167, 139, 250, 0.5)',
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

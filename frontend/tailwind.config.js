/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Telegram цвета
        'tg-bg': 'var(--tg-color-bg)',
        'tg-text': 'var(--tg-color-text)',
        'tg-hint': 'var(--tg-color-hint)',
        'tg-link': 'var(--tg-color-link)',
        'tg-button': 'var(--tg-color-button)',
        'tg-button-text': 'var(--tg-color-button-text)',
        'tg-secondary-bg': 'var(--tg-color-secondary-bg)',
        
        // Кастомные цвета для темы
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Food Premium Palette
        'primary-food': {
          50: '#FFF7ED',   // Lightest cream
          100: '#FFEDD5',  // Light peach
          200: '#FED7AA',  // Soft peach
          300: '#FDBA74',  // Warm peach
          400: '#FB923C',  // Vibrant orange
          500: '#F97316',  // Primary orange [MAIN]
          600: '#EA580C',  // Deep orange
          700: '#C2410C',  // TEXT PRIMARY (WCAG AA)
          800: '#9A3412',  // TEXT BOLD (WCAG AAA)
          900: '#7C2D12',  // Darkest orange
        },
        // Pastel Bluegray (голубовато-серые виджеты для dark mode)
        'bluegray': {
          50: '#F0F4F8',   // Lightest tint
          100: '#D9E2EC',  // Subtle backgrounds
          200: '#BCCCDC',  // Widget borders
          300: '#9FB3C8',  // PRIMARY widget BG (6.8:1 contrast)
          400: '#829AB1',  // Hover state
          500: '#627D98',  // Active widget
          600: '#486581',  // Dark variant
          700: '#334E68',  // Text on light
          800: '#243B53',  // Deep backgrounds
          900: '#102A43',  // Darkest
        },
        // Pastel Lavender (нежно-лиловые акценты для dark mode)
        'lavender': {
          50: '#F5F3FF',   // Lightest tint
          100: '#EDE9FE',  // Subtle backgrounds
          200: '#DDD6FE',  // Widget borders
          300: '#C4B5FD',  // SECONDARY widget BG (7.2:1 contrast)
          400: '#A78BFA',  // Hover state
          500: '#8B5CF6',  // Active widget
          600: '#7C3AED',  // Dark variant
          700: '#6D28D9',  // Text on light
          800: '#5B21B6',  // Deep backgrounds
          900: '#4C1D95',  // Darkest
        },
        // Desaturated Peach (приглушенный оранжевый для dark mode)
        'peach': {
          50: '#FBF5F0',   // Lightest
          100: '#F5EBE1',  // Subtle
          200: '#E6D4BF',  // Light
          300: '#D4A574',  // PRIMARY desaturated (6.1:1 contrast)
          400: '#C78A5C',  // Hover
          500: '#B97447',  // Active
          600: '#A05E35',  // Dark
          700: '#824A28',  // Text
          800: '#63381D',  // Deep
          900: '#462814',  // Darkest
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Desaturated Success (приглушенный зеленый для dark mode)
        'success-soft': {
          200: '#C5E6D5',  // Light background
          300: '#9FD4B3',  // PRIMARY (7.5:1 contrast)
          400: '#6BA882',  // Hover
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Desaturated Warning (приглушенный желтый для dark mode)
        'warning-soft': {
          200: '#E6DEBA',  // Light background
          300: '#D9D394',  // PRIMARY (8.1:1 contrast)
          400: '#C5A66D',  // Hover
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Desaturated Error (приглушенный красный для dark mode)
        'error-soft': {
          200: '#E6C5C5',  // Light background
          300: '#D4A5A5',  // PRIMARY (6.9:1 contrast)
          400: '#B87171',  // Hover
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'bounce-light': 'bounceLight 0.6s ease-in-out',
        'skeleton-wave': 'skeletonWave 1.5s ease-in-out infinite',
        'scale-in': 'scaleIn 0.2s ease-out',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        // Animated Gradient Animations
        'gradient-x': 'gradient-x 15s ease infinite',
        'gradient-y': 'gradient-y 15s ease infinite',
        'gradient-xy': 'gradient-xy 20s ease infinite',
        'gradient-radial': 'gradient-radial 20s ease infinite',
        'gradient-wave': 'gradient-wave 25s ease-in-out infinite',
        'gradient-mesh': 'gradient-mesh 30s ease infinite',
        'gradient-aurora': 'gradient-aurora 40s ease infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { 
            opacity: '0',
            transform: 'translateY(20px)'
          },
          '100%': { 
            opacity: '1',
            transform: 'translateY(0)'
          },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceLight: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        skeletonWave: {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-3deg)' },
          '75%': { transform: 'rotate(3deg)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        // Animated Gradient Keyframes
        'gradient-x': {
          '0%, 100%': { 
            'background-position': '0% 50%',
          },
          '50%': { 
            'background-position': '100% 50%',
          },
        },
        'gradient-y': {
          '0%, 100%': { 
            'background-position': '50% 0%',
          },
          '50%': { 
            'background-position': '50% 100%',
          },
        },
        'gradient-xy': {
          '0%, 100%': { 
            'background-position': '0% 0%',
          },
          '25%': { 
            'background-position': '100% 0%',
          },
          '50%': { 
            'background-position': '100% 100%',
          },
          '75%': { 
            'background-position': '0% 100%',
          },
        },
        'gradient-radial': {
          '0%, 100%': { 
            'background-position': 'center center',
            'background-size': '100% 100%',
          },
          '50%': { 
            'background-position': 'center center',
            'background-size': '200% 200%',
          },
        },
        'gradient-wave': {
          '0%, 100%': { 
            'background-position': '0% 50%',
          },
          '33%': { 
            'background-position': '50% 0%',
          },
          '66%': { 
            'background-position': '100% 50%',
          },
        },
        'gradient-mesh': {
          '0%, 100%': { 
            'background-position': '0% 0%, 100% 0%, 100% 100%, 0% 100%',
          },
          '25%': { 
            'background-position': '10% 10%, 90% 10%, 90% 90%, 10% 90%',
          },
          '50%': { 
            'background-position': '20% 20%, 80% 20%, 80% 80%, 20% 80%',
          },
          '75%': { 
            'background-position': '10% 10%, 90% 10%, 90% 90%, 10% 90%',
          },
        },
        'gradient-aurora': {
          '0%, 100%': { 
            'background-position': '50% 0%',
            transform: 'scale(1) rotate(0deg)',
          },
          '33%': { 
            'background-position': '30% 30%',
            transform: 'scale(1.1) rotate(5deg)',
          },
          '66%': { 
            'background-position': '70% 30%',
            transform: 'scale(1.05) rotate(-5deg)',
          },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
  darkMode: 'class',
};

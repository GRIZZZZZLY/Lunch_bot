/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
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
        
        // 🎨 NEW: Modern Color Palette for Dark & Light Themes
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // 🍑 PEACH (Food Primary - Orange)
        peach: {
          50: '#FFF4ED',
          100: '#FFE5D6',
          200: '#FFCCAD',
          300: '#FFB38F',   // Dark mode default
          400: '#FF9870',
          500: '#FF7851',   // Light mode default
          600: '#E85D36',
          700: '#CC4A24',
          800: '#B33812',
          900: '#992600',
          DEFAULT: '#FF7851',
        },
        // 🌿 MINT (Success - Green)
        mint: {
          50: '#F0FDF7',
          100: '#DCFCE8',
          200: '#BBF7D1',
          300: '#9ED6B9',   // Dark mode default
          400: '#7BC4A3',
          500: '#5CAE87',   // Light mode default
          600: '#3D8F67',
          700: '#2A7050',
          800: '#1B5239',
          900: '#0D3422',
          DEFAULT: '#5CAE87',
        },
        // 💜 LAVENDER (Premium - Purple)
        lavender: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',   // Dark mode default
          400: '#A78BFA',
          500: '#8B5CF6',   // Light mode default
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
          DEFAULT: '#8B5CF6',
        },
        // 🔴 CORAL (Energy - Red-Orange)
        coral: {
          50: '#FFF1F0',
          100: '#FFE4E1',
          200: '#FFC9C3',
          300: '#FF9B92',   // Dark mode default
          400: '#FF7B6E',
          500: '#FF5A4A',   // Light mode default
          600: '#E63E2E',
          700: '#CC2A1A',
          800: '#B31606',
          900: '#990200',
          DEFAULT: '#FF5A4A',
        },
        // 🌟 BUTTER (Warning - Yellow)
        butter: {
          50: '#FFFBEB',
          100: '#FFF3C4',
          200: '#FFE68A',
          300: '#FFD966',   // Dark mode default
          400: '#FFCC42',
          500: '#FFBF1F',   // Light mode default
          600: '#E5A800',
          700: '#CC9400',
          800: '#B38000',
          900: '#996C00',
          DEFAULT: '#FFBF1F',
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // 🎨 Оптимизированные радиусы для карточек
        'card': '0.75rem',  // 12px - более сбалансированный вариант
        'card-lg': '1rem',  // 16px - для больших карточек
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
    require('tailwindcss-animate'),
  ],
};

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
        // ========================================
        // 🎨 PASTEL HARMONY PALETTE (5 Core Colors)
        // Requirement: Orange, Purple, Blue, Green, Red
        // ========================================
        
        // 🍑 PASTEL PEACH (Primary - Orange family)
        'pastel-peach': {
          50: '#FFF5F0',   // Lightest background
          100: '#FFE4D6',  // Light background
          200: '#FFCCAD',  // Border/divider
          300: '#FFB899',  // DEFAULT - Main UI color
          400: '#FFA380',  // Hover state
          500: '#FF8F66',  // Active/pressed state
          600: '#E67550',  // Dark accent
          700: '#CC5C3B',  // Darker accent
          800: '#B34427',  // Darkest
          900: '#4D1F12',  // Very dark for dark mode
          950: '#2A1109',  // Ultra dark for dark mode backgrounds
          DEFAULT: '#FFB899',
        },
        
        // 💜 PASTEL LAVENDER (Accent - Purple family)
        'pastel-lavender': {
          50: '#F8F6FF',   // Lightest background
          100: '#EDE9FE',  // Light background
          200: '#DDD6FE',  // Border/divider
          300: '#C4B5FD',  // DEFAULT - Main UI color
          400: '#B19BFC',  // Hover state
          500: '#9E81FA',  // Active/pressed state
          600: '#8B67E8',  // Dark accent
          700: '#7850D6',  // Darker accent
          800: '#6539C4',  // Darkest
          900: '#2D1854',  // Very dark for dark mode
          950: '#1A0E2E',  // Ultra dark for dark mode backgrounds
          DEFAULT: '#C4B5FD',
        },
        
        // 🌊 PASTEL SKY (Info - Blue family)
        'pastel-sky': {
          50: '#F0F9FF',   // Lightest background
          100: '#E0F2FE',  // Light background
          200: '#BAE6FD',  // Border/divider
          300: '#7DD3FC',  // DEFAULT - Main UI color
          400: '#5BC5FA',  // Hover state
          500: '#38B7F8',  // Active/pressed state
          600: '#1FA3E6',  // Dark accent
          700: '#0E8FD4',  // Darker accent
          800: '#037BC2',  // Darkest
          900: '#01334D',  // Very dark for dark mode
          950: '#011D2A',  // Ultra dark for dark mode backgrounds
          DEFAULT: '#7DD3FC',
        },
        
        // 🌿 PASTEL SAGE (Success - Green family)
        'pastel-sage': {
          50: '#F2FCF8',   // Lightest background
          100: '#D9F5E8',  // Light background
          200: '#B3EBD1',  // Border/divider
          300: '#8CE0B9',  // DEFAULT - Main UI color
          400: '#70D6A8',  // Hover state
          500: '#54CC97',  // Active/pressed state
          600: '#3BB882',  // Dark accent
          700: '#28A46D',  // Darker accent
          800: '#1A9058',  // Darkest
          900: '#0D3826',  // Very dark for dark mode
          950: '#072016',  // Ultra dark for dark mode backgrounds
          DEFAULT: '#8CE0B9',
        },
        
        // 🌺 PASTEL ROSE (Error/Warning - Red family)
        'pastel-rose': {
          50: '#FFF5F5',   // Lightest background
          100: '#FEE2E2',  // Light background
          200: '#FECACA',  // Border/divider
          300: '#FCA5A5',  // DEFAULT - Main UI color
          400: '#F87171',  // Hover state
          500: '#EF4444',  // Active/pressed state
          600: '#DC2626',  // Dark accent
          700: '#B91C1C',  // Darker accent
          800: '#991B1B',  // Darkest
          900: '#3D0A0A',  // Very dark for dark mode
          950: '#220606',  // Ultra dark for dark mode backgrounds
          DEFAULT: '#FCA5A5',
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
      // 🎨 PASTEL HARMONY ГРАДИЕНТЫ (5 цветов)
      backgroundImage: {
        // 🍑 Pastel Peach градиенты
        'gradient-pastel-peach': 'linear-gradient(135deg, #FFB899 0%, #FFCCAD 100%)',
        'gradient-pastel-peach-vibrant': 'linear-gradient(135deg, #FF8F66 0%, #FFB899 100%)',
        
        // 💜 Pastel Lavender градиенты
        'gradient-pastel-lavender': 'linear-gradient(135deg, #C4B5FD 0%, #DDD6FE 100%)',
        'gradient-pastel-lavender-vibrant': 'linear-gradient(135deg, #9E81FA 0%, #C4B5FD 100%)',
        
        // 🌊 Pastel Sky градиенты
        'gradient-pastel-sky': 'linear-gradient(135deg, #7DD3FC 0%, #BAE6FD 100%)',
        'gradient-pastel-sky-vibrant': 'linear-gradient(135deg, #38B7F8 0%, #7DD3FC 100%)',
        
        // 🌿 Pastel Sage градиенты
        'gradient-pastel-sage': 'linear-gradient(135deg, #8CE0B9 0%, #B3EBD1 100%)',
        'gradient-pastel-sage-vibrant': 'linear-gradient(135deg, #54CC97 0%, #8CE0B9 100%)',
        
        // 🌺 Pastel Rose градиенты
        'gradient-pastel-rose': 'linear-gradient(135deg, #FCA5A5 0%, #FECACA 100%)',
        'gradient-pastel-rose-vibrant': 'linear-gradient(135deg, #EF4444 0%, #FCA5A5 100%)',
        
        // Нейтральные градиенты для карточек
        'gradient-card-light': 'linear-gradient(135deg, #FFFFFF 0%, #F9FAFB 100%)',
        'gradient-card-dark': 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
        
        // Фоновые градиенты
        'gradient-bg-light': 'linear-gradient(180deg, #FAFAFA 0%, #FFFFFF 100%)',
        'gradient-bg-dark': 'linear-gradient(180deg, #09090B 0%, #18181B 100%)',
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

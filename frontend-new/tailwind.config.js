/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        peach: { 400: '#FF9D66', 500: '#D86A2C', 600: '#B84D12' },
        lavender: { 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED' },
        mint: { 400: '#34D399', 500: '#22B573', 600: '#199863' },
        coral: { 400: '#F87171', 500: '#E55A4F', 600: '#CF463B' },
        butter: { 400: '#F4C15D', 500: '#E6A93D', 600: '#CC932F' },

        'succ-soft': '#9FD4B3',
        'warn-soft': '#D9D394',
        'err-soft': '#D4A5A5',

        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        line: 'var(--line)',
        'line-2': 'var(--line-2)',
        pri: 'var(--pri)',
        'pri-ink': 'var(--pri-ink)',
      },
      fontFamily: {
        sans: ['Onest', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Unbounded', 'Onest', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'grad-peach': 'linear-gradient(135deg, #F3C4A7 0%, #F7D5C1 100%)',
        'grad-lav':   'linear-gradient(135deg, #D1C1FC 0%, #E5DDFE 100%)',
        'grad-sage':  'linear-gradient(135deg, #8CE0B9 0%, #B3EBD1 100%)',
        'grad-sky':   'linear-gradient(135deg, #7DD3FC 0%, #BAE6FD 100%)',
        'grad-rose':  'linear-gradient(135deg, #FCA5A5 0%, #FECACA 100%)',
        'grad-card-dark':  'linear-gradient(180deg, #212329 0%, #1B1D22 100%)',
        'grad-card-light': 'linear-gradient(180deg, #FFFFFF 0%, #F3F5F8 100%)',
        'grad-bg-dark':    'linear-gradient(180deg, #17181C 0%, #111216 100%)',
        'grad-bg-light':   'linear-gradient(180deg, #F7F8FA 0%, #EBEDF1 100%)',
        'btn-primary-dark':  'linear-gradient(135deg, #F6BE5F, #D68914)',
        'btn-primary-light': 'linear-gradient(135deg, #F6BE5F, #D68914)',
      },
      borderRadius: {
        card: '0.75rem',
        'card-lg': '1rem',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elev: 'var(--shadow-elev)',
      },
      backdropBlur: {
        nav: '20px',
      },
    },
  },
  plugins: [],
};

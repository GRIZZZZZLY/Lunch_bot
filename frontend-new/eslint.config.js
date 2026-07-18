import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Легаси-код смешивает компоненты и helpers в одном файле; включим при разборке (фазы 4–6).
      'react-refresh/only-export-components': 'off',
      // Новые строгие правила react-hooks v6 ловят реальные легаси-паттерны
      // (Date.now в useMemo, sync-state-в-effect, Math.random в render).
      // Пока warn: каждый случай чинится в своей фазе миграции (4–6), после чего — error.
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  {
    // Мёртвый код, удаляется в фазе 7 (docs/frontend-redesign/component-audit.md);
    // до удаления не блокирует lint.
    files: [
      'src/components/admin/AdminDashboard.tsx',
      'src/components/stats/**',
      'src/lib/profileMappers.ts',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import storybook from 'eslint-plugin-storybook';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dev-dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      '.lighthouseci/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      ...tseslint.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
    },
    plugins: {
      'react-refresh': reactRefresh,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // `strict` and `noImplicitAny` remain enabled in TypeScript. Explicit
      // `any` is still required at a few untyped SDK and mock boundaries.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      // Some callbacks intentionally preserve Promise-returning public APIs.
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true },
      ],
      // These React Compiler diagnostics require architectural rewrites and
      // are separate from the runtime Hooks invariants checked by Doctor.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-confetti',
              message:
                'Use LazyConfetti from @/components/common/LazyConfetti to keep confetti out of the initial bundle.',
            },
          ],
        },
      ],
    },
  },
  ...storybook.configs['flat/recommended'],
  {
    files: [
      '*.config.ts',
      '.storybook/**/*.ts',
      'tests/**/*.ts',
      'tests/**/*.tsx',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    files: [
      'src/components/common/LazyConfetti.tsx',
      'src/components/polls/ConfettiAnimation.tsx',
      'src/components/budget/SuccessMessageView.tsx',
      'src/components/donation/PaymentSuccess.tsx',
      'src/components/menu/SuggestDishForm.tsx',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);

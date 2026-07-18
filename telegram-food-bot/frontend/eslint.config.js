import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: [
      'dist/**',
      'dev-dist/**',
      'coverage/**',
      'node_modules/**',
      '.storybook/**',
      '**/*.cjs',
      '**/*.config.*',
      '**/*.old.*',
      'src/**/*.stories.*',
    ],
  },
  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/jsx-runtime',
    'prettier',
    'plugin:storybook/recommended'
  ),
  {
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/ban-types': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'warn',
      'react/display-name': 'warn',
      'no-misleading-character-class': 'warn',
      'prefer-const': 'warn',
      'no-var': 'warn',
      'object-shorthand': 'warn',
      'prefer-arrow-callback': 'warn',
      'prefer-template': 'warn',
      // Запрещаем прямые localStorage.setItem/getItem — должны идти через
      // utils/safeLocalStorage с whitelist (защита от кеширования polls,
      // нарушающих CLAUDE.md). Сам safeLocalStorage.ts исключён ниже.
      'no-restricted-syntax': [
        'warn',
        {
          selector: "MemberExpression[object.name='localStorage'][property.name=/^(setItem|getItem)$/]",
          message: 'Use safeLocalStorage from utils/safeLocalStorage instead of direct localStorage access. Polls must NOT be cached (CLAUDE.md).',
        },
      ],
      // P0-5: запрещаем barrel-импорт из react-confetti и (опционально) lucide-react.
      // react-confetti: грузим только через LazyConfetti wrapper, иначе подсасывается
      // в initial bundle.
      // lucide-react: в текущей версии (^0.552) ESM tree-shaking уже работает с
      // обычными импортами из 'lucide-react', поэтому ENFORCEMENT отключаем —
      // ставим только предупреждение про confetti. Если бандл-визуализатор покажет
      // lucide в vendor — раскомментировать второе правило.
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: 'react-confetti',
              message: 'Use LazyConfetti from @/components/common/LazyConfetti (P0-5: keep confetti out of initial bundle).',
            },
            // {
            //   name: 'lucide-react',
            //   message: 'Import icons directly: `import { Check } from "lucide-react/dist/esm/icons/check"`.',
            // },
          ],
        },
      ],
    },
  },
  {
    // Whitelist: файлы, которые сами реализуют lazy-loading react-confetti.
    // LazyConfetti — общий wrapper. Остальные 4 — исторические lazy-импорты,
    // которые тоже сделаны правильно (React.lazy → отдельный chunk).
    // Новые callsite должны идти через LazyConfetti, чтобы не плодить wrapper'ы.
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
  {
    files: ['src/utils/safeLocalStorage.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];

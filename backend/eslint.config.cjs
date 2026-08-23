const js = require('@eslint/js');
const globals = require('globals');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      // The compiler remains strict; legacy SDK/Prisma boundaries still use
      // explicit `any` and inferred public return types.
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // `warn`, а не `error`, и это не полумера: на момент включения в дереве
      // ~300 явных `any`, и `error` остановил бы CI на первом же запуске —
      // правило вернули бы в `off`. Рост числа `any` ловит отдельный счётчик
      // (`npm run any:check`), а `warn` показывает места по одному.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: false },
      ],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
      // Knip owns repository-wide dead-code checks; enabling this rule on the
      // legacy service layer would require touching concurrent work.
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-param-reassign': 'error',
    },
  },
  {
    files: [
      'scripts/**/*.ts',
      'src/scripts/**/*.ts',
      'src/**/__tests__/**/*.ts',
      'src/**/*.test.ts',
      'prisma/**/*.ts',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Тот же `warn` и в тестах: иначе половина дерева осталась бы без
      // проверки и выглядело бы это как «правило не работает». Чинить `any` в
      // тестах при этом никто не обязан — счётчик считает только продакшен.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: [
      'src/config/**/*.ts',
      'src/database/seeders/**/*.ts',
      'src/scripts/**/*.ts',
      'src/utils/error.ts',
      'src/utils/security-checks.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
);

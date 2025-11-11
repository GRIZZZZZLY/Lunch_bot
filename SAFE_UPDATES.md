# Безопасные обновления зависимостей

## Команды для обновления (февраль 2025)

### Frontend (безопасные MINOR/PATCH)

```bash
cd telegram-food-bot/frontend

# Основные библиотеки
npm install \
  @hookform/resolvers@^3.10.0 \
  @sentry/react@^10.22.0 \
  @tanstack/react-query@^5.90.6 \
  @tanstack/react-query-persist-client@^5.90.8 \
  @tanstack/query-sync-storage-persister@^5.90.8 \
  axios@^1.13.1 \
  framer-motion@^12.23.24 \
  lucide-react@^0.552.0 \
  react-hook-form@^7.66.0 \
  dompurify@^3.3.0 \
  recharts@^3.3.0 \
  react-day-picker@^9.11.1 \
  react-window@^2.2.2

# Dev dependencies
npm install --save-dev \
  @playwright/test@^1.56.1 \
  @testing-library/jest-dom@^6.9.1 \
  typescript@^5.9.3 \
  prettier@^3.6.2 \
  eslint-plugin-react-refresh@^0.4.24

# Storybook (если используется)
npm install --save-dev \
  @storybook/addon-docs@^9.1.16 \
  @storybook/addon-onboarding@^9.1.16 \
  @storybook/react-vite@^9.1.16 \
  storybook@^9.1.16
```

### Backend (безопасные MINOR/PATCH)

```bash
cd telegram-food-bot/backend

# Основные библиотеки
npm install \
  grammy@^1.38.3 \
  winston@^3.18.3 \
  dotenv@^17.2.3

# Dev dependencies
npm install --save-dev \
  typescript@^5.9.3 \
  ts-jest@^29.4.5
```

### Проверка после обновления

```bash
# Frontend
cd frontend
npm run type-check  # Проверка TypeScript
npm run build       # Проверка сборки
npm test            # Запуск тестов

# Backend
cd ../backend
npm run build       # Компиляция TypeScript
npm test            # Запуск тестов (198/202 должны пройти)

# Если всё ОК - commit
git add package.json package-lock.json
git commit -m "chore: update safe dependencies to latest minor/patch versions"
```

## Ожидаемый результат

✅ Все безопасные обновления без breaking changes
✅ Улучшенная безопасность (патчи уязвимостей)
✅ Новые фичи в minor версиях
✅ Bug fixes

## НЕ ОБНОВЛЯТЬ сейчас (требуют миграции)

❌ React 18 → 19 (подождать 1-2 месяца)
❌ Express 4 → 5 (breaking changes)
❌ Prisma 5 → 6 (требует тестирования)
❌ Zod 3 → 4 (breaking changes)
❌ TailwindCSS 3 → 4 (major refactoring)
❌ ESLint 8 → 9 (новая конфигурация)
❌ Vite 6 → 7 (только вышел)

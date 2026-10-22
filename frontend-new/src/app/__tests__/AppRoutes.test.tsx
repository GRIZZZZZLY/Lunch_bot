import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';

/* Разбор ссылки запуска проверяется в useLaunchLinkRoute.test.tsx; здесь —
   только раскладка маршрутов, без клиента запросов. */
vi.mock('@/app/useLaunchLinkRoute', () => ({ useLaunchLinkRoute: () => undefined }));
vi.mock('@/app/layouts/RootLayout', () => ({
  RootLayout: () => (
    <div data-testid="root-layout">
      <Outlet />
    </div>
  ),
}));
vi.mock('@/app/layouts/DetailLayout', () => ({
  DetailLayout: () => (
    <div data-testid="detail-layout">
      <Outlet />
    </div>
  ),
}));
vi.mock('@/features/home/HomePage', () => ({
  HomePage: () => <div>Главная</div>,
}));
vi.mock('@/features/menu/MenuPage', () => ({
  default: () => <div>Меню</div>,
}));
vi.mock('@/features/stats/StatsPage', () => ({
  StatsPage: () => <div>Статистика</div>,
}));
vi.mock('@/features/profile/ProfilePage', () => ({
  ProfilePage: () => <div>Профиль</div>,
}));
vi.mock('@/pages/AdminPage', () => ({
  AdminPage: () => <div>Управление</div>,
}));
vi.mock('@/features/budget/BudgetPage', () => ({
  BudgetPage: () => <div>Бюджет</div>,
}));
vi.mock('@/features/polls/PollHistoryPage', () => ({
  PollHistoryPage: () => <div>История</div>,
}));
vi.mock('@/features/polls/PollResultsPage', () => ({
  PollResultsPage: () => <div>Результаты</div>,
}));
vi.mock('@/features/store-run/StoreRunPage', () => ({
  StoreRunPage: () => <div>Закупка</div>,
}));
vi.mock('@/features/suggestions/SuggestionsPage', () => ({
  SuggestionsPage: ({ onlyMine }: { onlyMine?: boolean }) => (
    <div>{onlyMine ? 'Мои предложения' : 'Предложения'}</div>
  ),
}));
vi.mock('@/pages/NotFoundPage', () => ({
  NotFoundPage: () => <div>Страница не найдена</div>,
}));

import { AppRoutes } from '@/App';

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('AppRoutes — React Router 7', () => {
  /* Одна область уведомлений на всё приложение, над раскладками: при переходе
     вкладка ↔ detail-экран она не пересоздаётся, и видимое уведомление не
     проигрывает появление заново. */
  it('область уведомлений смонтирована один раз, над раскладками', () => {
    renderRoute('/');

    expect(screen.getAllByRole('region', { name: 'Уведомления' })).toHaveLength(1);
  });
});

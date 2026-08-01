import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';

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
  it.each([
    ['/', 'Главная', 'root-layout'],
    ['/menu', 'Меню', 'root-layout'],
    ['/stats', 'Статистика', 'root-layout'],
    ['/profile', 'Профиль', 'root-layout'],
    ['/admin', 'Управление', 'detail-layout'],
    ['/budget', 'Бюджет', 'detail-layout'],
    ['/poll/history', 'История', 'detail-layout'],
    ['/poll/42/results', 'Результаты', 'detail-layout'],
    ['/store-run/17', 'Закупка', 'detail-layout'],
    ['/suggestions', 'Предложения', 'detail-layout'],
    ['/suggestions/mine', 'Мои предложения', 'detail-layout'],
    // Все маршруты, кроме Главной, ленивые — ждём разрешения чанка.
  ])('открывает %s в нужной раскладке', async (path, content, layout) => {
    renderRoute(path);

    expect(await screen.findByText(content)).toBeInTheDocument();
    expect(screen.getByTestId(layout)).toBeInTheDocument();
  });

  it('Главная не ленивая: первый экран рисуется без ожидания чанка', () => {
    renderRoute('/');

    expect(screen.getByText('Главная')).toBeInTheDocument();
  });

  it('неизвестный внутренний адрес показывает страницу 404', async () => {
    renderRoute('/unknown/path');

    expect(await screen.findByText('Страница не найдена')).toBeInTheDocument();
    expect(screen.getByTestId('root-layout')).toBeInTheDocument();
  });
});

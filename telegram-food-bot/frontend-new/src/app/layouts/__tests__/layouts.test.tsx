import { beforeEach, describe, expect, it } from 'vitest';
import { useMemo, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootLayout } from '../RootLayout';
import { DetailLayout } from '../DetailLayout';
import { useScreenHeader } from '../screenHeader';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { _resetBackButtonForTests } from '@/lib/backButton';
import { useAppStore } from '@/store/useAppStore';

function DetailProbe() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const action = useMemo(() => <button>Действие</button>, []);
  useScreenHeader('Проба', action);
  return (
    <div>
      <div>detail-контент</div>
      <button onClick={() => setSheetOpen(true)}>Открыть шторку</button>
      {sheetOpen && (
        <BottomSheet title="Шторка" onClose={() => setSheetOpen(false)}>
          <div>содержимое шторки</div>
        </BottomSheet>
      )}
    </div>
  );
}

function renderApp(initialPath: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<div>root-контент</div>} />
          </Route>
          <Route element={<DetailLayout />}>
            <Route path="/detail" element={<DetailProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  _resetBackButtonForTests();
  delete window.Telegram;
  useAppStore.setState({ user: null, authStatus: 'idle', authError: null, currentGroupId: null });
});

describe('RootLayout', () => {
  it('показывает нижнюю навигацию и контент вкладки', () => {
    renderApp('/');
    expect(screen.getByRole('navigation', { name: 'Основная навигация' })).toBeInTheDocument();
    expect(screen.getByText('root-контент')).toBeInTheDocument();
  });
});

describe('DetailLayout', () => {
  it('не показывает нижнюю навигацию, показывает ScreenHeader с title и action', () => {
    renderApp('/detail');
    expect(screen.queryByRole('navigation', { name: 'Основная навигация' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Проба' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Действие' })).toBeInTheDocument();
  });

  it('вне Telegram показывает fallback-кнопку назад; без истории она ведёт на главную', async () => {
    renderApp('/detail');
    const back = screen.getByRole('button', { name: 'Назад' });
    await userEvent.click(back);
    expect(screen.getByText('root-контент')).toBeInTheDocument();
  });

  it('открытая шторка закрывается раньше навигации', async () => {
    renderApp('/detail');
    await userEvent.click(screen.getByRole('button', { name: 'Открыть шторку' }));
    expect(screen.getByText('содержимое шторки')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    // первый «назад» закрыл шторку, экран остался
    expect(screen.queryByText('содержимое шторки')).not.toBeInTheDocument();
    expect(screen.getByText('detail-контент')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    // второй «назад» — навигация
    expect(screen.getByText('root-контент')).toBeInTheDocument();
  });
});

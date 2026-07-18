import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StoreRunWithRelations } from '@/services/store-run.service';

const h = vi.hoisted(() => ({
  useStoreRun: vi.fn(),
  noop: { mutate: vi.fn(), isPending: false },
}));

vi.mock('@/hooks/useStoreRun', () => ({
  useStoreRun: h.useStoreRun,
  useAddStoreItems: () => h.noop,
  useUpdateStoreItem: () => h.noop,
  useDeleteStoreItem: () => h.noop,
  useStartShopping: () => h.noop,
  useCancelStoreRun: () => h.noop,
  useSetItemPrice: () => h.noop,
  useSettleStoreRun: () => h.noop,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, firstName: 'Игорь', isAdmin: false } }),
}));

import { StoreRunPage } from '../StoreRunPage';

function run(status: StoreRunWithRelations['status']): StoreRunWithRelations {
  return {
    id: 5,
    groupId: 1,
    initiatorId: 1,
    storeName: 'Пятёрочка',
    status,
    collectUntil: '2999-01-01T00:00:00Z',
    shoppingAt: status === 'SHOPPING' ? '2026-07-18T12:00:00Z' : null,
    settledAt: null,
    cancelledAt: null,
    createdAt: '2026-07-18T11:50:00Z',
    updatedAt: '2026-07-18T11:50:00Z',
    initiator: { id: 1, firstName: 'Игорь' },
    items: [],
  };
}

function renderPage(path = '/store-run/5') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/store-run/:id" element={<StoreRunPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ok = (data: StoreRunWithRelations | null) => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});

beforeEach(() => {
  h.useStoreRun.mockReset();
  delete window.Telegram;
});

describe('StoreRunPage — диспетчер', () => {
  it('COLLECTING → новый экран (CollectingView)', () => {
    h.useStoreRun.mockReturnValue(ok(run('COLLECTING')));
    renderPage();
    // secondary add инициатора + empty state нового экрана
    expect(screen.getByText('Пока пусто')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Закрыть сбор' })).toBeInTheDocument();
  });

  it('SHOPPING → новый ShoppingView (не legacy)', () => {
    h.useStoreRun.mockReturnValue(ok(run('SHOPPING')));
    renderPage();
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeInTheDocument();
    expect(screen.getByText('В закупке нет позиций.')).toBeInTheDocument();
    expect(screen.queryByText('Итого')).not.toBeInTheDocument();
  });

  it('SETTLED → новый SettledView (legacy не загружается)', () => {
    h.useStoreRun.mockReturnValue(ok(run('SETTLED')));
    renderPage();
    expect(screen.getByText(/Итого закупки/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'На главную' })).toBeInTheDocument();
    // маркер legacy-экрана («Итого» без уточнения) отсутствует
    expect(screen.queryByText(/^Итого$/)).not.toBeInTheDocument();
  });

  it('CANCELLED → новый CancelledView (legacy не загружается)', () => {
    h.useStoreRun.mockReturnValue(ok(run('CANCELLED')));
    renderPage();
    expect(screen.getByText('Закупка отменена инициатором.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'На главную' })).toBeInTheDocument();
    expect(screen.queryByText(/^Итого$/)).not.toBeInTheDocument();
  });

  it('неизвестный статус → безопасный ErrorState, не краш', () => {
    h.useStoreRun.mockReturnValue(ok({ ...run('SETTLED'), status: 'UNKNOWN' as never }));
    renderPage();
    expect(screen.getByText('Не удалось загрузить')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('переход COLLECTING → SHOPPING после обновления статуса показывает ShoppingView', () => {
    h.useStoreRun.mockReturnValue(ok(run('COLLECTING')));
    const { rerender } = renderPage();
    expect(screen.getByRole('button', { name: 'Закрыть сбор' })).toBeInTheDocument();

    h.useStoreRun.mockReturnValue(ok(run('SHOPPING')));
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/store-run/5']}>
          <Routes>
            <Route path="/store-run/:id" element={<StoreRunPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Закрыть сбор' })).not.toBeInTheDocument();
  });
});

describe('StoreRunPage — состояния', () => {
  it('loading: нет кнопок, нет ошибок', () => {
    h.useStoreRun.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Не удалось загрузить')).not.toBeInTheDocument();
  });

  it('network error → retry вызывает refetch', async () => {
    const refetch = vi.fn();
    h.useStoreRun.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { code: 'NETWORK_ERROR' }, refetch });
    renderPage();
    expect(screen.getByText('Не удалось загрузить')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('403 → forbidden без ложного «не найдена», без retry', () => {
    h.useStoreRun.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { status: 403 }, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('Нет доступа')).toBeInTheDocument();
    expect(screen.getByText('Вы не состоите в этой группе.')).toBeInTheDocument();
    expect(screen.queryByText('Не найдено')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument();
  });

  it('404 → notFound', () => {
    h.useStoreRun.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { status: 404 }, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('Не найдено')).toBeInTheDocument();
  });

  it('некорректный id → notFound без запроса', () => {
    h.useStoreRun.mockReturnValue(ok(null));
    renderPage('/store-run/abc');
    expect(screen.getByText('Не найдено')).toBeInTheDocument();
  });
});

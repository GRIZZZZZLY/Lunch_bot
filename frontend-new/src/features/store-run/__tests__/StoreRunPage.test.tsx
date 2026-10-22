import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('неизвестный статус → безопасный ErrorState, не краш', () => {
    h.useStoreRun.mockReturnValue(ok({ ...run('SETTLED'), status: 'UNKNOWN' as never }));
    renderPage();
    expect(screen.getByText('Не удалось загрузить')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});

describe('StoreRunPage — состояния', () => {
  it('loading: нет кнопок, нет ошибок', () => {
    h.useStoreRun.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Не удалось загрузить')).not.toBeInTheDocument();
  });
});

/* Закупка команды Б из ссылки в чате Б открывается в контексте Б. */
describe('StoreRunPage — команда закупки', () => {
  it('делает текущей команду закупки', async () => {
    const { useAppStore } = await import('@/store/useAppStore');
    useAppStore.setState({ currentGroupId: '1' });
    h.useStoreRun.mockReturnValue(ok({ ...run('COLLECTING'), groupId: 9 }));

    renderPage();

    expect(useAppStore.getState().currentGroupId).toBe('9');
  });
});

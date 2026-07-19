import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => {
  const q = (data: unknown, extra: Record<string, unknown> = {}) => ({
    data,
    isLoading: false,
    isError: false,
    error: null,
    ...extra,
  });
  return {
    q,
    m: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
    state: {
      activePoll: null as unknown,
      activeError: null as unknown,
      debts: [] as unknown[],
      credits: [] as unknown[],
      runs: [] as unknown[],
      markPaid: { mutate: vi.fn(), isPending: false },
    },
  };
});

vi.mock('@/hooks/usePolls', () => ({
  useActivePoll: () => h.q(h.state.activePoll, { error: h.state.activeError, isError: !!h.state.activeError }),
  usePollById: () => h.q(null),
  useMyVotes: () => h.q(null),
  useLastCompletedPoll: () => h.q(null),
  usePollResults: () => h.q(null),
  useVote: h.m,
  useWithdrawVote: h.m,
  useCompletePoll: h.m,
  useCancelPoll: h.m,
  useCreatePoll: h.m,
}));
vi.mock('@/hooks/useRecurringPoll', () => ({ useCreateRecurringPoll: h.m }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, firstName: 'Игорь', isAdmin: false }, isLoading: false }),
}));
vi.mock('@/hooks/useUser', () => ({ useMyGroups: () => h.q([]) }));
vi.mock('@/hooks/useMenu', () => ({ useMenuItems: () => h.q([]) }));
vi.mock('@/hooks/useBudget', () => ({
  useDebts: () => h.q(h.state.debts),
  useCredits: () => h.q(h.state.credits),
  useMarkPaid: () => h.state.markPaid,
}));
vi.mock('@/hooks/useSSE', () => ({ useSSE: () => undefined }));
vi.mock('@/hooks/useStoreRun', () => ({
  useActiveStoreRuns: () => h.q(h.state.runs),
  useCreateStoreRun: h.m,
}));

import { HomePage } from '../HomePage';

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.state.activePoll = null;
  h.state.activeError = null;
  h.state.debts = [];
  h.state.credits = [];
  h.state.runs = [];
  h.state.markPaid = { mutate: vi.fn(), isPending: false };
  delete window.Telegram;
});

describe('HomePage — состояния', () => {
  it('без активного голосования — пустой талон; без прав нет primary CTA', () => {
    renderHome();
    expect(screen.getByText('Сегодня ещё не решали')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Запустить голосование' })).not.toBeInTheDocument();
    expect(screen.getByText(/Добрый|Доброе/)).toBeInTheDocument();
  });

  it('ошибка загрузки → ErrorState с «Повторить»', () => {
    h.state.activeError = { code: 'NETWORK_ERROR' };
    renderHome();
    expect(screen.getByText('Не удалось загрузить')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('активное голосование → талон с таймером и вариантами', () => {
    h.state.activePoll = {
      id: 10,
      status: 'ACTIVE',
      duration: 30,
      createdAt: new Date().toISOString(),
      menuItems: [],
    };
    renderHome();
    expect(screen.getByText('Обеденный талон')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Голосовать' })).toBeInTheDocument();
  });

  it('долг → строка бюджета с кнопкой «Оплатил», клик зовёт markPaid', async () => {
    h.state.debts = [{ id: 7, amount: 260, status: 'PENDING' }];
    renderHome();
    const pay = screen.getByRole('button', { name: /Оплатил/ });
    await userEvent.click(pay);
    expect(h.state.markPaid.mutate).toHaveBeenCalledWith(7);
  });

  it('сборщику — сумма без кнопки', () => {
    h.state.credits = [{ id: 3, amount: 500, status: 'PENDING' }];
    renderHome();
    expect(screen.getByText('Вам должны участники')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Оплатил/ })).not.toBeInTheDocument();
  });

  it('активная закупка — строкой со статусом', () => {
    h.state.runs = [
      {
        id: 5,
        storeName: 'Пятёрочка у офиса',
        status: 'SHOPPING',
        items: [{}, {}],
        initiator: { firstName: 'Игорь' },
      },
    ];
    renderHome();
    expect(screen.getByText('Пятёрочка у офиса')).toBeInTheDocument();
    expect(screen.getByText('В магазине')).toBeInTheDocument();
  });
});

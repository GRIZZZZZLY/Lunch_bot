import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => {
  /* isSuccess обязателен: барьер первого экрана спрашивает у запросов «ответ
     получен?» именно так, а не по наличию data. Мок без этого поля выглядит для
     страницы как вечно ждущий запрос, и она честно остаётся под скелетом. */
  const q = (data: unknown, extra: Record<string, unknown> = {}) => ({
    data,
    isLoading: false,
    isSuccess: true,
    isError: false,
    error: null,
    ...extra,
  });
  const m = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    q,
    m,
    state: {
      deepLinkId: null as number | null,
      deepLinkPoll: null as unknown,
      deepLinkError: null as unknown,
      activePoll: null as unknown,
      activeError: null as unknown,
      debts: [] as unknown[],
      credits: [] as unknown[],
      runs: [] as unknown[],
      lastCompleted: null as unknown,
      lastResult: null as unknown,
      schedule: null as unknown,
      markPaid: { mutate: vi.fn(), isPending: false },
      groups: [] as unknown[],
      createPoll: m(),
      toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        clear: vi.fn(),
      },
    },
  };
});

/* Ссылка запуска читается из Telegram/URL; в тестах подменяем её целиком. */
vi.mock('@/lib/launchLink', () => ({
  getLaunchPollId: () => h.state.deepLinkId,
  markLaunchLinkHandled: () => undefined,
}));

vi.mock('@/hooks/usePolls', () => ({
  useActivePoll: () => h.q(h.state.activePoll, { error: h.state.activeError, isError: !!h.state.activeError }),
  usePollById: (id: number | null) =>
    h.q(id ? h.state.deepLinkPoll : null, {
      error: id ? h.state.deepLinkError : null,
      isError: !!(id && h.state.deepLinkError),
      isSuccess: !(id && h.state.deepLinkError),
    }),
  useMyVotes: () => h.q(null),
  useLastCompletedPoll: () => h.q(h.state.lastCompleted),
  // Отключённый запрос (id === null) данных не отдаёт — как в react-query.
  usePollResults: (id: number | null) => h.q(id ? h.state.lastResult : null),
  useVote: h.m,
  useWithdrawVote: h.m,
  useCompletePoll: h.m,
  useCancelPoll: h.m,
  useCreatePoll: () => h.state.createPoll,
}));
vi.mock('@/hooks/useToast', () => ({ useToast: () => h.state.toast }));
/* Шторка создания в этих тестах не при чём — стаб дёргает onSubmit готовой
   формой, чтобы проверить обработчик, а не UI формы. */
vi.mock('@/components/admin/CreatePollSheet', () => ({
  CreatePollSheet: ({ open, onSubmit }: { open: boolean; onSubmit: (f: unknown) => void }) => (
    <button
      data-open={String(open)}
      onClick={() =>
        onSubmit({
          title: '',
          duration: '30m',
          recurring: false,
          recurringDays: [],
          recurringTime: '11:00',
          selectedItems: ['1', '2'],
          groupId: '1',
        })
      }
    >
      submit-poll-form
    </button>
  ),
}));
vi.mock('@/hooks/useRecurringPoll', () => ({
  useCreateRecurringPoll: h.m,
  useUpdateRecurringPoll: h.m,
  useDeleteRecurringPoll: h.m,
  useRecurringSchedule: () => h.q(h.state.schedule),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, firstName: 'Игорь', isAdmin: false }, isLoading: false }),
}));
vi.mock('@/hooks/useUser', () => ({ useMyGroups: () => h.q(h.state.groups) }));
vi.mock('@/hooks/useMenu', () => ({ useMenuItems: () => h.q([]) }));
vi.mock('@/hooks/useBudget', () => ({
  useDebts: () => h.q(h.state.debts),
  useCredits: () => h.q(h.state.credits),
  useMarkPaid: () => h.state.markPaid,
}));
vi.mock('@/hooks/useSSE', () => ({ useSSE: () => undefined }));
vi.mock('@/hooks/useStoreRun', () => ({
  useActiveStoreRuns: () =>
    h.q(h.state.runs),
  useCreateStoreRun: h.m,
}));

import { HomePage } from '../HomePage';
import { useAppStore } from '@/store/useAppStore';

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.state.deepLinkId = null;
  h.state.deepLinkPoll = null;
  h.state.deepLinkError = null;
  useAppStore.setState({ currentGroupId: null, authStatus: 'idle' });
  h.state.activePoll = null;
  h.state.activeError = null;
  h.state.debts = [];
  h.state.credits = [];
  h.state.runs = [];
  h.state.lastCompleted = null;
  h.state.lastResult = null;
  h.state.schedule = null;
  h.state.markPaid = { mutate: vi.fn(), isPending: false };
  h.state.groups = [];
  h.state.createPoll = h.m();
  h.state.toast = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn(),
  };
  delete window.Telegram;
});

describe('HomePage — приоритет deep link', () => {
  const activePoll = {
    id: 10,
    status: 'ACTIVE',
    duration: 30,
    createdAt: new Date().toISOString(),
    menuItems: [{ menuItemId: 1, menuItem: { id: 1, name: 'Плов' }, _count: { votes: 1 } }],
  };

  /* `?? null`, а не `?? fallbackActivePoll`: ссылка на удалённый или чужой опрос
     не должна молча подменяться активным — иначе голос уйдёт не туда. */
  it('пустой ответ по ссылке не подменяется активным опросом', () => {
    h.state.activePoll = activePoll;
    h.state.deepLinkId = 77;
    h.state.deepLinkPoll = null;

    renderHome();

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByText('Группы пока нет')).toBeInTheDocument();
  });
});

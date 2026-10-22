import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { _resetBackButtonForTests } from '@/lib/backButton';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  refetch: vi.fn(),
  getPendingCount: vi.fn(),
  state: {
    user: { id: 1, firstName: 'Игорь', username: 'grizzly', isAdmin: false } as unknown,
    paymentInfo: undefined as unknown,
    history: [] as unknown[],
    historyLoading: false,
    historyFailed: false,
    groups: [] as Array<{ id: number; title: string; isActive: boolean; role: string }>,
    currentGroupId: null as string | null,
    streak: { current: 0, atRisk: false },
    update: { mutateAsync: vi.fn(), isPending: false },
    pendingSuggestions: 0,
    search: '',
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => h.navigate,
  useSearchParams: () => [new URLSearchParams(h.state.search)],
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.state.user, isAuthenticated: true }) }));
vi.mock('@/hooks/useStreak', () => ({ useStreak: () => ({ streak: h.state.streak }) }));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (sel: (s: { currentGroupId: string | null }) => unknown) =>
    sel({ currentGroupId: h.state.currentGroupId }),
}));
vi.mock('@/hooks/useUser', () => ({
  PROFILE_HISTORY_LIMIT: 90,
  useMyGroups: () => ({ data: h.state.groups }),
  usePaymentInfo: () => ({ data: h.state.paymentInfo }),
  useUpdatePaymentInfo: () => h.state.update,
  usePollHistory: () => ({
    data: h.state.history,
    isLoading: h.state.historyLoading,
    isError: h.state.historyFailed,
    refetch: h.refetch,
  }),
}));
/* Счётчик предложений — настоящий запрос: проверяем, уходит ли он в сеть. */
vi.mock('@/services/suggestions.service', () => ({
  suggestionsService: { getPendingCount: h.getPendingCount },
}));
// Модалки тянут React Query (useSendFeedback) — вне скоупа страницы, мокаем.
vi.mock('@/components/modals/FeedbackModal', () => ({
  FeedbackModal: ({ open }: { open: boolean }) => (open ? <div>feedback-modal</div> : null),
}));
vi.mock('@/components/modals/DonationModal', () => ({
  DonationModal: ({ open }: { open: boolean }) => (open ? <div>donation-modal</div> : null),
}));

import { ProfilePage } from '../ProfilePage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ProfilePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  _resetBackButtonForTests();
  delete window.Telegram;
  h.navigate.mockReset();
  h.refetch.mockReset();
  h.getPendingCount.mockReset();
  h.getPendingCount.mockImplementation(async () => ({ data: { count: h.state.pendingSuggestions } }));
  h.state.user = { id: 1, firstName: 'Игорь', username: 'grizzly', isAdmin: false };
  h.state.paymentInfo = undefined;
  h.state.history = [];
  h.state.historyLoading = false;
  h.state.historyFailed = false;
  h.state.groups = [];
  h.state.currentGroupId = null;
  h.state.streak = { current: 0, atRisk: false };
  h.state.pendingSuggestions = 0;
  h.state.search = '';
});

/* Кнопка «Указать реквизиты» в личке бота ведёт на /profile?edit=payment:
   человек пришёл заполнить форму, а не искать её на экране. */
describe('ProfilePage — вход по ссылке из бота', () => {
  it('?edit=payment сразу открывает форму реквизитов', () => {
    h.state.search = 'edit=payment';
    renderPage();

    expect(screen.getByRole('dialog', { name: 'Реквизиты СБП' })).toBeInTheDocument();
  });

  it('без параметра форма закрыта', () => {
    renderPage();

    expect(screen.queryByRole('dialog', { name: 'Реквизиты СБП' })).not.toBeInTheDocument();
  });
});

/* Единственный вход в очередь модерации. Пока его не было, «Все предложения»
   не открывались из приложения вообще: профиль вёл на /suggestions/mine. */
describe('ProfilePage — вход в очередь предложений', () => {
  it('участнику строки «Предложения группы» нет', () => {
    h.state.groups = [{ id: 10, title: 'Обед', isActive: true, role: 'MEMBER' }];
    h.state.currentGroupId = '10';
    renderPage();
    expect(screen.queryByText('Предложения группы')).not.toBeInTheDocument();
  });

  it('админ группы попадает в очередь и видит, сколько ждёт решения', async () => {
    h.state.groups = [{ id: 10, title: 'Обед', isActive: true, role: 'ADMIN' }];
    h.state.currentGroupId = '10';
    h.state.pendingSuggestions = 2;
    renderPage();
    expect(await screen.findByText('2 ждут решения')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Предложения группы'));
    expect(h.navigate).toHaveBeenCalledWith('/suggestions');
  });

  /* Эндпоинт закрыт админской мидлварой: спросить его без прав — это 403 при
     каждом открытии профиля. */
  it('счётчик не запрашивается без прав модерации', async () => {
    h.state.groups = [{ id: 10, title: 'Обед', isActive: true, role: 'MEMBER' }];
    h.state.currentGroupId = '10';
    renderPage();
    await act(async () => {});
    expect(h.getPendingCount).not.toHaveBeenCalled();
  });
});

describe('ProfilePage — система C', () => {
  /* Число голосований упирается в лимит страницы истории: на потолке оно
     помечено «+», а не выдаётся за точный итог. */
  it.each([
    ['из истории и серии', [{ status: 'COMPLETED' }, { status: 'ACTIVE' }], 3, ['2', '1', '3']],
    ['на потолке страницы', Array.from({ length: 90 }, () => ({ status: 'COMPLETED' })), 0, ['90+', '90', '0']],
  ])('показатели: %s', (_, polls, streak, values) => {
    h.state.history = polls.map((p, i) => ({ ...p, id: i, createdAt: '2026-07-01' }));
    h.state.streak = { current: streak, atRisk: false };
    renderPage();
    for (const v of values) expect(screen.getByText(v)).toBeInTheDocument();
  });

  /* Регрессия. Отказ чтения истории давал три уверенных нуля: «0 голосований,
     0 завершено, 0 дней» — то есть «ты ни разу не голосовал» вместо
     «я не смог прочитать». */
  it('нечитаемая история показывает «—», а не нули', () => {
    h.state.historyFailed = true;
    renderPage();
    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(3);
    expect(screen.getByText(/Не удалось прочитать историю/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it('пока история грузится, показатели не выдают нули за факты', () => {
    h.state.historyLoading = true;
    renderPage();
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.queryByText(/Не удалось прочитать/)).not.toBeInTheDocument();
  });

});

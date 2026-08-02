import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { _resetBackButtonForTests } from '@/lib/backButton';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  refetch: vi.fn(),
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
    pendingArgs: undefined as unknown,
  },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.state.user }) }));
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
vi.mock('@/hooks/useSuggestions', () => ({
  usePendingSuggestionsCount: (args: unknown) => {
    h.state.pendingArgs = args;
    return { data: h.state.pendingSuggestions };
  },
}));
// Модалки тянут React Query (useSendFeedback) — вне скоупа страницы, мокаем.
vi.mock('@/components/modals/FeedbackModal', () => ({
  FeedbackModal: ({ open }: { open: boolean }) => (open ? <div>feedback-modal</div> : null),
}));
vi.mock('@/components/modals/DonationModal', () => ({
  DonationModal: ({ open }: { open: boolean }) => (open ? <div>donation-modal</div> : null),
}));

import { ProfilePage } from '../ProfilePage';

beforeEach(() => {
  _resetBackButtonForTests();
  delete window.Telegram;
  h.navigate.mockReset();
  h.refetch.mockReset();
  h.state.user = { id: 1, firstName: 'Игорь', username: 'grizzly', isAdmin: false };
  h.state.paymentInfo = undefined;
  h.state.history = [];
  h.state.historyLoading = false;
  h.state.historyFailed = false;
  h.state.groups = [];
  h.state.currentGroupId = null;
  h.state.streak = { current: 0, atRisk: false };
  h.state.pendingSuggestions = 0;
  h.state.pendingArgs = undefined;
});

/* Единственный вход в очередь модерации. Пока его не было, «Все предложения»
   не открывались из приложения вообще: профиль вёл на /suggestions/mine. */
describe('ProfilePage — вход в очередь предложений', () => {
  it('участнику строки «Предложения группы» нет', () => {
    h.state.groups = [{ id: 10, title: 'Обед', isActive: true, role: 'MEMBER' }];
    h.state.currentGroupId = '10';
    render(<ProfilePage />);
    expect(screen.queryByText('Предложения группы')).not.toBeInTheDocument();
  });

  it('админ группы попадает в очередь и видит, сколько ждёт решения', () => {
    h.state.groups = [{ id: 10, title: 'Обед', isActive: true, role: 'ADMIN' }];
    h.state.currentGroupId = '10';
    h.state.pendingSuggestions = 2;
    render(<ProfilePage />);
    expect(screen.getByText('2 ждут решения')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Предложения группы'));
    expect(h.navigate).toHaveBeenCalledWith('/suggestions');
  });

  it('одно предложение — «ждёт», а не «ждут»', () => {
    h.state.groups = [{ id: 10, title: 'Обед', isActive: true, role: 'CREATOR' }];
    h.state.currentGroupId = '10';
    h.state.pendingSuggestions = 1;
    render(<ProfilePage />);
    expect(screen.getByText('1 ждёт решения')).toBeInTheDocument();
  });

  /* Эндпоинт закрыт админской мидлварой: спросить его без прав — это 403 при
     каждом открытии профиля. */
  it('счётчик не запрашивается без прав модерации', () => {
    h.state.groups = [{ id: 10, title: 'Обед', isActive: true, role: 'MEMBER' }];
    h.state.currentGroupId = '10';
    render(<ProfilePage />);
    expect(h.state.pendingArgs).toEqual({ groupId: '10', enabled: false });
  });
});

describe('ProfilePage — система C', () => {
  it('шапка: имя и @handle; заглушек «Уведомления»/«Язык» нет', () => {
    render(<ProfilePage />);
    expect(screen.getByText('Игорь')).toBeInTheDocument();
    expect(screen.getByText('@grizzly')).toBeInTheDocument();
    expect(screen.queryByText('Уведомления')).not.toBeInTheDocument();
    expect(screen.queryByText('Язык')).not.toBeInTheDocument();
  });

  it('реквизиты: без данных — «СБП не задано», тап открывает шторку', () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByText('СБП не задано'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /* Раньше номер выводился как «+7 *** 67». Строка нужна, чтобы человек
     убедился, что деньги придут куда надо, — маска ровно это и ломала. */
  it('реквизиты: свой номер показан целиком и разбит на группы', () => {
    h.state.paymentInfo = { paymentPhone: '+79261234567', paymentDetails: 'Сбер' };
    render(<ProfilePage />);
    expect(screen.getByText('СБП +7 926 123-45-67')).toBeInTheDocument();
    expect(screen.getByText('Сбер')).toBeInTheDocument();
    expect(screen.queryByText(/\*\*\*/)).not.toBeInTheDocument();
  });

  /* Подсказка про то, кто увидит реквизиты, раньше жила в подписи ряда и
     пропадала, как только был указан банк, — то есть ровно тогда, когда
     реквизиты кому-то начинали показываться. */
  it('подсказка про реквизиты не исчезает после заполнения банка', () => {
    h.state.paymentInfo = { paymentPhone: '+79261234567', paymentDetails: 'Сбер' };
    render(<ProfilePage />);
    expect(screen.getByText(/Участники увидят их/)).toBeInTheDocument();
  });

  it('навигация: история и предложения', () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByText('История голосований'));
    expect(h.navigate).toHaveBeenCalledWith('/poll/history');
    fireEvent.click(screen.getByText('Мои предложения'));
    expect(h.navigate).toHaveBeenCalledWith('/suggestions/mine');
  });

  it('«Управление» скрыто у обычного участника', () => {
    render(<ProfilePage />);
    expect(screen.queryByText('Управление')).not.toBeInTheDocument();
  });

  it('админ видит «Управление» и переходит в /admin', () => {
    h.state.user = { id: 1, firstName: 'Игорь', isAdmin: true };
    render(<ProfilePage />);
    fireEvent.click(screen.getByText('Управление'));
    expect(h.navigate).toHaveBeenCalledWith('/admin');
  });

  it('групповой админ видит «Управление»', () => {
    h.state.groups = [{ id: 1, title: 'Команда', isActive: true, role: 'ADMIN' }];
    render(<ProfilePage />);
    expect(screen.getByText('Управление')).toBeInTheDocument();
  });

  it('показатели считаются из истории и склоняются', () => {
    h.state.history = [
      { id: 1, status: 'COMPLETED', createdAt: '2026-07-01' },
      { id: 2, status: 'ACTIVE', createdAt: '2026-07-02' },
    ];
    h.state.streak = { current: 3, atRisk: false };
    render(<ProfilePage />);
    expect(screen.getByText('голосования').previousSibling).toHaveTextContent('2');
    expect(screen.getByText('завершено').previousSibling).toHaveTextContent('1');
    expect(screen.getByText(/^дня подряд$/).previousSibling).toHaveTextContent('3');
  });

  /* Регрессия. Отказ чтения истории давал три уверенных нуля: «0 голосований,
     0 завершено, 0 дней» — то есть «ты ни разу не голосовал» вместо
     «я не смог прочитать». */
  it('нечитаемая история показывает «—», а не нули', () => {
    h.state.historyFailed = true;
    render(<ProfilePage />);
    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(3);
    expect(screen.getByText(/Не удалось прочитать историю/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it('пока история грузится, показатели не выдают нули за факты', () => {
    h.state.historyLoading = true;
    render(<ProfilePage />);
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.queryByText(/Не удалось прочитать/)).not.toBeInTheDocument();
  });

  /* Длина истории упирается в лимит страницы: у активного участника показатель
     замирал на потолке и выглядел точным итогом. */
  it('на потолке страницы показатель помечен как неполный', () => {
    h.state.history = Array.from({ length: 90 }, (_, i) => ({
      id: i,
      status: 'COMPLETED',
      createdAt: '2026-07-01',
    }));
    render(<ProfilePage />);
    expect(screen.getByText('голосований').previousSibling).toHaveTextContent('90+');
    expect(screen.getByText(/последние/)).toBeInTheDocument();
  });

  it('серия под угрозой говорит, что делать, а не только про угрозу', () => {
    h.state.streak = { current: 4, atRisk: true };
    h.state.history = [{ id: 1, status: 'COMPLETED', createdAt: '2026-07-01' }];
    render(<ProfilePage />);
    expect(screen.getByText(/Серия прервётся, если сегодня не проголосовать/)).toBeInTheDocument();
    expect(screen.getByText(/^дня подряд$/)).toBeInTheDocument();
  });

  it('показатели подписаны группой, по которой посчитаны', () => {
    h.state.groups = [{ id: 7, title: 'Команда Ракета', isActive: true, role: 'MEMBER' }];
    h.state.currentGroupId = '7';
    render(<ProfilePage />);
    expect(screen.getByText('по группе «Команда Ракета»')).toBeInTheDocument();
  });
});

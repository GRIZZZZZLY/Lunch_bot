import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { _resetBackButtonForTests } from '@/lib/backButton';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  state: {
    user: { id: 1, firstName: 'Игорь', username: 'grizzly', isAdmin: false } as unknown,
    paymentInfo: undefined as unknown,
    history: [] as unknown[],
    streak: { current: 0, atRisk: false },
    update: { mutateAsync: vi.fn(), isPending: false },
  },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.state.user }) }));
vi.mock('@/hooks/useStreak', () => ({ useStreak: () => ({ streak: h.state.streak }) }));
vi.mock('@/hooks/useUser', () => ({
  usePaymentInfo: () => ({ data: h.state.paymentInfo }),
  useUpdatePaymentInfo: () => h.state.update,
  usePollHistory: () => ({ data: h.state.history }),
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
  h.state.user = { id: 1, firstName: 'Игорь', username: 'grizzly', isAdmin: false };
  h.state.paymentInfo = undefined;
  h.state.history = [];
  h.state.streak = { current: 0, atRisk: false };
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

  it('реквизиты: телефон маскируется', () => {
    h.state.paymentInfo = { sbpPhone: '+79261234567', bankName: 'Сбер' };
    render(<ProfilePage />);
    expect(screen.getByText('СБП +7 *** 67')).toBeInTheDocument();
    expect(screen.getByText('Сбер')).toBeInTheDocument();
  });

  it('навигация: история и предложения', () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByText('История голосований'));
    expect(h.navigate).toHaveBeenCalledWith('/poll/history');
    fireEvent.click(screen.getByText('Мои предложения'));
    expect(h.navigate).toHaveBeenCalledWith('/suggestions/mine');
  });

  it('«Управление» видно только глобальному админу', () => {
    render(<ProfilePage />);
    expect(screen.queryByText('Управление')).not.toBeInTheDocument();
  });

  it('админ видит «Управление» и переходит в /admin', () => {
    h.state.user = { id: 1, firstName: 'Игорь', isAdmin: true };
    render(<ProfilePage />);
    fireEvent.click(screen.getByText('Управление'));
    expect(h.navigate).toHaveBeenCalledWith('/admin');
  });

  it('показатели считаются из истории', () => {
    h.state.history = [
      { id: 1, status: 'COMPLETED', createdAt: '2026-07-01' },
      { id: 2, status: 'ACTIVE', createdAt: '2026-07-02' },
    ];
    h.state.streak = { current: 3, atRisk: false };
    render(<ProfilePage />);
    expect(screen.getByText('голосований').previousSibling).toHaveTextContent('2');
    expect(screen.getByText('завершено').previousSibling).toHaveTextContent('1');
    expect(screen.getByText('дней серия').previousSibling).toHaveTextContent('3');
  });
});

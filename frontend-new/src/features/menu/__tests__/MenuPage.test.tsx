import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: { pathname: '/menu', state: null as unknown },
  toast: { error: vi.fn() },
  q: (data: unknown, extra: Record<string, unknown> = {}) => ({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...extra,
  }),
  m: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
  state: {
    items: [] as unknown[],
    groups: [] as unknown[],
    user: { id: 1, firstName: 'Игорь', isAdmin: false } as unknown,
    error: null as unknown,
    toggle: { mutate: vi.fn(), isPending: false, variables: undefined },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => h.navigate,
  useLocation: () => h.location,
}));
vi.mock('@/hooks/useToast', () => ({ useToast: () => h.toast }));
vi.mock('@/hooks/useMenu', () => ({
  useMenuItems: () => h.q(h.state.items, { error: h.state.error, isError: !!h.state.error }),
  useCreateMenuItem: h.m,
  useUpdateMenuItem: h.m,
  useDeleteMenuItem: h.m,
  useToggleMenuItem: () => h.state.toggle,
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.state.user }) }));
vi.mock('@/hooks/useUser', () => ({ useMyGroups: () => h.q(h.state.groups) }));

import MenuPage from '../MenuPage';

const dish = (over: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Том-ям с креветками',
  description: 'кокосовое молоко, кинза',
  category: 'Супы',
  price: 420,
  isActive: true,
  ...over,
});

const group = (id: number, title: string, role = 'MEMBER') => ({
  id,
  title,
  telegramId: String(id),
  type: 'group',
  isActive: true,
  role,
});

beforeEach(() => {
  h.navigate.mockReset();
  h.location = { pathname: '/menu', state: null };
  h.toast = { error: vi.fn() };
  h.state.items = [dish(), dish({ id: 2, name: 'Пицца «Маргарита»', category: 'Пицца', price: 380 })];
  h.state.groups = [group(10, 'Офис', 'MEMBER')];
  h.state.user = { id: 1, firstName: 'Игорь', isAdmin: false };
  h.state.error = null;
  h.state.toggle = { mutate: vi.fn(), isPending: false, variables: undefined };
  useAppStore.setState({ currentGroupId: '10', user: null, authStatus: 'authenticated', authError: null });
});

describe('MenuPage — данные API', () => {
  it('блюдо без цены показывает прочерк, а не роняет экран', () => {
    // price в схеме — Decimal?, API отдаёт null как есть. Раньше это был
    // null.toLocaleString и «Что-то пошло не так» на весь экран.
    h.state.items = [dish({ id: 4, name: 'Комплимент от повара', price: null })];
    render(<MenuPage />);

    expect(screen.getByText('Комплимент от повара')).toBeInTheDocument();
    expect(screen.getByLabelText('Цена не указана')).toHaveTextContent('—');
    expect(screen.queryByText(/Что-то пошло не так/)).not.toBeInTheDocument();
  });
});

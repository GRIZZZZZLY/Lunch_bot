import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { _resetBackButtonForTests } from '@/lib/backButton';

const h = vi.hoisted(() => ({
  q: (data: unknown, extra: Record<string, unknown> = {}) => ({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...extra,
  }),
  state: {
    items: [] as unknown[],
    user: { id: 1, firstName: 'Игорь', isAdmin: false } as unknown,
    groups: [] as unknown[],
    currentGroupId: '10' as string | null,
    create: { mutate: vi.fn(), isPending: false },
    approve: { mutate: vi.fn(), isPending: false, variables: undefined },
    reject: { mutate: vi.fn(), isPending: false },
    del: { mutate: vi.fn(), isPending: false },
  },
}));

const grp = (id: number, role = 'MEMBER') => ({ id, title: `Гр ${id}`, isActive: true, role });

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.state.user }) }));
vi.mock('@/hooks/useUser', () => ({ useMyGroups: () => h.q(h.state.groups) }));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (sel: (s: { currentGroupId: string | null }) => unknown) =>
    sel({ currentGroupId: h.state.currentGroupId }),
}));
vi.mock('@/hooks/useSuggestions', () => ({
  useSuggestions: () => h.q(h.state.items),
  useCreateSuggestion: () => h.state.create,
  useApproveSuggestion: () => h.state.approve,
  useRejectSuggestion: () => h.state.reject,
  useDeleteSuggestion: () => h.state.del,
}));

import { SuggestionsPage } from '../SuggestionsPage';

const sug = (over: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Поке с лососем',
  description: 'рис, авокадо',
  price: 450,
  status: 'PENDING',
  suggestedBy: 1,
  createdAt: '2026-07-19T12:00:00Z',
  ...over,
});

beforeEach(() => {
  _resetBackButtonForTests();
  delete window.Telegram;
  h.state.items = [];
  h.state.user = { id: 1, firstName: 'Игорь', isAdmin: false };
  h.state.groups = [grp(10, 'MEMBER')];
  h.state.currentGroupId = '10';
  Object.assign(h.state.create, { mutate: vi.fn(), isPending: false });
  Object.assign(h.state.approve, { mutate: vi.fn(), isPending: false });
  Object.assign(h.state.reject, { mutate: vi.fn(), isPending: false });
  Object.assign(h.state.del, { mutate: vi.fn(), isPending: false });
});

describe('SuggestionsPage — участник', () => {
  it('фильтр «Мои» показывает только свои', () => {
    h.state.items = [sug(), sug({ id: 2, name: 'Чужое блюдо', suggestedBy: 99 })];
    render(<SuggestionsPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Мои' }));
    expect(screen.getByText('Поке с лососем')).toBeInTheDocument();
    expect(screen.queryByText('Чужое блюдо')).not.toBeInTheDocument();
  });

  it('ошибка отправки не стирает заполненную форму', () => {
    h.state.create.mutate = vi.fn((_vars, opts) =>
      opts?.onError?.({ success: false, error: 'Network error', code: 'NETWORK_ERROR' }),
    );
    render(<SuggestionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Предложить блюдо' }));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Рамен' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(screen.getByRole('alert')).not.toBeEmptyDOMElement();
    expect(screen.getByLabelText('Название')).toHaveValue('Рамен');
  });

  it('переключатель — настоящий tablist, а не пара кнопок', () => {
    render(<SuggestionsPage />);
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  });
});

describe('SuggestionsPage — админ группы', () => {
  beforeEach(() => {
    // Права модерации — по РОЛИ в группе, а не по глобальному isAdmin.
    h.state.user = { id: 5, firstName: 'Админ', isAdmin: false };
    h.state.groups = [grp(10, 'ADMIN')];
    h.state.items = [sug({ suggestedBy: 1 })];
  });

  it('отмена подтверждения ничего не меняет', () => {
    render(<SuggestionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Одобрить' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Отмена' }));
    expect(h.state.approve.mutate).not.toHaveBeenCalled();
  });

  it('глобальный админ без роли в группе НЕ видит «Одобрить»', () => {
    h.state.user = { id: 5, firstName: 'Админ', isAdmin: true };
    h.state.groups = [grp(10, 'MEMBER')];
    render(<SuggestionsPage />);
    expect(screen.queryByRole('button', { name: 'Одобрить' })).not.toBeInTheDocument();
  });
});

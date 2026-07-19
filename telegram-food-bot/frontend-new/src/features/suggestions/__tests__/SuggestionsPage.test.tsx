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
  it('пусто → EmptyState с CTA «Предложить блюдо»', () => {
    render(<SuggestionsPage />);
    expect(screen.getByText('Пока пусто')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Предложить блюдо' })).toBeInTheDocument();
  });

  it('создание: форма в шторке, отправка зовёт мутацию', () => {
    render(<SuggestionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Предложить блюдо' }));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Рамен' } });
    fireEvent.change(screen.getByLabelText(/Примерная цена/), { target: { value: '390' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(h.state.create.mutate).toHaveBeenCalledWith(
      { data: { name: 'Рамен', description: undefined, price: 390 }, groupId: '10' },
      expect.anything(),
    );
  });

  it('фильтр «Мои» показывает только свои', () => {
    h.state.items = [sug(), sug({ id: 2, name: 'Чужое блюдо', suggestedBy: 99 })];
    render(<SuggestionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Мои' }));
    expect(screen.getByText('Поке с лососем')).toBeInTheDocument();
    expect(screen.queryByText('Чужое блюдо')).not.toBeInTheDocument();
  });

  it('удаление своего PENDING — через ConfirmDialog', () => {
    h.state.items = [sug()];
    render(<SuggestionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Удалить предложение?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));
    expect(h.state.del.mutate).toHaveBeenCalledWith({ id: 1, groupId: '10' }, expect.anything());
  });

  it('участник не видит админ-действий; статусы словами', () => {
    h.state.items = [sug({ status: 'APPROVED' }), sug({ id: 2, status: 'REJECTED', rejectionReason: 'дорого' })];
    render(<SuggestionsPage />);
    expect(screen.getByText('Одобрено')).toBeInTheDocument();
    expect(screen.getByText('Отклонено')).toBeInTheDocument();
    expect(screen.getByText('Причина: дорого')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Одобрить' })).not.toBeInTheDocument();
  });
});

describe('SuggestionsPage — админ группы', () => {
  beforeEach(() => {
    // Права модерации — по РОЛИ в группе, а не по глобальному isAdmin.
    h.state.user = { id: 5, firstName: 'Админ', isAdmin: false };
    h.state.groups = [grp(10, 'ADMIN')];
    h.state.items = [sug({ suggestedBy: 1 })];
  });

  it('одобряет PENDING с groupId', () => {
    render(<SuggestionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Одобрить' }));
    expect(h.state.approve.mutate).toHaveBeenCalledWith({ id: 1, groupId: '10' });
  });

  it('отклонение — шторка с причиной, без window.prompt', () => {
    render(<SuggestionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Отклонить' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.change(within(dialog).getByLabelText(/Причина/), { target: { value: 'уже есть похожее' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отклонить' }));
    expect(h.state.reject.mutate).toHaveBeenCalledWith(
      { id: 1, reason: 'уже есть похожее', groupId: '10' },
      expect.anything(),
    );
  });

  it('глобальный админ без роли в группе НЕ видит «Одобрить»', () => {
    h.state.user = { id: 5, firstName: 'Админ', isAdmin: true };
    h.state.groups = [grp(10, 'MEMBER')];
    render(<SuggestionsPage />);
    expect(screen.queryByRole('button', { name: 'Одобрить' })).not.toBeInTheDocument();
  });
});

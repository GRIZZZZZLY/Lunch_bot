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
    fireEvent.click(screen.getByRole('tab', { name: 'Мои' }));
    expect(screen.getByText('Поке с лососем')).toBeInTheDocument();
    expect(screen.queryByText('Чужое блюдо')).not.toBeInTheDocument();
  });

  it('отзыв своего PENDING — через ConfirmDialog', () => {
    h.state.items = [sug()];
    render(<SuggestionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Отозвать' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Отозвать предложение?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отозвать' }));
    expect(h.state.del.mutate).toHaveBeenCalledWith({ id: 1, groupId: '10' }, expect.anything());
  });

  /* Регрессия. Сервер отвечал на отзыв 403, а страница молчала: диалог
     оставался открытым, строка не менялась, и человек жал снова. Ни одного
     onError в файле не было. */
  it('отказ сервера произносится вслух и остаётся у строки', () => {
    h.state.items = [sug()];
    h.state.del.mutate = vi.fn((_vars, opts) =>
      opts?.onError?.({ success: false, error: 'Group admin access required', code: 'ACCESS_DENIED' }),
    );
    render(<SuggestionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Отозвать' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Отозвать' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Доступ запрещён: нужны права администратора группы.',
    );
    // Диалог закрыт: причина уже сказана, повторный тап ничего не изменит.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Поке с лососем')).toBeInTheDocument();
  });

  it('ошибка отправки не стирает заполненную форму', () => {
    h.state.create.mutate = vi.fn((_vars, opts) =>
      opts?.onError?.({ success: false, error: 'Network error', code: 'NETWORK_ERROR' }),
    );
    render(<SuggestionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Предложить блюдо' }));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Рамен' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Нет связи с сервером. Проверьте интернет.');
    expect(screen.getByLabelText('Название')).toHaveValue('Рамен');
  });

  it('в строке видно, кто и когда предложил', () => {
    h.state.items = [sug({ suggestedBy: 99, suggester: { id: 99, firstName: 'Анна' } })];
    render(<SuggestionsPage />);
    expect(screen.getByText('Анна · 19 июля')).toBeInTheDocument();
  });

  it('своё предложение подписано «Вы», а не именем', () => {
    h.state.items = [sug({ suggester: { id: 1, firstName: 'Игорь' } })];
    render(<SuggestionsPage />);
    expect(screen.getByText('Вы · 19 июля')).toBeInTheDocument();
  });

  it('переключатель — настоящий tablist, а не пара кнопок', () => {
    render(<SuggestionsPage />);
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
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

  /* Одобрение необратимо создаёт блюдо в меню, а подтверждения не имело —
     в отличие от обратимых отклонения и отзыва. */
  it('одобряет PENDING с groupId — после подтверждения', () => {
    render(<SuggestionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Одобрить' }));
    expect(h.state.approve.mutate).not.toHaveBeenCalled();

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Добавить блюдо в меню?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Одобрить' }));
    expect(h.state.approve.mutate).toHaveBeenCalledWith({ id: 1, groupId: '10' }, expect.anything());
  });

  it('отмена подтверждения ничего не меняет', () => {
    render(<SuggestionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Одобрить' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Отмена' }));
    expect(h.state.approve.mutate).not.toHaveBeenCalled();
  });

  /* Очередь и архив шли одним списком: улёгшееся решение полугодовой давности
     весило столько же, сколько строка, которую ждут. */
  it('очередь отделена от разобранного', () => {
    h.state.items = [
      sug({ id: 1, status: 'PENDING' }),
      sug({ id: 2, name: 'Фалафель', status: 'APPROVED' }),
      sug({ id: 3, name: 'Рамен', status: 'REJECTED' }),
    ];
    render(<SuggestionsPage />);
    expect(screen.getByRole('heading', { name: /Ждут решения/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Разобранные/ })).toHaveTextContent('2');
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

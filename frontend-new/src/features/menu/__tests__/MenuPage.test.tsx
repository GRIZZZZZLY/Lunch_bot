import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';

const h = vi.hoisted(() => ({
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
import { buildCategories } from '../MenuPage';

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
  h.state.items = [dish(), dish({ id: 2, name: 'Пицца «Маргарита»', category: 'Пицца', price: 380 })];
  h.state.groups = [group(10, 'Офис', 'MEMBER')];
  h.state.user = { id: 1, firstName: 'Игорь', isAdmin: false };
  h.state.error = null;
  h.state.toggle = { mutate: vi.fn(), isPending: false, variables: undefined };
  useAppStore.setState({ currentGroupId: '10', user: null, authStatus: 'authenticated', authError: null });
});

describe('MenuPage — участник', () => {
  it('видит список с ценами, без правки и без «Добавить блюдо»', () => {
    render(<MenuPage />);
    expect(screen.getByText('Том-ям с креветками')).toBeInTheDocument();
    expect(screen.getByText('420 ₽')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Добавить блюдо' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Изменить/)).not.toBeInTheDocument();
    expect(screen.getByText(/Предложите его в «Предложениях»/)).toBeInTheDocument();
  });

  it('поиск фильтрует; пустой результат — EmptyState', () => {
    render(<MenuPage />);
    fireEvent.change(screen.getByLabelText('Поиск блюд'), { target: { value: 'пицца' } });
    expect(screen.queryByText('Том-ям с креветками')).not.toBeInTheDocument();
    expect(screen.getByText('Пицца «Маргарита»')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Поиск блюд'), { target: { value: 'шаурма' } });
    expect(screen.getByText('Ничего не нашлось')).toBeInTheDocument();
  });

  it('чипы категорий со счётчиками фильтруют', () => {
    render(<MenuPage />);
    expect(screen.getByRole('button', { name: /Все · 2/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Супы · 1/ }));
    expect(screen.getByText('Том-ям с креветками')).toBeInTheDocument();
    expect(screen.queryByText('Пицца «Маргарита»')).not.toBeInTheDocument();
  });
});

describe('MenuPage — админ группы', () => {
  beforeEach(() => {
    // Права по РОЛИ в выбранной группе, а не по глобальному isAdmin.
    h.state.groups = [group(10, 'Офис', 'ADMIN')];
  });

  it('toggle уходит с явным groupId (B4)', () => {
    render(<MenuPage />);
    fireEvent.click(screen.getByLabelText('Скрыть «Том-ям с креветками»'));
    expect(h.state.toggle.mutate).toHaveBeenCalledWith({ id: 1, groupId: '10' });
  });

  it('видит правку и «Добавить блюдо»; скрытое блюдо помечено', () => {
    h.state.items = [dish({ isActive: false })];
    render(<MenuPage />);
    expect(screen.getByText('Скрыто')).toBeInTheDocument();
    expect(screen.getByLabelText('Изменить «Том-ям с креветками»')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить блюдо' })).toBeInTheDocument();
  });
});

describe('MenuPage — глобальный админ без роли в группе', () => {
  it('isAdmin=true, но роль MEMBER → «Добавить блюдо» скрыто (совпадает с бэком)', () => {
    h.state.user = { id: 1, firstName: 'Игорь', isAdmin: true };
    h.state.groups = [group(10, 'Офис', 'MEMBER')];
    render(<MenuPage />);
    expect(screen.queryByRole('button', { name: 'Добавить блюдо' })).not.toBeInTheDocument();
  });
});

describe('MenuPage — глобальная группа', () => {
  it('переключение группы меняет currentGroupId в сторе (не локально)', () => {
    h.state.groups = [group(10, 'Офис', 'ADMIN'), group(20, 'Розница')];
    render(<MenuPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Розница' }));
    expect(useAppStore.getState().currentGroupId).toBe('20');
  });
});

describe('MenuPage — состояния', () => {
  it('ошибка → ErrorState с Повторить', () => {
    h.state.error = { code: 'NETWORK_ERROR' };
    h.state.items = [];
    render(<MenuPage />);
    expect(screen.getByText('Не удалось загрузить')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('пусто (участник) → EmptyState без CTA', () => {
    h.state.items = [];
    render(<MenuPage />);
    expect(screen.getByText('Меню пустое')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Добавить блюдо' })).not.toBeInTheDocument();
  });
});

describe('buildCategories', () => {
  it('считает категории с «Все» первым', () => {
    expect(buildCategories([{ category: 'Супы' }, { category: 'Супы' }, { category: 'Пицца' }])).toEqual([
      { id: 'all', label: 'Все', count: 3 },
      { id: 'Супы', label: 'Супы', count: 2 },
      { id: 'Пицца', label: 'Пицца', count: 1 },
    ]);
  });
});

/* Находки критики 2026-08-01: фильтр не сообщал состояние, деньги шли без
   разрядов, поиск нельзя было очистить одним касанием. */
describe('MenuPage — состояние фильтра, деньги и поиск', () => {
  it('выбранная категория объявлена через aria-pressed, а не только цветом', () => {
    render(<MenuPage />);

    const all = screen.getByRole('button', { name: /^Все/ });
    const soups = screen.getByRole('button', { name: /^Супы/ });
    expect(all).toHaveAttribute('aria-pressed', 'true');
    expect(soups).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(soups);
    expect(screen.getByRole('button', { name: /^Супы/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Все/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('цена набрана с разрядами, как на остальных экранах', () => {
    h.state.items = [dish({ id: 3, name: 'Стейк', price: 1340 })];
    render(<MenuPage />);
    // «1 340 ₽», а не «1340 ₽»; пробел-разделитель нормализуем
    const price = screen.getByText(/1.340/);
    expect(price.textContent?.replace(/\s/g, ' ')).toBe('1 340 ₽');
  });

  it('очистка поиска возвращает список одним касанием', () => {
    render(<MenuPage />);
    const search = screen.getByRole('textbox', { name: 'Поиск блюд' });

    fireEvent.change(search, { target: { value: 'несуществующее' } });
    expect(screen.getByText('Ничего не нашлось')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }));
    expect(screen.queryByText('Ничего не нашлось')).not.toBeInTheDocument();
    expect(search).toHaveValue('');
  });

  it('кнопки очистки нет, пока поиск пуст', () => {
    render(<MenuPage />);
    expect(screen.queryByRole('button', { name: 'Очистить поиск' })).not.toBeInTheDocument();
  });
});

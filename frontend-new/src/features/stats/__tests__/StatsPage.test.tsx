import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
  refetch: vi.fn(),
  state: {
    polls: [] as unknown[],
    loading: false,
    failed: false,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, firstName: 'Аня' }, isLoading: false }),
}));

vi.mock('@/hooks/useUser', () => ({
  PROFILE_HISTORY_LIMIT: 90,
  usePollHistory: () => ({
    data: h.state.polls,
    isLoading: h.state.loading,
    isError: h.state.failed,
    refetch: h.refetch,
  }),
}));

import { StatsPage } from '../StatsPage';

const poll = (id: number, voters: number[]) => ({
  id,
  status: 'COMPLETED',
  createdAt: '2026-07-10T10:00:00',
  votes: voters.map((uid, i) => ({
    id: id * 100 + i,
    userId: uid,
    menuItemId: 1,
    user: { id: uid, firstName: `U${uid}` },
  })),
});

beforeEach(() => {
  h.refetch.mockReset();
  h.state.polls = [];
  h.state.loading = false;
  h.state.failed = false;
});

describe('StatsPage', () => {
  /* Регрессия. Отказ чтения истории попадал в ту же ветку, что и пустая
     история, и подавался как «Пока нет данных… после первых голосований
     команды» — то есть как факт о команде, а не как несостоявшийся запрос.
     Существующий e2e-тест это поведение даже закреплял. */
  it('отказ чтения — это ошибка, а не «данных нет»', () => {
    h.state.failed = true;
    render(<StatsPage />);

    expect(screen.getByText(/Не удалось прочитать историю/)).toBeInTheDocument();
    expect(screen.queryByText('Пока нет данных')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it('пустая история по-прежнему говорит, что данных ещё нет', () => {
    render(<StatsPage />);
    expect(screen.getByText('Пока нет данных')).toBeInTheDocument();
    expect(screen.queryByText(/Не удалось/)).not.toBeInTheDocument();
  });

  /* «1 из 1 голосований» — знаменатель не склонялся. */
  it('склоняет знаменатель участия', () => {
    h.state.polls = [poll(1, [1])];
    render(<StatsPage />);
    expect(screen.getByText(/^голосования ·/)).toBeInTheDocument();
  });

  /* Знаменатель — размер страницы, а не число голосований команды. */
  it('на потолке страницы честно говорит, что счёт неполный', () => {
    h.state.polls = Array.from({ length: 90 }, (_, i) => poll(i + 1, [1]));
    render(<StatsPage />);
    expect(screen.getByText(/считаем по последним 90 голосованиям/)).toBeInTheDocument();
  });

  it('ниже потолка оговорки нет', () => {
    h.state.polls = [poll(1, [1])];
    render(<StatsPage />);
    expect(screen.queryByText(/считаем по последним/)).not.toBeInTheDocument();
  });

  /* Четыре одинаковые полосы с номерами 1–4 читались как рейтинг. */
  it('при равенстве не изображает рейтинг', () => {
    h.state.polls = [poll(1, [1, 2, 3, 4])];
    render(<StatsPage />);
    expect(screen.getByText('пока у всех поровну')).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });
});

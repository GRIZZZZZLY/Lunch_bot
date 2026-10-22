import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
  /* Знаменатель — размер страницы, а не число голосований команды: на потолке
     счёт неполный, и экран это говорит. Одна таблица — положительная строка
     держит тот же поиск, что и отрицательная. */
  it.each([
    [90, true],
    [1, false],
  ])('%i голосований → оговорка о неполном счёте: %s', (count, shown) => {
    h.state.polls = Array.from({ length: count }, (_, i) => poll(i + 1, [1]));
    render(<StatsPage />);
    expect(screen.queryByText(/по последним/) !== null).toBe(shown);
  });
});

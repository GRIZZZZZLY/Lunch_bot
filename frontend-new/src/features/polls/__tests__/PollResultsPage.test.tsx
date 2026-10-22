import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { _resetBackButtonForTests } from '@/lib/backButton';

const h = vi.hoisted(() => ({
  params: { id: '7' } as Record<string, string | undefined>,
  state: {
    poll: null as unknown,
    pollLoading: false,
    results: null as unknown,
    resultsLoading: false,
    menu: [] as unknown[],
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => h.params,
  useNavigate: () => vi.fn(),
}));
vi.mock('@/hooks/usePolls', () => ({
  usePollById: () => ({ data: h.state.poll, isLoading: h.state.pollLoading }),
  usePollResults: () => ({ data: h.state.results, isLoading: h.state.resultsLoading }),
}));
vi.mock('@/hooks/useMenu', () => ({ useMenuItems: () => ({ data: h.state.menu }) }));
vi.mock('@/hooks/useSSE', () => ({ useSSE: () => undefined }));

import { PollResultsPage } from '../PollResultsPage';

const completedPoll = () => ({
  id: 7,
  status: 'COMPLETED',
  createdAt: '2026-07-10T10:00:00',
  menuItems: [
    { menuItemId: 1, menuItem: { id: 1, name: 'Плов', category: 'Горячее' }, _count: { votes: 2 } },
    { menuItemId: 2, menuItem: { id: 2, name: 'Суши', category: 'Роллы' }, _count: { votes: 1 } },
  ],
  votes: [
    { id: 1, userId: 1, menuItemId: 1, user: { id: 1, firstName: 'Игорь' } },
    { id: 2, userId: 2, menuItemId: 1, user: { id: 2, firstName: 'Оля' } },
    { id: 3, userId: 3, menuItemId: 2, user: { id: 3, firstName: 'Ян' } },
  ],
});

beforeEach(() => {
  _resetBackButtonForTests();
  delete window.Telegram;
  h.params.id = '7';
  h.state.poll = null;
  h.state.pollLoading = false;
  h.state.results = null;
  h.state.resultsLoading = false;
  h.state.menu = [];
});

describe('PollResultsPage — завершённый опрос', () => {
  it('nested-форма: ответственный из votes + кнопка «Крутить»', () => {
    h.state.poll = completedPoll();
    h.state.results = { result: { winnerMenuItemId: 1, responsibleUserId: 2, totalVotes: 3 } };
    render(<PollResultsPage />);
    expect(screen.getByText('Оля')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Крутить' })).toBeInTheDocument();
  });
});

/* Итоги опроса команды Б, открытые по ссылке, показываются в контексте Б:
   меню для названий блюд и соседние экраны должны быть той же команды. */
describe('PollResultsPage — команда опроса', () => {
  it('делает текущей команду опроса', async () => {
    const { useAppStore } = await import('@/store/useAppStore');
    useAppStore.setState({ currentGroupId: '1' });
    h.state.poll = { ...completedPoll(), groupId: '5' };

    render(<PollResultsPage />);

    expect(useAppStore.getState().currentGroupId).toBe('5');
  });
});

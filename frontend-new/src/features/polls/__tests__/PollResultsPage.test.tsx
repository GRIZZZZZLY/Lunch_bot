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

describe('PollResultsPage — состояния', () => {
  it('невалидный id → сообщение об ошибке', () => {
    h.params.id = 'abc';
    render(<PollResultsPage />);
    expect(screen.getByText('Некорректный идентификатор опроса.')).toBeInTheDocument();
  });

  /* Состояние загрузки молчит первые миллисекунды: на быстром ответе оно
     мелькало и читалось как лишний шаг перед результатами. */
  it('загрузка сначала молчит, потом → «Загружаем результаты…»', async () => {
    h.state.pollLoading = true;
    render(<PollResultsPage />);
    expect(screen.queryByText('Загружаем результаты…')).not.toBeInTheDocument();
    expect(await screen.findByText('Загружаем результаты…')).toBeInTheDocument();
  });

  it('нет опроса → «Опрос не найден.»', () => {
    render(<PollResultsPage />);
    expect(screen.getByText('Опрос не найден.')).toBeInTheDocument();
  });
});

describe('PollResultsPage — завершённый опрос', () => {
  it('талон победителя + распределение (flat-форма результата)', () => {
    h.state.poll = completedPoll();
    h.state.results = { winnerId: 1, winnerName: 'Плов', totalVotes: 3 };
    render(<PollResultsPage />);
    expect(screen.getByText('Команда выбрала')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Плов' })).toBeInTheDocument();
    expect(screen.getByText('2 голоса из 3')).toBeInTheDocument();
    expect(screen.getByText('победитель')).toBeInTheDocument();
    expect(screen.getByText('Суши')).toBeInTheDocument();
  });

  it('nested-форма: ответственный из votes + кнопка «Крутить»', () => {
    h.state.poll = completedPoll();
    h.state.results = { result: { winnerMenuItemId: 1, responsibleUserId: 2, totalVotes: 3 } };
    render(<PollResultsPage />);
    expect(screen.getByText('Оля')).toBeInTheDocument();
    expect(screen.getByText('выбран рулеткой')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Крутить' })).toBeInTheDocument();
  });

  it('активный опрос → заголовок «Лидирует»', () => {
    h.state.poll = { ...completedPoll(), status: 'ACTIVE' };
    render(<PollResultsPage />);
    expect(screen.getByText('Лидирует')).toBeInTheDocument();
  });
});

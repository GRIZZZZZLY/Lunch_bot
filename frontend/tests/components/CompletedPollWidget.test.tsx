import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompletedPollWidget } from '../../src/components/polls/CompletedPollWidget';
import type { PollWithDetails } from '../../src/services/polls.service';

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => ({
    colorScheme: 'light',
  }),
}));

const completedPoll: PollWithDetails = {
  id: 9,
  groupId: 2,
  title: 'Lunch',
  status: 'COMPLETED',
  duration: 30,
  startedAt: '2026-06-22T09:00:00.000Z',
  endedAt: '2026-06-22T09:30:00.000Z',
  createdAt: '2026-06-22T09:00:00.000Z',
  updatedAt: '2026-06-22T09:30:00.000Z',
  group: {
    id: 2,
    title: 'Team Two',
    telegramId: '2',
  },
  votes: [
    {
      id: 1,
      pollId: 9,
      userId: 1,
      menuItemId: 10,
      createdAt: '2026-06-22T09:05:00.000Z',
      user: {
        id: 1,
        telegramId: '1',
        firstName: 'Анна',
        lastName: 'Иванова',
      },
      menuItem: {
        id: 10,
        name: 'Pizza',
        price: 300,
      },
    },
    {
      id: 2,
      pollId: 9,
      userId: 2,
      menuItemId: 11,
      createdAt: '2026-06-22T09:06:00.000Z',
      user: {
        id: 2,
        telegramId: '2',
        firstName: 'Борис',
        lastName: 'Петров',
      },
      menuItem: {
        id: 11,
        name: 'Sushi',
        price: 450,
      },
    },
  ],
  results: [
    {
      id: 5,
      pollId: 9,
      winnerMenuItemId: 10,
      responsibleUserId: 1,
      totalVotes: 2,
      isRouletteRun: true,
      createdAt: '2026-06-22T09:31:00.000Z',
      winnerItem: {
        id: 10,
        name: 'Pizza',
        price: 300,
      },
      responsible: {
        id: 1,
        telegramId: '1',
        firstName: 'Анна',
        lastName: 'Иванова',
      },
    },
  ],
};

describe('CompletedPollWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('uses the loaded votes as the vote count when _count is missing', () => {
    const { container } = render(<CompletedPollWidget poll={completedPoll} />);

    expect(screen.getByText('Pizza')).toBeInTheDocument();
    expect(screen.getByText('Sushi')).toBeInTheDocument();
    expect(container).toHaveTextContent(/Участвовало:\s*2/);
    expect(container).toHaveTextContent(/Общая сумма:\s*750/);
  });

  it('starts as a compact result on Home and can expand or be dismissed', async () => {
    const onDismiss = vi.fn();
    render(
      <CompletedPollWidget
        poll={completedPoll}
        defaultCollapsed
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText('Pizza')).toBeInTheDocument();
    expect(screen.queryByText('Заказываем сегодня')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Скрыть виджет'));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Pizza/ }));
    expect(await screen.findByText('Заказываем сегодня')).toBeInTheDocument();
  });
});

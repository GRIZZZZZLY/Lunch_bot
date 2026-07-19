import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiWinnerResults } from '../../src/components/voting/MultiWinnerResults';
import type { MultiWinnerResultData } from '../../src/services/polls.service';

const { notificationOccurred } = vi.hoisted(() => ({
  notificationOccurred: vi.fn(),
}));

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => ({
    hapticFeedback: {
      notificationOccurred,
    },
  }),
}));

const resultData: MultiWinnerResultData = {
  version: 1,
  mode: 'multi-winner',
  winners: [
    {
      menuItemId: 10,
      menuItemName: 'Pizza',
      voterIds: [1, 2, 3, 4, 5, 6],
      voters: [
        { userId: 1, firstName: 'Анна' },
        { userId: 2, firstName: 'Борис' },
        { userId: 3, firstName: 'Вера' },
        { userId: 4, firstName: 'Глеб' },
        { userId: 5, firstName: 'Дима' },
        { userId: 6, firstName: 'Елена' },
      ],
      voteCount: 6,
      votedAt: [],
    },
  ],
  bringOwn: {
    voterIds: [7],
    voters: [{ userId: 7, firstName: 'Жанна' }],
    count: 1,
  },
  skipped: {
    voterIds: [8],
    voters: [{ userId: 8, firstName: 'Зоя' }],
    count: 1,
  },
  meta: {
    primaryWinnerId: 10,
    completedAt: '2026-06-22T09:30:00.000Z',
    completedBy: 1,
    params: {
      minVotes: 1,
      maxWinners: null,
    },
  },
};

describe('MultiWinnerResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows winner groups and expands long voter lists', () => {
    render(<MultiWinnerResults resultData={resultData} />);

    expect(screen.getByText('Pizza')).toBeInTheDocument();
    expect(screen.getByText('Анна')).toBeInTheDocument();
    expect(screen.queryByText('Елена')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Развернуть' }));

    expect(screen.getByText('Елена')).toBeInTheDocument();
  });

  it('shows bring-own and skipped voter names', () => {
    render(<MultiWinnerResults resultData={resultData} />);

    expect(screen.getByText('Жанна')).toBeInTheDocument();
    expect(screen.getByText('Зоя')).toBeInTheDocument();
  });

  it('copies winners, bring-own and skipped voters to clipboard', async () => {
    render(<MultiWinnerResults resultData={resultData} />);

    fireEvent.click(screen.getByRole('button', { name: /Копировать результаты/ }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    });

    const copiedText = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(copiedText).toContain('Pizza');
    expect(copiedText).toContain('Жанна');
    expect(copiedText).toContain('Зоя');
    expect(notificationOccurred).toHaveBeenCalledWith('success');
  });
});

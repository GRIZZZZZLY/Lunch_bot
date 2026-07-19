import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PollResults } from '../../src/components/polls/PollResults';
import type { Poll } from '../../src/services/polls.service';

const { apiGet, addNotification } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  addNotification: vi.fn(),
}));

vi.mock('../../src/services/api.service', () => ({
  apiService: {
    get: apiGet,
  },
}));

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => ({
    hapticFeedback: {
      impactOccurred: vi.fn(),
    },
    showAlert: vi.fn(),
  }),
}));

vi.mock('../../src/store/useAppStore', () => ({
  useUI: () => ({
    addNotification,
  }),
}));

const poll: Poll = {
  id: 7,
  groupId: 1,
  title: 'Обед',
  status: 'COMPLETED',
  duration: 30,
  startedAt: '2026-06-22T09:00:00.000Z',
  createdAt: '2026-06-22T09:00:00.000Z',
  updatedAt: '2026-06-22T09:30:00.000Z',
};

describe('PollResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders result and vote breakdown from the existing poll results endpoint', async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (url === '/polls/7/results') {
        return {
          success: true,
          data: {
            result: {
              id: 1,
              pollId: 7,
              winnerItemId: 10,
              responsibleId: 3,
              totalVotes: 3,
              isRouletteRun: true,
              createdAt: '2026-06-22T09:30:00.000Z',
              winnerItem: {
                id: 10,
                name: 'Борщ',
                price: 350,
              },
              responsible: {
                id: 3,
                firstName: 'Игорь',
                telegramId: '3',
              },
            },
            breakdown: [
              {
                menuItemId: 10,
                menuItemName: 'Борщ',
                votes: 2,
                percentage: 67,
                voters: [{ id: 3, firstName: 'Игорь' }],
              },
            ],
          },
        };
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<PollResults poll={poll} />);

    await waitFor(() => {
      expect(screen.getAllByText('Борщ').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Игорь/).length).toBeGreaterThan(0);
    expect(apiGet).toHaveBeenCalledWith('/polls/7/results');
    expect(apiGet).not.toHaveBeenCalledWith('/polls/7/breakdown');
  });

  it('exports results without calling a missing export endpoint', async () => {
    const createObjectURL = vi.fn(() => 'blob:poll-results');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    apiGet.mockResolvedValue({
      success: true,
      data: {
        result: {
          id: 1,
          pollId: 7,
          totalVotes: 1,
          isRouletteRun: true,
          createdAt: '2026-06-22T09:30:00.000Z',
          winnerItem: { id: 10, name: 'Борщ' },
        },
        breakdown: [
          {
            menuItemId: 10,
            menuItemName: 'Борщ',
            votes: 1,
            percentage: 100,
            voters: [{ id: 3, firstName: 'Игорь' }],
          },
        ],
      },
    });

    render(<PollResults poll={poll} />);

    await screen.findByText(/Победитель:/);
    fireEvent.click(screen.getByRole('button', { name: /Экспорт/ }));

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalled();
    });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:poll-results');
    expect(apiGet).not.toHaveBeenCalledWith(
      expect.stringContaining('/export'),
      expect.anything()
    );
  });
});

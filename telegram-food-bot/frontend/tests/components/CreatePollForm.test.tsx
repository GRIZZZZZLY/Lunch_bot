import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatePollForm } from '../../src/components/polls/CreatePollForm';

const {
  createPollFromWebApp,
  getActiveItems,
  getUserGroups,
  haptic,
  useCurrentGroupMock,
} = vi.hoisted(() => ({
  createPollFromWebApp: vi.fn(),
  getActiveItems: vi.fn(),
  getUserGroups: vi.fn(),
  haptic: {
    error: vi.fn(),
    impact: vi.fn(),
    selection: vi.fn(),
    success: vi.fn(),
  },
  useCurrentGroupMock: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      telegramId: '1',
      firstName: 'Admin',
      isAdmin: true,
      isActive: true,
      createdAt: '2026-06-22T00:00:00.000Z',
    },
  }),
}));

vi.mock('../../src/hooks/useCurrentGroup', () => ({
  useCurrentGroup: useCurrentGroupMock,
}));

vi.mock('../../src/hooks/useHaptic', () => ({
  useHaptic: () => haptic,
}));

vi.mock('../../src/services/menu.service', () => ({
  menuService: {
    getActiveItems,
  },
}));

vi.mock('../../src/services/user.service', () => ({
  userService: {
    getUserGroups,
  },
}));

vi.mock('../../src/services/polls.service', () => ({
  pollsService: {
    createPollFromWebApp,
  },
}));

vi.mock('../../src/components/polls/RecurringPollForm', () => ({
  RecurringPollForm: () => <div data-testid="recurring-poll-form" />,
}));

describe('CreatePollForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.className = '';
    useCurrentGroupMock.mockReturnValue({
      currentGroupId: null,
    });
    getUserGroups.mockResolvedValue({
      success: true,
      data: [
        {
          id: 2,
          title: 'Team Two',
          role: 'ADMIN',
          isActive: true,
        },
      ],
    });
    getActiveItems.mockResolvedValue({
      success: true,
      data: [
        {
          id: 10,
          groupId: 2,
          name: 'Pizza',
          isActive: true,
          createdAt: '2026-06-22T00:00:00.000Z',
          updatedAt: '2026-06-22T00:00:00.000Z',
        },
        {
          id: 11,
          groupId: 2,
          name: 'Sushi',
          isActive: true,
          createdAt: '2026-06-22T00:00:00.000Z',
          updatedAt: '2026-06-22T00:00:00.000Z',
        },
        {
          id: 12,
          groupId: 2,
          name: 'Soup',
          isActive: true,
          createdAt: '2026-06-22T00:00:00.000Z',
          updatedAt: '2026-06-22T00:00:00.000Z',
        },
        {
          id: 13,
          groupId: 2,
          name: 'Salad',
          isActive: true,
          createdAt: '2026-06-22T00:00:00.000Z',
          updatedAt: '2026-06-22T00:00:00.000Z',
        },
      ],
    });
    createPollFromWebApp.mockResolvedValue({
      success: true,
      data: {
        pollId: 77,
        messageId: 700,
        groupTitle: 'Team Two',
        duration: 30,
        menuItemsCount: 2,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads menu items for the first manageable group when current group is not selected yet', async () => {
    render(<CreatePollForm />);

    await waitFor(() => {
      expect(getActiveItems).toHaveBeenCalledWith(2);
    });
  });

  it('creates a one-time poll with selected menu items for the selected group', async () => {
    const onSuccess = vi.fn();
    render(<CreatePollForm onSuccess={onSuccess} />);

    fireEvent.click(await screen.findByRole('button', { name: /Далее/ }));
    fireEvent.click(await screen.findByText('Pizza'));
    fireEvent.click(screen.getByText('Sushi'));
    fireEvent.click(screen.getByRole('button', { name: /Запустить/ }));

    await waitFor(() => {
      expect(createPollFromWebApp).toHaveBeenCalledWith({
        groupId: 2,
        duration: 30,
        selectedMenuItems: [10, 11],
        title: 'Голосование за обед',
        isMultiSelect: true,
        maxSelections: 3,
      });
    });
    expect(onSuccess).toHaveBeenCalledWith(77);
    expect(haptic.success).toHaveBeenCalledTimes(1);
  });

  it('selects all loaded menu items before creating a poll', async () => {
    render(<CreatePollForm />);

    fireEvent.click(await screen.findByRole('button', { name: /Далее/ }));
    fireEvent.click(await screen.findByText('Выбрать всё'));
    fireEvent.click(screen.getByRole('button', { name: /Запустить/ }));

    await waitFor(() => {
      expect(createPollFromWebApp).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: 2,
          selectedMenuItems: [10, 11, 12, 13],
        })
      );
    });
  });

  it('selects a random menu subset before creating a poll', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    try {
      render(<CreatePollForm />);

      fireEvent.click(await screen.findByRole('button', { name: /Далее/ }));
      fireEvent.click(await screen.findByText('Случайно'));
      fireEvent.click(screen.getByRole('button', { name: /Запустить/ }));

      await waitFor(() => {
        expect(createPollFromWebApp).toHaveBeenCalledWith(
          expect.objectContaining({
            groupId: 2,
            selectedMenuItems: [10, 11, 12],
          })
        );
      });
    } finally {
      randomSpy.mockRestore();
    }
  });
});

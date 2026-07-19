import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecurringPollForm } from '../../src/components/polls/RecurringPollForm';
import type { MenuItem } from '../../src/services/menu.service';

const {
  createSchedule,
  getGroupSchedule,
  haptic,
  updateSchedule,
} = vi.hoisted(() => ({
  createSchedule: vi.fn(),
  getGroupSchedule: vi.fn(),
  haptic: {
    error: vi.fn(),
    impact: vi.fn(),
    success: vi.fn(),
  },
  updateSchedule: vi.fn(),
}));

vi.mock('../../src/hooks/useHaptic', () => ({
  useHaptic: () => haptic,
}));

vi.mock('../../src/services/recurring-poll.service', () => ({
  recurringPollService: {
    getGroupSchedule,
    createSchedule,
    updateSchedule,
  },
}));

const menuItems: MenuItem[] = [
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
];

describe('RecurringPollForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.className = '';
    updateSchedule.mockResolvedValue({
      success: true,
      data: {
        id: 5,
      },
    });
    createSchedule.mockResolvedValue({
      success: true,
      data: {
        id: 6,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads an existing schedule with JSON string menu item ids as selected dishes', async () => {
    getGroupSchedule.mockResolvedValue({
      success: true,
      data: {
        id: 5,
        groupId: 2,
        isEnabled: true,
        daysOfWeek: '[1,3]',
        timeOfDay: '12:15',
        duration: 45,
        selectedMenuItemIds: '[10,12]',
        lastRunAt: null,
        nextRunAt: null,
        lastRunStatus: null,
        lastRunMessage: null,
        createdBy: 1,
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
        group: {
          id: 2,
          telegramId: '2',
          title: 'Team Two',
        },
        creator: {
          id: 1,
          firstName: 'Admin',
          lastName: null,
          telegramId: '1',
        },
      },
    });

    render(
      <RecurringPollForm menuItems={menuItems} selectedGroupId={2} />
    );

    const saveButton = await screen.findByRole('button', {
      name: /Обновить расписание/,
    });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSchedule).toHaveBeenCalledWith(5, 2, {
        groupId: 2,
        daysOfWeek: [1, 3],
        timeOfDay: '12:15',
        duration: 45,
        selectedMenuItemIds: [10, 12],
      });
    });
  });

  it('creates a new schedule with default weekdays and all active menu items', async () => {
    const onSuccess = vi.fn();
    getGroupSchedule.mockResolvedValue({
      success: true,
      data: null,
    });

    render(
      <RecurringPollForm
        menuItems={menuItems}
        selectedGroupId={2}
        onSuccess={onSuccess}
      />
    );

    const saveButton = await screen.findByRole('button', {
      name: /Создать расписание/,
    });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(createSchedule).toHaveBeenCalledWith({
        groupId: 2,
        daysOfWeek: [1, 2, 3, 4, 5],
        timeOfDay: '11:00',
        duration: 30,
        selectedMenuItemIds: null,
      });
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(haptic.success).toHaveBeenCalledTimes(1);
  });
});

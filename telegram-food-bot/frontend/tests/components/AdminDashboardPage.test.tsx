import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboardPage } from '../../src/pages/AdminDashboardPage';

const {
  addNotification,
  adminServiceMocks,
  backButtonMocks,
  pollServiceMocks,
  userServiceMocks,
} = vi.hoisted(() => ({
  addNotification: vi.fn(),
  adminServiceMocks: {
    cleanupOldPolls: vi.fn(),
    cleanupOldTransactions: vi.fn(),
    forgiveDebt: vi.fn(),
    getAdminNotificationSettings: vi.fn(),
    getAllDebtors: vi.fn(),
    getAllUsers: vi.fn(),
    getCleanupStats: vi.fn(),
    getDebtStats: vi.fn(),
    getReminderSettings: vi.fn(),
    remindAllDebtors: vi.fn(),
    remindDebtor: vi.fn(),
    toggleActive: vi.fn(),
    toggleAdmin: vi.fn(),
    toggleParticipatesInPolls: vi.fn(),
    updateAdminNotificationSettings: vi.fn(),
    updateReminderSettings: vi.fn(),
  },
  backButtonMocks: {
    hide: vi.fn(),
    onClick: vi.fn(),
    show: vi.fn(),
  },
  pollServiceMocks: {
    getPollStats: vi.fn(),
  },
  userServiceMocks: {
    getUserGroups: vi.fn(),
  },
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    isLoading: false,
    user: {
      createdAt: '2026-06-01T00:00:00.000Z',
      firstName: 'Igor',
      id: 1,
      isActive: true,
      isAdmin: false,
      telegramId: '1',
    },
  }),
}));

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => ({
    backButton: backButtonMocks,
  }),
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (
    selector: (state: { addNotification: typeof addNotification }) => unknown
  ) =>
    selector({
      addNotification,
    }),
}));

vi.mock('../../src/services/admin.service', () => ({
  adminService: adminServiceMocks,
}));

vi.mock('../../src/services/polls.service', () => ({
  pollsService: pollServiceMocks,
}));

vi.mock('../../src/services/user.service', () => ({
  userService: userServiceMocks,
}));

const renderAdminDashboard = () =>
  render(
    <MemoryRouter initialEntries={['/admin/dashboard?groupId=2']}>
      <Routes>
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/profile" element={<div>Profile</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('AdminDashboardPage Mini App flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    userServiceMocks.getUserGroups.mockResolvedValue({
      success: true,
      data: [
        {
          id: 2,
          isActive: true,
          role: 'ADMIN',
          title: 'Rocket Lunch',
        },
      ],
    });
    pollServiceMocks.getPollStats.mockResolvedValue({
      success: true,
      data: {
        activePolls: 2,
        completedPolls: 10,
        totalPolls: 12,
        totalVotes: 40,
      },
    });
    adminServiceMocks.getAllUsers.mockResolvedValue({
      success: true,
      data: [
        {
          createdAt: '2026-06-01T00:00:00.000Z',
          firstName: 'Ivan',
          id: 5,
          isActive: true,
          isAdmin: false,
          lastActivity: '2026-06-25T12:00:00.000Z',
          lastName: 'Lunch',
          participatesInPolls: true,
          pendingDebts: 120,
          telegramId: '500',
          totalCredits: 0,
          totalDebts: 1,
          totalVotes: 7,
          updatedAt: '2026-06-25T12:00:00.000Z',
          username: 'ivan',
        },
      ],
    });
    adminServiceMocks.getAllDebtors.mockResolvedValue({
      success: true,
      data: [],
    });
    adminServiceMocks.getDebtStats.mockResolvedValue({
      success: true,
      data: {
        avgDebtPerUser: 0,
        oldestDebtAge: 0,
        totalDebtAmount: 0,
        totalDebtors: 0,
      },
    });
    adminServiceMocks.getCleanupStats.mockResolvedValue({
      success: true,
      data: {
        oldPolls: { count30Days: 0, count60Days: 0, count90Days: 0 },
        oldTransactions: { count30Days: 0, count60Days: 0, count90Days: 0 },
      },
    });
    adminServiceMocks.getReminderSettings.mockResolvedValue({
      success: true,
      data: {
        createdAt: '2026-06-01T00:00:00.000Z',
        groupId: 2,
        id: 1,
        intervalDays: 3,
        isEnabled: true,
        maxReminders: 5,
        messageTemplate: 'Hello {userName}',
        minDebtAge: 1,
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    });
    adminServiceMocks.getAdminNotificationSettings.mockResolvedValue({
      success: true,
      data: {
        createdAt: '2026-06-01T00:00:00.000Z',
        groupId: 2,
        id: 2,
        notifyOnDebtPaid: false,
        notifyOnNewPoll: false,
        notifyOnNewUser: true,
        notifyOnPollEnd: false,
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads the requested admin group and exposes dashboard sections', async () => {
    const user = userEvent.setup();

    renderAdminDashboard();

    await waitFor(() =>
      expect(adminServiceMocks.getAllUsers).toHaveBeenCalledWith(2)
    );

    expect(pollServiceMocks.getPollStats).toHaveBeenCalledWith(2);
    expect(adminServiceMocks.getAllDebtors).toHaveBeenCalledWith(2);
    expect(adminServiceMocks.getDebtStats).toHaveBeenCalledWith(2);
    expect(adminServiceMocks.getCleanupStats).toHaveBeenCalledWith(2);
    expect(adminServiceMocks.getReminderSettings).toHaveBeenCalledWith(2);
    expect(
      adminServiceMocks.getAdminNotificationSettings
    ).toHaveBeenCalledWith(2);

    expect(
      screen.getByRole('heading', { name: /Панель администратора/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Обзор/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Пользователи/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Долги/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Очистка/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Настройки/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Пользователи/i }));

    expect(await screen.findByText(/Ivan/i)).toBeInTheDocument();
  });
});

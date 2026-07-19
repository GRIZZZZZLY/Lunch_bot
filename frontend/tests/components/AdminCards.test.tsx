import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataCleanupCard } from '../../src/components/admin/DataCleanupCard';
import { DebtManagementCard } from '../../src/components/admin/DebtManagementCard';
import { ReminderSettingsCard } from '../../src/components/admin/ReminderSettingsCard';
import { UserManagementCard } from '../../src/components/admin/UserManagementCard';

const baseUser = {
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
};

describe('admin Mini App cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'scrollTo', {
      value: vi.fn(),
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('expands user details and runs user management actions', async () => {
    const user = userEvent.setup();
    const onToggleAdmin = vi.fn().mockResolvedValue(undefined);
    const onToggleActive = vi.fn().mockResolvedValue(undefined);
    const onToggleParticipates = vi.fn().mockResolvedValue(undefined);

    render(
      <UserManagementCard
        users={[baseUser]}
        onToggleAdmin={onToggleAdmin}
        onToggleActive={onToggleActive}
        onToggleParticipates={onToggleParticipates}
      />
    );

    await user.click(screen.getByRole('button', { name: /Подробнее/i }));
    await user.click(screen.getByRole('button', { name: /Сделать админом/i }));
    await user.click(screen.getByRole('button', { name: /Заблокировать/i }));
    await user.click(screen.getByRole('button', { name: /удалёнку/i }));

    expect(onToggleAdmin).toHaveBeenCalledWith(5, true);
    expect(onToggleActive).toHaveBeenCalledWith(5, false);
    expect(onToggleParticipates).toHaveBeenCalledWith(5, false);
  });

  it('expands debtor details by keyboard-accessible control and runs debt actions', async () => {
    const user = userEvent.setup();
    const onForgiveDebt = vi.fn().mockResolvedValue(undefined);
    const onRemindDebtor = vi.fn().mockResolvedValue(undefined);
    const onRemindAll = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <DebtManagementCard
        debtors={[
          {
            debtCount: 1,
            debts: [
              {
                amount: 150,
                createdAt: '2026-06-20T00:00:00.000Z',
                id: 9,
                pollId: 3,
                toUser: { firstName: 'Igor', id: 1 },
              },
            ],
            oldestDebt: '2026-06-20T00:00:00.000Z',
            telegramId: '500',
            totalDebt: 150,
            userId: 5,
            userName: 'Ivan Lunch',
          },
        ]}
        stats={{
          avgDebtPerUser: 150,
          oldestDebtAge: 6,
          totalDebtAmount: 150,
          totalDebtors: 1,
        }}
        onForgiveDebt={onForgiveDebt}
        onRemindDebtor={onRemindDebtor}
        onRemindAll={onRemindAll}
      />
    );

    await user.click(screen.getByRole('button', { name: /Ivan Lunch/i }));
    await user.click(screen.getByRole('button', { name: /Напомнить$/i }));
    await user.click(screen.getByRole('button', { name: /Списать/i }));

    expect(onRemindDebtor).toHaveBeenCalledWith(9);
    expect(onForgiveDebt).toHaveBeenCalledWith(9);
  });

  it('confirms cleanup before deleting old data', async () => {
    const user = userEvent.setup();
    const onCleanupPolls = vi.fn().mockResolvedValue(undefined);
    const onCleanupTransactions = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <DataCleanupCard
        stats={{
          oldPolls: { count30Days: 2, count60Days: 1, count90Days: 0 },
          oldTransactions: { count30Days: 4, count60Days: 3, count90Days: 2 },
        }}
        onCleanupPolls={onCleanupPolls}
        onCleanupTransactions={onCleanupTransactions}
      />
    );

    await user.click(screen.getByRole('button', { name: /старше 30/i }));
    await user.click(screen.getByRole('button', { name: /старше 90/i }));

    expect(onCleanupPolls).toHaveBeenCalledWith(30);
    expect(onCleanupTransactions).toHaveBeenCalledWith(90);
  });

  it('saves debt reminder and admin notification settings from accessible fields', async () => {
    const user = userEvent.setup();
    const onSaveReminderSettings = vi.fn().mockResolvedValue(undefined);
    const onSaveNotificationSettings = vi.fn().mockResolvedValue(undefined);

    render(
      <ReminderSettingsCard
        reminderSettings={{
          createdAt: '2026-06-01T00:00:00.000Z',
          groupId: 2,
          id: 1,
          intervalDays: 3,
          isEnabled: true,
          maxReminders: 5,
          messageTemplate: 'Hello {userName}',
          minDebtAge: 1,
          updatedAt: '2026-06-01T00:00:00.000Z',
        }}
        notificationSettings={{
          createdAt: '2026-06-01T00:00:00.000Z',
          groupId: 2,
          id: 2,
          notifyOnDebtPaid: false,
          notifyOnNewPoll: false,
          notifyOnNewUser: true,
          notifyOnPollEnd: false,
          updatedAt: '2026-06-01T00:00:00.000Z',
        }}
        onSaveReminderSettings={onSaveReminderSettings}
        onSaveNotificationSettings={onSaveNotificationSettings}
      />
    );

    await user.clear(screen.getByLabelText(/Интервал напоминаний/i));
    await user.type(screen.getByLabelText(/Интервал напоминаний/i), '4');
    const messageTemplateInput = screen.getByLabelText(/Шаблон сообщения/i);
    await user.clear(messageTemplateInput);
    fireEvent.change(messageTemplateInput, {
      target: { value: 'Debt {totalAmount}' },
    });
    await user.click(
      screen.getByLabelText(/Автоматические напоминания о долгах/i)
    );
    await user.click(screen.getByLabelText(/Оплата долгов/i));
    await user.click(screen.getByRole('button', { name: /Сохранить/i }));

    await waitFor(() =>
      expect(onSaveReminderSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          intervalDays: 4,
          isEnabled: false,
          messageTemplate: 'Debt {totalAmount}',
        })
      )
    );
    expect(onSaveNotificationSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        notifyOnDebtPaid: true,
      })
    );
  });
});

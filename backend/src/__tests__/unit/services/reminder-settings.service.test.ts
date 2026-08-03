/**
 * Настройки напоминаний о долгах и админских уведомлений.
 *
 * Смысл тестов здесь — в значениях по умолчанию. Настройки создаются лениво, при
 * первом обращении, и именно эти дефолты решают, будет ли команда получать
 * напоминания вообще: напоминания о долгах включены (иначе долги тихо копятся),
 * а шумные админские уведомления, кроме «пришёл новый участник», выключены.
 * Смена любого из этих значений меняет поведение для всех групп сразу.
 */
import { ReminderSettingsService } from '../../../services/reminder-settings.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logger } = jest.requireMock('../../../utils/logger');

const service = new ReminderSettingsService();

const REMINDER_SETTINGS = {
  isEnabled: false,
  intervalDays: 7,
  messageTemplate: 'Напоминание: {totalAmount}',
  minDebtAge: 3,
  maxReminders: 2,
};

const ADMIN_SETTINGS = {
  notifyOnNewUser: false,
  notifyOnNewPoll: true,
  notifyOnPollEnd: true,
  notifyOnDebtPaid: true,
};

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();

  asMock(prismaMock.debtReminderSettings.findUnique).mockResolvedValue(null);
  asMock(prismaMock.debtReminderSettings.findMany).mockResolvedValue([]);
  asMock(prismaMock.debtReminderSettings.create).mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: 1, ...args.data })) as never);
  asMock(prismaMock.debtReminderSettings.upsert).mockImplementation((async (args: {
    create: Record<string, unknown>;
  }) => ({ id: 1, ...args.create })) as never);
  asMock(prismaMock.adminNotificationSettings.findUnique).mockResolvedValue(null);
  asMock(prismaMock.adminNotificationSettings.create).mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: 1, ...args.data })) as never);
  asMock(prismaMock.adminNotificationSettings.upsert).mockImplementation((async (args: {
    create: Record<string, unknown>;
  }) => ({ id: 1, ...args.create })) as never);
});

describe('настройки напоминаний о долгах', () => {
  it('существующие настройки отдаются как есть', async () => {
    asMock(prismaMock.debtReminderSettings.findUnique).mockResolvedValue({
      id: 1,
      groupId: 100,
      isEnabled: false,
    });

    await expect(service.getReminderSettings(100)).resolves.toMatchObject({
      isEnabled: false,
    });
    expect(asMock(prismaMock.debtReminderSettings.create)).not.toHaveBeenCalled();
  });

  it('первое обращение создаёт настройки с напоминаниями ВКЛЮЧЕННЫМИ', async () => {
    const settings = await service.getReminderSettings(100, 7);

    expect(settings).toMatchObject({
      groupId: 100,
      isEnabled: true,
      intervalDays: 3,
      minDebtAge: 1,
      maxReminders: 5,
      createdBy: 7,
    });
  });

  it('шаблон по умолчанию содержит все подстановки', async () => {
    const settings = (await service.getReminderSettings(100, 7)) as {
      messageTemplate: string;
    };

    for (const token of [
      '{userName}',
      '{totalAmount}',
      '{debtsList}',
      '{oldestDebtAge}',
    ]) {
      expect(settings.messageTemplate).toContain(token);
    }
  });

  it('без администратора автор фиксируется нулём и остаётся след в логе', async () => {
    const settings = await service.getReminderSettings(100);

    expect(settings).toMatchObject({ createdBy: 0 });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('without adminId')
    );
  });

  it('с администратором предупреждения нет', async () => {
    await service.getReminderSettings(100, 7);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('обновление сохраняет переданные значения', async () => {
    await service.updateReminderSettings(100, REMINDER_SETTINGS, 7);

    expect(asMock(prismaMock.debtReminderSettings.upsert)).toHaveBeenCalledWith({
      where: { groupId: 100 },
      update: REMINDER_SETTINGS,
      create: { groupId: 100, ...REMINDER_SETTINGS, createdBy: 7 },
    });
  });

  it('обновление для группы без настроек их создаёт', async () => {
    const settings = await service.updateReminderSettings(
      100,
      REMINDER_SETTINGS,
      7
    );

    expect(settings).toMatchObject({ groupId: 100, createdBy: 7 });
  });

  it('сбой чтения пробрасывается и логируется', async () => {
    asMock(prismaMock.debtReminderSettings.findUnique).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getReminderSettings(100)).rejects.toThrow('db down');
    expect(logger.error).toHaveBeenCalledWith(
      '[ReminderSettingsService] Error getting settings:',
      expect.any(Error)
    );
  });

  it('сбой записи пробрасывается и логируется', async () => {
    asMock(prismaMock.debtReminderSettings.upsert).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      service.updateReminderSettings(100, REMINDER_SETTINGS, 7)
    ).rejects.toThrow('db down');
    expect(logger.error).toHaveBeenCalledWith(
      '[ReminderSettingsService] Error updating settings:',
      expect.any(Error)
    );
  });
});

describe('админские уведомления', () => {
  it('по умолчанию включено только уведомление о новом участнике', async () => {
    const settings = await service.getAdminNotificationSettings(100);

    expect(settings).toMatchObject({
      groupId: 100,
      notifyOnNewUser: true,
      notifyOnNewPoll: false,
      notifyOnPollEnd: false,
      notifyOnDebtPaid: false,
    });
  });

  it('существующие настройки не перезаписываются дефолтами', async () => {
    asMock(prismaMock.adminNotificationSettings.findUnique).mockResolvedValue({
      id: 1,
      groupId: 100,
      notifyOnNewUser: false,
    });

    await expect(
      service.getAdminNotificationSettings(100)
    ).resolves.toMatchObject({ notifyOnNewUser: false });
    expect(
      asMock(prismaMock.adminNotificationSettings.create)
    ).not.toHaveBeenCalled();
  });

  it('обновление сохраняет переданные флаги', async () => {
    await service.updateAdminNotificationSettings(100, ADMIN_SETTINGS);

    expect(
      asMock(prismaMock.adminNotificationSettings.upsert)
    ).toHaveBeenCalledWith({
      where: { groupId: 100 },
      update: ADMIN_SETTINGS,
      create: { groupId: 100, ...ADMIN_SETTINGS },
    });
  });

  it('сбой чтения пробрасывается и логируется', async () => {
    asMock(prismaMock.adminNotificationSettings.findUnique).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getAdminNotificationSettings(100)).rejects.toThrow(
      'db down'
    );
    expect(logger.error).toHaveBeenCalledWith(
      '[ReminderSettingsService] Error getting admin settings:',
      expect.any(Error)
    );
  });

  it('сбой записи пробрасывается и логируется', async () => {
    asMock(prismaMock.adminNotificationSettings.upsert).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      service.updateAdminNotificationSettings(100, ADMIN_SETTINGS)
    ).rejects.toThrow('db down');
    expect(logger.error).toHaveBeenCalledWith(
      '[ReminderSettingsService] Error updating admin settings:',
      expect.any(Error)
    );
  });
});

describe('getGroupsWithEnabledReminders', () => {
  it('отдаются только группы с включёнными напоминаниями, вместе с группой', async () => {
    asMock(prismaMock.debtReminderSettings.findMany).mockResolvedValue([
      { id: 1, groupId: 100, group: { id: 100, title: 'Обед' } },
    ]);

    await expect(service.getGroupsWithEnabledReminders()).resolves.toHaveLength(1);
    expect(asMock(prismaMock.debtReminderSettings.findMany)).toHaveBeenCalledWith({
      where: { isEnabled: true },
      include: { group: true },
    });
  });

  it('сбой чтения пробрасывается и логируется', async () => {
    asMock(prismaMock.debtReminderSettings.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getGroupsWithEnabledReminders()).rejects.toThrow(
      'db down'
    );
    expect(logger.error).toHaveBeenCalledWith(
      '[ReminderSettingsService] Error getting enabled groups:',
      expect.any(Error)
    );
  });
});

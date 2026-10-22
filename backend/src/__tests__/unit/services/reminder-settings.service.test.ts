/**
 * Настройки напоминаний о долгах и админских уведомлений.
 *
 * Настройки создаются лениво, при первом обращении, и дефолты решают, будет ли
 * команда получать напоминания вообще. Чтение и запись через API проверяет
 * integration/api/notifications.routes.test.ts; здесь остались дефолты.
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

const service = new ReminderSettingsService();

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();

  asMock(prismaMock.debtReminderSettings.findUnique).mockResolvedValue(null);
  asMock(prismaMock.debtReminderSettings.findMany).mockResolvedValue([]);
  asMock(prismaMock.debtReminderSettings.create).mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: 1, ...args.data })) as never);
  asMock(prismaMock.adminNotificationSettings.findUnique).mockResolvedValue(null);
  asMock(prismaMock.adminNotificationSettings.create).mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: 1, ...args.data })) as never);
});

describe('настройки напоминаний о долгах', () => {
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

  it('без администратора автор фиксируется нулём', async () => {
    const settings = await service.getReminderSettings(100);

    expect(settings).toMatchObject({ createdBy: 0 });
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
});

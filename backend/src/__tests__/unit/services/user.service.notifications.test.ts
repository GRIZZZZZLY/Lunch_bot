/**
 * Уведомление админов о новом участнике и чтение платёжных данных.
 * Базовый CRUD пользователя закреплён в user.service.test.ts — здесь то, что
 * осталось непокрытым.
 *
 * Главное свойство рассылки: она fire-and-forget. Человек вошёл в приложение и
 * не должен видеть ошибку из-за того, что кто-то из админов заблокировал бота
 * или Telegram недоступен — поэтому проверяется, что upsertUser доходит до
 * конца при любом сбое внутри рассылки.
 *
 * Второе: маскирование платёжных данных. В базе они лежат зашифрованными, а
 * наружу отдаются только последние цифры — тест закрепляет, что полный номер
 * карты в ответ не попадает.
 */
import { UserService } from '../../../services/user.service';
import { EncryptionService } from '../../../utils/encryption';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logger } = jest.requireMock('../../../utils/logger');

const api = { sendMessage: jest.fn() };

const NEW_USER = {
  telegramId: '555',
  username: 'ivan',
  firstName: 'Иван',
  lastName: 'Петров',
};

function admins(rows: Array<{ id: number; telegramId: bigint }>) {
  asMock(prismaMock.user.findMany).mockResolvedValue(rows);
}

/** Ждёт fire-and-forget рассылку, запущенную из upsertUser. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();

  asMock(getBotInstance).mockReturnValue({ api });
  api.sendMessage.mockResolvedValue({ message_id: 1 });

  // Пользователя ещё нет — значит новый.
  asMock(prismaMock.user.findUnique).mockResolvedValue(null);
  asMock(prismaMock.user.upsert).mockResolvedValue({
    id: 7,
    telegramId: 555n,
    firstName: 'Иван',
    lastName: 'Петров',
    username: 'ivan',
  });
  asMock(prismaMock.user.findMany).mockResolvedValue([]);
  asMock(prismaMock.adminNotificationSettings.findUnique).mockResolvedValue(null);
});

describe('уведомление админов о новом участнике', () => {
  it('новому участнику радуются все админы группы', async () => {
    admins([
      { id: 1, telegramId: 111n },
      { id: 2, telegramId: 222n },
    ]);

    await UserService.upsertUser(NEW_USER, 100);
    await flush();

    expect(api.sendMessage).toHaveBeenCalledTimes(2);
    const [chatId, text] = api.sendMessage.mock.calls[0];
    expect(chatId).toBe('111');
    expect(text).toContain('Новый пользователь');
    expect(text).toContain('Иван Петров');
    expect(text).toContain('@ivan');
  });

  it('участник без фамилии и username не ломает текст', async () => {
    admins([{ id: 1, telegramId: 111n }]);
    asMock(prismaMock.user.upsert).mockResolvedValue({
      id: 7,
      telegramId: 555n,
      firstName: 'Иван',
      lastName: null,
      username: null,
    });

    await UserService.upsertUser(
      { telegramId: '555', firstName: 'Иван' },
      100
    );
    await flush();

    expect(api.sendMessage.mock.calls[0][1]).toContain('👤 Иван');
    expect(api.sendMessage.mock.calls[0][1]).not.toContain('@');
  });

  it('уведомления ищут только активных админов именно этой группы', async () => {
    admins([{ id: 1, telegramId: 111n }]);

    await UserService.upsertUser(NEW_USER, 100);
    await flush();

    expect(asMock(prismaMock.user.findMany)).toHaveBeenCalledWith({
      where: {
        isAdmin: true,
        isActive: true,
        groupMemberships: { some: { groupId: 100, isActive: true } },
      },
    });
  });

  it('вернувшийся участник за нового не считается', async () => {
    asMock(prismaMock.user.findUnique).mockResolvedValue({ id: 7 });
    admins([{ id: 1, telegramId: 111n }]);

    await UserService.upsertUser(NEW_USER, 100);
    await flush();

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('вход без группы никого не уведомляет', async () => {
    admins([{ id: 1, telegramId: 111n }]);

    await UserService.upsertUser(NEW_USER);
    await flush();

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('выключенные в настройках группы уведомления не отправляются', async () => {
    asMock(prismaMock.adminNotificationSettings.findUnique).mockResolvedValue({
      groupId: 100,
      notifyOnNewUser: false,
    });
    admins([{ id: 1, telegramId: 111n }]);

    await UserService.upsertUser(NEW_USER, 100);
    await flush();

    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(asMock(prismaMock.user.findMany)).not.toHaveBeenCalled();
  });

  it('включённые в настройках уведомления отправляются', async () => {
    asMock(prismaMock.adminNotificationSettings.findUnique).mockResolvedValue({
      groupId: 100,
      notifyOnNewUser: true,
    });
    admins([{ id: 1, telegramId: 111n }]);

    await UserService.upsertUser(NEW_USER, 100);
    await flush();

    expect(api.sendMessage).toHaveBeenCalled();
  });

  it('группа без админов — просто запись в лог', async () => {
    await UserService.upsertUser(NEW_USER, 100);
    await flush();

    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      '[UserService] No admins found for group 100'
    );
  });

  it('без бота рассылка молча пропускается', async () => {
    admins([{ id: 1, telegramId: 111n }]);
    asMock(getBotInstance).mockReturnValue(null);

    await expect(UserService.upsertUser(NEW_USER, 100)).resolves.toMatchObject({
      id: 7,
    });
    await flush();

    expect(logger.error).toHaveBeenCalledWith(
      '[UserService] Bot instance not available'
    );
  });

  it('админ, заблокировавший бота, не мешает уведомить остальных', async () => {
    admins([
      { id: 1, telegramId: 111n },
      { id: 2, telegramId: 222n },
    ]);
    api.sendMessage
      .mockRejectedValueOnce(new Error('bot blocked by user'))
      .mockResolvedValue({ message_id: 1 });

    await UserService.upsertUser(NEW_USER, 100);
    await flush();

    expect(api.sendMessage).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      '[UserService] Sent new user notifications to 1/2 admins'
    );
  });

  it('сбой рассылки не срывает вход пользователя', async () => {
    asMock(prismaMock.user.findMany).mockRejectedValue(new Error('db down'));

    await expect(UserService.upsertUser(NEW_USER, 100)).resolves.toMatchObject({
      id: 7,
    });
    await flush();

    expect(logger.error).toHaveBeenCalledWith(
      'Error sending new user notifications:',
      expect.any(Error)
    );
  });

  it('сбой самого upsert превращается в понятную ошибку', async () => {
    asMock(prismaMock.user.upsert).mockRejectedValue(new Error('db down'));

    await expect(UserService.upsertUser(NEW_USER, 100)).rejects.toThrow(
      'Failed to create or update user'
    );
  });
});

describe('пакетное чтение пользователей', () => {
  it('пустой список в БД не идёт', async () => {
    await expect(UserService.getUsersByIds([])).resolves.toEqual([]);

    expect(asMock(prismaMock.user.findMany)).not.toHaveBeenCalled();
  });

  it('список читается одним запросом, а не по одному', async () => {
    asMock(prismaMock.user.findMany).mockResolvedValue([{ id: 1 }, { id: 2 }]);

    await expect(UserService.getUsersByIds([1, 2])).resolves.toHaveLength(2);
    expect(asMock(prismaMock.user.findMany)).toHaveBeenCalledTimes(1);
    expect(asMock(prismaMock.user.findMany)).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
    });
  });

  it('сбой чтения превращается в понятную ошибку', async () => {
    asMock(prismaMock.user.findMany).mockRejectedValue(new Error('db down'));

    await expect(UserService.getUsersByIds([1])).rejects.toThrow(
      'Failed to get users'
    );
  });
});

describe('участники группы', () => {
  it('отдаются только активные, по алфавиту', async () => {
    asMock(prismaMock.user.findMany).mockResolvedValue([{ id: 1 }]);

    await UserService.getActiveUsersInGroup(100);

    expect(asMock(prismaMock.user.findMany)).toHaveBeenCalledWith({
      where: {
        isActive: true,
        groupMemberships: { some: { groupId: 100, isActive: true } },
      },
      orderBy: { firstName: 'asc' },
    });
  });

  it('getUsersByGroupId — тот же список', async () => {
    asMock(prismaMock.user.findMany).mockResolvedValue([{ id: 1 }]);

    await expect(UserService.getUsersByGroupId(100)).resolves.toEqual([
      { id: 1 },
    ]);
  });

  it('сбой чтения превращается в понятную ошибку', async () => {
    asMock(prismaMock.user.findMany).mockRejectedValue(new Error('db down'));

    await expect(UserService.getActiveUsersInGroup(100)).rejects.toThrow(
      'Failed to get active users in group'
    );
  });
});

describe('маскированные платёжные данные', () => {
  it('наружу уходят только последние цифры карты', async () => {
    const card = EncryptionService.encrypt('2200123456789012');
    asMock(prismaMock.user.findUnique).mockResolvedValue({
      paymentCard: card,
      paymentPhone: null,
      paymentDetails: null,
    });

    const masked = await UserService.getMaskedPaymentInfo(7);

    expect(masked?.paymentCard).not.toContain('2200123456789012');
    expect(masked?.paymentCard).toContain('9012');
  });

  it('телефон тоже маскируется', async () => {
    asMock(prismaMock.user.findUnique).mockResolvedValue({
      paymentCard: null,
      paymentPhone: EncryptionService.encrypt('+79990001122'),
      paymentDetails: null,
    });

    const masked = await UserService.getMaskedPaymentInfo(7);

    expect(masked?.paymentPhone).not.toContain('9990001122');
    expect(masked?.paymentPhone).toBe('+7 *** ***-11-22');
  });

  it('свободное описание расшифровывается целиком: маскировать там нечего', async () => {
    asMock(prismaMock.user.findUnique).mockResolvedValue({
      paymentCard: null,
      paymentPhone: null,
      paymentDetails: EncryptionService.encrypt('Перевод по СБП, Сбер'),
    });

    await expect(UserService.getMaskedPaymentInfo(7)).resolves.toMatchObject({
      paymentDetails: 'Перевод по СБП, Сбер',
    });
  });

  it('незаполненные реквизиты остаются null', async () => {
    asMock(prismaMock.user.findUnique).mockResolvedValue({
      paymentCard: null,
      paymentPhone: null,
      paymentDetails: null,
    });

    await expect(UserService.getMaskedPaymentInfo(7)).resolves.toEqual({
      paymentCard: null,
      paymentPhone: null,
      paymentDetails: null,
    });
  });

  it('несуществующий пользователь — null, а не пустые реквизиты', async () => {
    asMock(prismaMock.user.findUnique).mockResolvedValue(null);

    await expect(UserService.getMaskedPaymentInfo(7)).resolves.toBeNull();
  });

  it('сбой чтения превращается в понятную ошибку', async () => {
    asMock(prismaMock.user.findUnique).mockRejectedValue(new Error('db down'));

    await expect(UserService.getMaskedPaymentInfo(7)).rejects.toThrow(
      'Failed to get payment info'
    );
  });
});

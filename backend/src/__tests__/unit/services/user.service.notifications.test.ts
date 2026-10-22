/**
 * Уведомление админов о новом участнике.
 *
 * Главное свойство рассылки: она fire-and-forget. Человек вошёл в приложение и
 * не должен видеть ошибку из-за того, что кто-то из админов заблокировал бота
 * или Telegram недоступен — поэтому проверяется, что upsertUser доходит до
 * конца при любом сбое внутри рассылки.
 */
import { UserService } from '../../../services/user.service';
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

    expect(api.sendMessage.mock.calls.map(([chatId]) => chatId)).toEqual(['111', '222']);
  });

  /* Уведомление уходит на Markdown, а имя и логин приходят из Telegram: без
     экранирования админ не узнаёт о новом участнике вообще. */
  it('спецсимволы в имени и логине экранируются', async () => {
    admins([{ id: 1, telegramId: 111n }]);
    asMock(prismaMock.user.upsert).mockResolvedValue({
      id: 7,
      telegramId: 555n,
      firstName: 'Соус_острый',
      lastName: 'С*ов',
      username: 'ivan_p',
    });

    await UserService.upsertUser(NEW_USER, 100);
    await flush();

    const text = api.sendMessage.mock.calls[0][1] as string;
    expect(text).toContain('Соус\\_острый С\\*ов');
    expect(text).toContain('@ivan\\_p');
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

  it('без бота рассылка молча пропускается', async () => {
    admins([{ id: 1, telegramId: 111n }]);
    asMock(getBotInstance).mockReturnValue(null);

    await expect(UserService.upsertUser(NEW_USER, 100)).resolves.toMatchObject({
      id: 7,
    });
    await flush();
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

    expect(api.sendMessage.mock.calls.map(([chatId]) => chatId)).toEqual(['111', '222']);
  });

  it('сбой рассылки не срывает вход пользователя', async () => {
    asMock(prismaMock.user.findMany).mockRejectedValue(new Error('db down'));

    await expect(UserService.upsertUser(NEW_USER, 100)).resolves.toMatchObject({
      id: 7,
    });
    await flush();
  });
});

describe('пакетное чтение пользователей', () => {
  it('пустой список в БД не идёт', async () => {
    await expect(UserService.getUsersByIds([])).resolves.toEqual([]);

    expect(asMock(prismaMock.user.findMany)).not.toHaveBeenCalled();
  });
});

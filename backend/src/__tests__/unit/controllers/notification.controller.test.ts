/**
 * Напоминание админам «пора создать голосование». Здесь важен cooldown: он
 * общий на группу, а не на пользователя, иначе десять человек нажмут кнопку и
 * админ получит десять сообщений подряд.
 */
import { notificationController } from '../../../api/controllers/notification.controller';
import { GroupService } from '../../../services/group.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { mockRequest, mockResponse } from '../../helpers/http';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupMember: jest.fn() },
}));

/**
 * Раньше здесь подменялся весь `notification.service` объектом
 * `{ notificationService: { bot: undefined } }`, потому что контроллер читал
 * приватное поле сервиса: `(notificationService as any).bot`. Мок делал тест
 * зелёным независимо от того, есть ли у сервиса такое поле вообще, — то есть
 * продакшен-путь получения бота не проверялся ничем.
 */
jest.mock('../../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const groupService = GroupService as jest.Mocked<typeof GroupService>;
const mockedGetBotInstance = getBotInstance as jest.MockedFunction<
  typeof getBotInstance
>;

const USER = { id: 1, isAdmin: false };
const NOW = new Date('2026-08-02T12:00:00.000Z');

let sendMessage: jest.Mock;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  sendMessage = jest.fn().mockResolvedValue(undefined);
  mockedGetBotInstance.mockReturnValue({ api: { sendMessage } } as never);

  groupService.isUserGroupMember.mockResolvedValue(true);
  prismaMock.user.findUnique.mockResolvedValue({
    id: 1,
    firstName: 'Игорь',
    username: 'igor',
    isActive: true,
  } as never);
  prismaMock.group.findUnique.mockResolvedValue({
    id: 100,
    title: 'Команда',
  } as never);
  prismaMock.adminReminder.findFirst.mockResolvedValue(null);
  prismaMock.groupMember.findMany.mockResolvedValue([
    {
      user: { id: 2, telegramId: BigInt(2222), isActive: true },
    },
  ] as never);
  prismaMock.adminReminder.create.mockResolvedValue({ id: 1 } as never);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('POST /api/notifications/remind-admin', () => {
  it('рассылает напоминание всем активным админам группы', async () => {
    const res = mockResponse();

    await notificationController.remindAdmin(
      mockRequest({ user: USER, body: { groupId: 100 } }),
      res
    );

    // Именно number: BigInt из базы не сериализуется в JSON, и рассылка
    // молча заканчивалась нулём доставленных при ответе 200.
    expect(sendMessage).toHaveBeenCalledWith(
      2222,
      expect.stringContaining('Игорь'),
      { parse_mode: 'Markdown' }
    );
    expect(typeof sendMessage.mock.calls[0][0]).toBe('number');
    expect(res.body).toMatchObject({ success: true, data: { sentCount: 1 } });
  });

  it('имя и название группы экранируются для Markdown', async () => {
    // Группа `Обед_дня` в legacy-Markdown даёт `can't parse entities`, и
    // напоминание не доходит НИ ОДНОМУ админу — молча, с ответом 200.
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      firstName: 'Игорь_К',
      username: 'igor',
      isActive: true,
    } as never);
    prismaMock.group.findUnique.mockResolvedValue({
      id: 100,
      title: 'Обед_дня *акция*',
    } as never);

    await notificationController.remindAdmin(
      mockRequest({ user: USER, body: { groupId: 100 } }),
      mockResponse()
    );

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('Игорь\\_К');
    expect(message).toContain('Обед\\_дня \\*акция\\*');
  });

  it('запись о напоминании сохраняется — на ней держится cooldown', async () => {
    await notificationController.remindAdmin(
      mockRequest({ user: USER, body: { groupId: 100 } }),
      mockResponse()
    );

    expect(prismaMock.adminReminder.create).toHaveBeenCalledWith({
      data: { userId: 1, groupId: 100 },
    });
  });

  it('cooldown общий для группы: напоминание другого участника блокирует запрос', async () => {
    prismaMock.adminReminder.findFirst.mockResolvedValue({
      id: 1,
      createdAt: new Date(NOW.getTime() - 10 * 60 * 1000),
      user: { id: 9, firstName: 'Аня', username: null },
    } as never);
    const res = mockResponse();

    await notificationController.remindAdmin(
      mockRequest({ user: USER, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({
      success: false,
      minutesLeft: 20,
      error: expect.stringContaining('Аня'),
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('cooldown ищется по группе без привязки к пользователю', async () => {
    await notificationController.remindAdmin(
      mockRequest({ user: USER, body: { groupId: 100 } }),
      mockResponse()
    );

    const where = prismaMock.adminReminder.findFirst.mock.calls[0][0]?.where;
    expect(where).toMatchObject({ groupId: 100 });
    expect(where).not.toHaveProperty('userId');
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await notificationController.remindAdmin(
      mockRequest({ body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['без groupId', {}],
    ['нулевой groupId', { groupId: 0 }],
    ['нечисловой groupId', { groupId: 'нет' }],
    ['дробный groupId', { groupId: 1.5 }],
  ])('%s — 400', async (_label, body) => {
    const res = mockResponse();

    await notificationController.remindAdmin(
      mockRequest({ user: USER, body }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('пользователя нет в базе — 404', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await notificationController.remindAdmin(
      mockRequest({ user: USER, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('группы нет — 404', async () => {
    prismaMock.group.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await notificationController.remindAdmin(
      mockRequest({ user: USER, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не участник группы — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await notificationController.remindAdmin(
      mockRequest({ user: USER, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('в группе нет активных админов — 404', async () => {
    prismaMock.groupMember.findMany.mockResolvedValue([
      { user: { id: 2, telegramId: BigInt(1), isActive: false } },
    ] as never);
    const res = mockResponse();

    await notificationController.remindAdmin(
      mockRequest({ user: USER, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ error: 'No admins found' });
  });

  it('бот не поднят — 500, и напоминание не записывается', async () => {
    mockedGetBotInstance.mockReturnValue(null);
    const res = mockResponse();

    await notificationController.remindAdmin(
      mockRequest({ user: USER, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(prismaMock.adminReminder.create).not.toHaveBeenCalled();
  });

  it('падение отправки одному админу не отменяет рассылку остальным', async () => {
    prismaMock.groupMember.findMany.mockResolvedValue([
      { user: { id: 2, telegramId: BigInt(2), isActive: true } },
      { user: { id: 3, telegramId: BigInt(3), isActive: true } },
    ] as never);
    sendMessage
      .mockRejectedValueOnce(new Error('blocked'))
      .mockResolvedValueOnce(undefined);
    const res = mockResponse();

    await notificationController.remindAdmin(
      mockRequest({ user: USER, body: { groupId: 100 } }),
      res
    );

    expect(res.body).toMatchObject({ data: { sentCount: 1 } });
  });

  it('ошибка базы — 500', async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error('db down'));
    const res = mockResponse();

    await notificationController.remindAdmin(
      mockRequest({ user: USER, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/notifications/cooldown/:groupId', () => {
  it('активный cooldown отдаёт остаток и автора напоминания', async () => {
    prismaMock.adminReminder.findFirst.mockResolvedValue({
      id: 1,
      createdAt: new Date(NOW.getTime() - 5 * 60 * 1000),
      user: { id: 9, firstName: 'Аня', username: null },
    } as never);
    const res = mockResponse();

    await notificationController.getCooldownStatus(
      mockRequest({ user: USER, params: { groupId: '100' } }),
      res
    );

    expect(res.body).toMatchObject({
      success: true,
      data: {
        isActive: true,
        secondsLeft: 25 * 60,
        minutesLeft: 25,
        lastReminderBy: { id: 9, name: 'Аня' },
      },
    });
  });

  it('без имени и логина автор подписан обобщённо', async () => {
    prismaMock.adminReminder.findFirst.mockResolvedValue({
      id: 1,
      createdAt: NOW,
      user: { id: 9, firstName: null, username: null },
    } as never);
    const res = mockResponse();

    await notificationController.getCooldownStatus(
      mockRequest({ user: USER, params: { groupId: '100' } }),
      res
    );

    expect(res.body).toMatchObject({
      data: { lastReminderBy: { name: 'Пользователь' } },
    });
  });

  it('без напоминаний cooldown неактивен', async () => {
    prismaMock.adminReminder.findFirst.mockResolvedValue(null);
    const res = mockResponse();

    await notificationController.getCooldownStatus(
      mockRequest({ user: USER, params: { groupId: '100' } }),
      res
    );

    expect(res.body).toMatchObject({
      data: {
        isActive: false,
        cooldownEndsAt: null,
        secondsLeft: 0,
        lastReminderBy: null,
      },
    });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await notificationController.getCooldownStatus(
      mockRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['нечисловой groupId', 'нет'],
    ['нулевой groupId', '0'],
  ])('%s — 400', async (_label, groupId) => {
    const res = mockResponse();

    await notificationController.getCooldownStatus(
      mockRequest({ user: USER, params: { groupId } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await notificationController.getCooldownStatus(
      mockRequest({ user: USER, params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  /* Cooldown чужой группы больше не виден никому: обход по users.is_admin
     удалён вместе с понятием глобального администратора. */
  it('cooldown чужой группы закрыт и для прежнего глобального админа', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await notificationController.getCooldownStatus(
      mockRequest({ user: { id: 1, isAdmin: true }, params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка базы — 500', async () => {
    prismaMock.adminReminder.findFirst.mockRejectedValue(new Error('db down'));
    const res = mockResponse();

    await notificationController.getCooldownStatus(
      mockRequest({ user: USER, params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

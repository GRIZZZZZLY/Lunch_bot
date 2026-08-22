/**
 * Уведомления. Всё, что здесь ломается, пользователь видит как «бот молчит».
 * Поэтому проверяются именно тихие отказы:
 *
 * - заглушение ищется по TELEGRAM-id, а не по внутреннему User.id (из-за этой
 *   путаницы каждое уведомление однажды молча считалось «muted»);
 * - в групповой пост забега нельзя ставить web_app-кнопку — только deep-link,
 *   иначе в группе кнопка не работает;
 * - имена пользователей и магазинов уходят в HTML и обязаны экранироваться.
 */
import { NotificationService } from '../../../services/notification.service';
import { NotificationType } from '../../../types/notification.types';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const NOW = new Date('2026-08-03T12:00:00.000Z');

let service: NotificationService;
let sendMessage: jest.Mock;
let editMessageText: jest.Mock;
let deleteMessage: jest.Mock;
let getChatMember: jest.Mock;
let bot: {
  api: {
    sendMessage: jest.Mock;
    editMessageText: jest.Mock;
    deleteMessage: jest.Mock;
    getChatMember: jest.Mock;
  };
  botInfo: { id: number };
};

function storeRunFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    groupId: 100,
    initiatorId: 1,
    storeName: 'Магнит',
    collectUntil: new Date('2026-08-03T12:30:00.000Z'),
    groupMessageId: 77,
    dmMessages: null,
    initiator: { id: 1, firstName: 'Игорь', telegramId: BigInt(555) },
    group: { telegramId: BigInt(-1001) },
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  sendMessage = jest.fn().mockResolvedValue({ message_id: 42 });
  editMessageText = jest.fn().mockResolvedValue(undefined);
  deleteMessage = jest.fn().mockResolvedValue(undefined);
  getChatMember = jest.fn().mockResolvedValue({ status: 'administrator' });
  bot = {
    api: { sendMessage, editMessageText, deleteMessage, getChatMember },
    botInfo: { id: 999 },
  };

  service = new NotificationService();
  service.initialize(bot);

  prismaMock.user.findUnique.mockResolvedValue({ isActive: true } as never);
  process.env.WEBAPP_URL = 'https://app.example.com';
});

afterEach(() => {
  jest.useRealTimers();
});

describe('send', () => {
  it('отправляет сообщение и возвращает его id', async () => {
    const result = await service.send({
      userId: 555,
      type: NotificationType.CUSTOM,
      message: 'привет',
      parseMode: 'Markdown',
    } as never);

    expect(sendMessage).toHaveBeenCalledWith(555, 'привет', {
      parse_mode: 'Markdown',
      reply_markup: undefined,
      disable_notification: undefined,
    });
    expect(result).toMatchObject({ success: true, messageId: 42 });
  });

  it('заглушение ищется по telegramId, а не по внутреннему id', async () => {
    await service.send({
      userId: 555,
      type: NotificationType.CUSTOM,
      message: 'привет',
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { telegramId: BigInt(555) },
      select: { isActive: true },
    });
  });

  it('деактивированному пользователю сообщение не уходит', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: false } as never);

    const result = await service.send({
      userId: 555,
      type: NotificationType.CUSTOM,
      message: 'привет',
    });

    expect(result).toMatchObject({ success: false, error: 'User is muted' });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('незнакомый получатель не считается заглушённым', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await service.send({
      userId: 555,
      type: NotificationType.CUSTOM,
      message: 'привет',
    });

    expect(result.success).toBe(true);
  });

  it('ошибка проверки заглушения не мешает отправке', async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error('db down'));

    const result = await service.send({
      userId: 555,
      type: NotificationType.CUSTOM,
      message: 'привет',
    });

    expect(result.success).toBe(true);
  });

  it('без поднятого бота отправка возвращает ошибку', async () => {
    const fresh = new NotificationService();

    const result = await fresh.send({
      userId: 555,
      type: NotificationType.CUSTOM,
      message: 'привет',
    });

    expect(result).toMatchObject({
      success: false,
      error: 'Bot not initialized',
    });
  });

  it('падение Telegram отдаёт текст ошибки', async () => {
    sendMessage.mockRejectedValue(new Error('bot was blocked'));

    const result = await service.send({
      userId: 555,
      type: NotificationType.CUSTOM,
      message: 'привет',
    });

    expect(result).toMatchObject({ success: false, error: 'bot was blocked' });
  });
});

describe('уведомления по голосованию', () => {
  it('custom-уведомление добавляет заголовок', async () => {
    await service.sendCustomNotification(555, 'текст', { title: 'Заголовок' });

    expect(sendMessage.mock.calls[0][1]).toBe('*Заголовок*\n\nтекст');
  });

  it('custom-уведомление без заголовка уходит как есть', async () => {
    await service.sendCustomNotification(555, 'текст');

    expect(sendMessage.mock.calls[0][1]).toBe('текст');
  });

  it('массовая рассылка считает успешные', async () => {
    sendMessage
      .mockResolvedValueOnce({ message_id: 1 })
      .mockRejectedValueOnce(new Error('blocked'));

    const results = await service.sendBulkNotification([555, 777], 'текст');

    expect(results.map(r => r.success)).toEqual([true, false]);
  });

  it('уведомление о старте голосования содержит число блюд', async () => {
    await service.sendPollStartedNotification([555], {
      groupTitle: 'Команда',
      menuItems: [{ id: 1 }, { id: 2 }],
      endTime: new Date('2026-08-03T13:00:00.000Z'),
    } as never);

    expect(sendMessage.mock.calls[0][1]).toContain('2');
  });

  it('уведомление о завершении в режиме multi-winner перечисляет блюда и людей', async () => {
    await service.sendPollEndedNotification([555], {
      mode: 'multi-winner',
      totalVotes: 5,
      winners: [
        {
          menuItemName: 'Плов',
          voters: [
            { firstName: 'Игорь' },
            { firstName: 'Аня' },
            { firstName: 'Оля' },
            { firstName: 'Дима' },
          ],
        },
      ],
      bringOwn: { count: 2, voters: [{ firstName: 'Женя' }] },
      skipped: { count: 1 },
    } as never);

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('*Плов* — 4 человека');
    expect(message).toContain('Игорь, Аня, Оля и ещё 1');
    expect(message).toContain('Принесу своё:* 2 человека');
    expect(message).toContain('Пропустили:* 1 человек');
  });

  it('пустое голосование получает отдельный текст', async () => {
    await service.sendPollEndedNotification([555], {
      mode: 'single-winner',
      totalVotes: 0,
    } as never);

    expect(sendMessage.mock.calls[0][1]).toContain('Никто не проголосовал');
  });

  it('single-winner называет победителя и топ', async () => {
    await service.sendPollEndedNotification([555], {
      mode: 'single-winner',
      totalVotes: 3,
      winnerItem: { name: 'Плов', price: 250 },
      topItems: [
        { item: { name: 'Плов' }, votes: 2, percentage: 67 },
        { item: { name: 'Шурпа' }, votes: 1, percentage: 33 },
      ],
    } as never);

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('*Победитель:* Плов');
    expect(message).toContain('250.00 руб.');
    expect(message).toContain('🥇 Плов - 2 голоса');
    expect(message).toContain('🥈 Шурпа - 1 голос');
  });
});

describe('sendPollCompletionNotifications', () => {
  const pollFixture = (overrides: Record<string, unknown> = {}) => ({
    id: 5,
    group: { title: 'Команда' },
    result: {
      totalVotes: 2,
      rouletteData: null,
      winnerMenuItem: { id: 1, name: 'Плов', description: null, price: 250 },
    },
    votes: [
      { userId: 1, menuItemId: 1, user: { id: 1 }, menuItem: { id: 1, name: 'Плов', price: 250 } },
      { userId: 2, menuItemId: 1, user: { id: 2 }, menuItem: { id: 1, name: 'Плов', price: 250 } },
    ],
    ...overrides,
  });

  it('single-winner: уведомления уходят каждому голосовавшему по одному разу', async () => {
    prismaMock.poll.findUnique.mockResolvedValue(pollFixture() as never);

    const results = await service.sendPollCompletionNotifications(5);

    expect(results).toHaveLength(2);
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('multi-winner распознаётся по rouletteData', async () => {
    prismaMock.poll.findUnique.mockResolvedValue(
      pollFixture({
        result: {
          totalVotes: 2,
          rouletteData: JSON.stringify({
            mode: 'multi-winner',
            winners: [{ menuItemName: 'Плов', voters: [{ firstName: 'Игорь' }] }],
            bringOwn: { count: 0 },
            skipped: { count: 0 },
          }),
          winnerMenuItem: null,
        },
      }) as never
    );

    await service.sendPollCompletionNotifications(5);

    expect(sendMessage.mock.calls[0][1]).toContain('Кто что заказывает');
  });

  it('битый rouletteData откатывается в single-winner', async () => {
    prismaMock.poll.findUnique.mockResolvedValue(
      pollFixture({
        result: {
          totalVotes: 2,
          rouletteData: '{не json',
          winnerMenuItem: { id: 1, name: 'Плов', description: null, price: null },
        },
      }) as never
    );

    await service.sendPollCompletionNotifications(5);

    expect(sendMessage.mock.calls[0][1]).toContain('Победитель');
  });

  it('без результата — исключение', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({ id: 5 } as never);

    await expect(service.sendPollCompletionNotifications(5)).rejects.toThrow(
      'Poll or result not found'
    );
  });
});

describe('notifyResponsible', () => {
  it('шлёт поздравление выбранному ответственному', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({
      id: 5,
      group: { title: 'Команда' },
      result: {
        totalVotes: 3,
        responsibleUser: { id: 1, firstName: 'Игорь', telegramId: BigInt(555) },
        winnerMenuItem: { name: 'Плов', price: 250 },
      },
    } as never);
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { user: { id: 1, firstName: 'Игорь', username: 'igor' } },
    ] as never);

    const result = await service.notifyResponsible(5, 1);

    expect(result.success).toBe(true);
    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('Поздравляем, Игорь');
    expect(message).toContain('Заказываем: Плов');
    expect(message).toContain('250.00 руб.');
  });

  it('без результата голосования возвращает ошибку, а не падает', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({ id: 5 } as never);

    const result = await service.notifyResponsible(5, 1);

    expect(result).toMatchObject({
      success: false,
      error: 'Poll or poll result not found',
    });
  });
});

describe('sendPollCancelledNotifications', () => {
  it('сообщает голосовавшим об отмене и причине', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({
      id: 5,
      group: { title: 'Команда' },
      votes: [
        { user: { id: 1, firstName: 'Игорь', lastName: null, telegramId: BigInt(555) } },
      ],
    } as never);

    await service.sendPollCancelledNotifications(
      5,
      { id: 9, firstName: 'Аня' } as never,
      'перенесли обед'
    );

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('отменено администратором Аня');
    expect(message).toContain('Причина: перенесли обед');
    expect(message).toContain('• Игорь');
  });

  it('длинный список голосовавших сокращается', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({
      id: 5,
      group: { title: 'Команда' },
      votes: Array.from({ length: 12 }, (_, i) => ({
        user: {
          id: i + 1,
          firstName: `Гость${i + 1}`,
          lastName: null,
          telegramId: BigInt(1000 + i),
        },
      })),
    } as never);

    await service.sendPollCancelledNotifications(5, { id: 9, firstName: 'Аня' } as never);

    expect(sendMessage.mock.calls[0][1]).toContain('и еще 2');
  });

  it('голосования нет — тихо выходим', async () => {
    prismaMock.poll.findUnique.mockResolvedValue(null);

    await expect(
      service.sendPollCancelledNotifications(5, { id: 9 } as never)
    ).resolves.toBeUndefined();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('без бота уведомления не отправляются', async () => {
    const fresh = new NotificationService();
    prismaMock.poll.findUnique.mockResolvedValue({
      id: 5,
      group: {},
      votes: [{ user: { id: 1, telegramId: BigInt(555) } }],
    } as never);

    await fresh.sendPollCancelledNotifications(5, { id: 9 } as never);

    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe('getStats', () => {
  it('складывает напоминания об оплате и админские', async () => {
    asMock(prismaMock.paymentReminder.count).mockResolvedValue(3);
    asMock(prismaMock.adminReminder.count).mockResolvedValue(2);

    await expect(service.getStats()).resolves.toEqual({
      paymentReminders: 3,
      pollNotifications: 2,
      totalReminders: 5,
    });
  });

  it('ошибка базы даёт нули, а не исключение', async () => {
    asMock(prismaMock.paymentReminder.count).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getStats()).resolves.toEqual({
      paymentReminders: 0,
      pollNotifications: 0,
      totalReminders: 0,
    });
  });
});

describe('notifyGroupMembersAboutStoreRun', () => {
  beforeEach(() => {
    prismaMock.storeRun.findUnique.mockResolvedValue(storeRunFixture() as never);
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { userId: 2, user: { id: 2, firstName: 'Аня', telegramId: BigInt(777) } },
    ] as never);
    asMock(prismaMock.storeRun.update).mockResolvedValue({ id: 5 });
  });

  it('шлёт приглашение участникам, кроме инициатора', async () => {
    const results = await service.notifyGroupMembersAboutStoreRun(5);

    expect(prismaMock.groupMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          groupId: 100,
          isActive: true,
          participatesInPolls: true,
          userId: { not: 1 },
        }),
      })
    );
    expect(results).toHaveLength(1);
    expect(sendMessage.mock.calls[0][1]).toContain('идёт в «Магнит»');
  });

  it('в личку идёт web_app-кнопка с id забега', async () => {
    await service.notifyGroupMembersAboutStoreRun(5);

    expect(sendMessage.mock.calls[0][2].reply_markup.inline_keyboard[0][0]).toMatchObject(
      { web_app: { url: 'https://app.example.com?storeRunId=5' } }
    );
  });

  it('без WEBAPP_URL кнопки нет, но текст уходит', async () => {
    delete process.env.WEBAPP_URL;

    await service.notifyGroupMembersAboutStoreRun(5);

    expect(sendMessage.mock.calls[0][2].reply_markup).toBeUndefined();
  });

  it('id доставленных сообщений сохраняются — потом их надо удалить', async () => {
    await service.notifyGroupMembersAboutStoreRun(5);

    expect(prismaMock.storeRun.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { dmMessages: JSON.stringify([{ chatId: 777, messageId: 42 }]) },
    });
  });

  it('недоставленное приглашение в список не попадает', async () => {
    sendMessage.mockRejectedValue(new Error('bot blocked'));

    const results = await service.notifyGroupMembersAboutStoreRun(5);

    expect(results[0].success).toBe(false);
    expect(prismaMock.storeRun.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { dmMessages: '[]' },
    });
  });

  it('падение записи id не роняет рассылку', async () => {
    asMock(prismaMock.storeRun.update).mockRejectedValue(new Error('db down'));

    await expect(
      service.notifyGroupMembersAboutStoreRun(5)
    ).resolves.toHaveLength(1);
  });

  it('имя магазина экранируется для HTML', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(
      storeRunFixture({ storeName: 'A & <b>B</b>' }) as never
    );

    await service.notifyGroupMembersAboutStoreRun(5);

    expect(sendMessage.mock.calls[0][1]).toContain('A &amp; &lt;b&gt;B&lt;/b&gt;');
  });

  it('забега нет — пустой результат', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(null);

    await expect(service.notifyGroupMembersAboutStoreRun(5)).resolves.toEqual([]);
  });

  it('некому писать — пустой результат', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([] as never);

    await expect(service.notifyGroupMembersAboutStoreRun(5)).resolves.toEqual([]);
  });

  it('без бота рассылки нет', async () => {
    const fresh = new NotificationService();

    await expect(fresh.notifyGroupMembersAboutStoreRun(5)).resolves.toEqual([]);
  });
});

describe('notifyShoppingStarted', () => {
  beforeEach(() => {
    prismaMock.storeRun.findUnique.mockResolvedValue(storeRunFixture() as never);
    asMock(prismaMock.storeItem.findMany).mockResolvedValue([
      { userId: 2 },
      { userId: 2 },
      { userId: 1 },
    ] as never);
    asMock(prismaMock.user.findMany).mockResolvedValue([
      { id: 2, telegramId: BigInt(777), firstName: 'Аня' },
    ] as never);
  });

  it('сообщает добавившим позиции, что сбор закрыт', async () => {
    const results = await service.notifyShoppingStarted(5);

    // Инициатор исключён, дубликаты userId свёрнуты.
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [2] }, isActive: true } })
    );
    expect(results).toHaveLength(1);
    expect(sendMessage.mock.calls[0][1]).toContain('пошёл в «Магнит»');
  });

  it('забега нет — пусто', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(null);

    await expect(service.notifyShoppingStarted(5)).resolves.toEqual([]);
  });

  it('никто ничего не добавил — пусто', async () => {
    asMock(prismaMock.storeItem.findMany).mockResolvedValue([
      { userId: 1 },
    ] as never);

    await expect(service.notifyShoppingStarted(5)).resolves.toEqual([]);
  });

  it('все участники деактивированы — пусто', async () => {
    asMock(prismaMock.user.findMany).mockResolvedValue([] as never);

    await expect(service.notifyShoppingStarted(5)).resolves.toEqual([]);
  });

  it('без бота — пусто', async () => {
    const fresh = new NotificationService();

    await expect(fresh.notifyShoppingStarted(5)).resolves.toEqual([]);
  });
});

describe('notifyStoreRunExpired', () => {
  it('инициатору сообщают об авто-отмене', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(storeRunFixture() as never);

    await service.notifyStoreRunExpired(5);

    expect(sendMessage).toHaveBeenCalledWith(
      555,
      expect.stringContaining('авто-отменён'),
      expect.objectContaining({ parse_mode: 'HTML' })
    );
  });

  it('забега нет — молчим', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(null);

    await service.notifyStoreRunExpired(5);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('без бота молчим', async () => {
    const fresh = new NotificationService();

    await expect(fresh.notifyStoreRunExpired(5)).resolves.toBeUndefined();
  });
});

describe('postStoreRunToGroup', () => {
  beforeEach(() => {
    prismaMock.storeRun.findUnique.mockResolvedValue(storeRunFixture() as never);
    asMock(prismaMock.storeRun.update).mockResolvedValue({ id: 5 });
  });

  it('в группу уходит deep-link, а НЕ web_app-кнопка', async () => {
    const result = await service.postStoreRunToGroup(5);

    const markup = sendMessage.mock.calls[0][2].reply_markup;
    expect(markup.inline_keyboard[0][0]).not.toHaveProperty('web_app');
    expect(markup.inline_keyboard[0][0].url).toContain('startapp=storerun_5');
    expect(result).toMatchObject({ success: true, messageId: 42 });
  });

  it('id группового сообщения сохраняется', async () => {
    await service.postStoreRunToGroup(5);

    expect(prismaMock.storeRun.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { groupMessageId: 42 },
    });
  });

  it('падение записи id не отменяет успех публикации', async () => {
    asMock(prismaMock.storeRun.update).mockRejectedValue(new Error('db down'));

    await expect(service.postStoreRunToGroup(5)).resolves.toMatchObject({
      success: true,
    });
  });

  it('забега нет — понятный код ошибки', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(null);

    await expect(service.postStoreRunToGroup(5)).resolves.toMatchObject({
      success: false,
      error: 'run_not_found',
    });
  });

  it('без бота — понятный код ошибки', async () => {
    const fresh = new NotificationService();

    await expect(fresh.postStoreRunToGroup(5)).resolves.toMatchObject({
      error: 'bot_not_initialized',
    });
  });

  it('падение отправки отдаёт текст ошибки', async () => {
    sendMessage.mockRejectedValue(new Error('chat not found'));

    await expect(service.postStoreRunToGroup(5)).resolves.toMatchObject({
      success: false,
      error: 'chat not found',
    });
  });
});

describe('notifyInitiatorCollectionClosed', () => {
  beforeEach(() => {
    prismaMock.storeRun.findUnique.mockResolvedValue(storeRunFixture() as never);
    asMock(prismaMock.storeItem.count).mockResolvedValue(4);
  });

  it('сообщает число собранных позиций и даёт кнопку', async () => {
    const result = await service.notifyInitiatorCollectionClosed(5);

    expect(sendMessage.mock.calls[0][1]).toContain('Набралось позиций: 4');
    expect(
      sendMessage.mock.calls[0][2].reply_markup.inline_keyboard[0][0].web_app.url
    ).toBe('https://app.example.com?storeRunId=5');
    expect(result.success).toBe(true);
  });

  it('без WEBAPP_URL кнопки нет', async () => {
    delete process.env.WEBAPP_URL;

    await service.notifyInitiatorCollectionClosed(5);

    expect(sendMessage.mock.calls[0][2].reply_markup).toBeUndefined();
  });

  it('забега нет — ошибка', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(null);

    await expect(
      service.notifyInitiatorCollectionClosed(5)
    ).resolves.toMatchObject({ error: 'run_not_found' });
  });

  it('без бота — ошибка', async () => {
    const fresh = new NotificationService();

    await expect(
      fresh.notifyInitiatorCollectionClosed(5)
    ).resolves.toMatchObject({ error: 'bot_not_initialized' });
  });
});

describe('botCanPostToGroup', () => {
  beforeEach(() => {
    asMock(prismaMock.group.findUnique).mockResolvedValue({
      telegramId: BigInt(-1001),
    });
  });

  it('бот в группе — можно писать', async () => {
    await expect(service.botCanPostToGroup(100)).resolves.toBe(true);
    expect(getChatMember).toHaveBeenCalledWith(-1001, 999);
  });

  it.each(['left', 'kicked'])('статус %s — писать нельзя', async status => {
    getChatMember.mockResolvedValue({ status });

    await expect(service.botCanPostToGroup(100)).resolves.toBe(false);
  });

  it('группы нет — нельзя', async () => {
    asMock(prismaMock.group.findUnique).mockResolvedValue(null);

    await expect(service.botCanPostToGroup(100)).resolves.toBe(false);
  });

  it('падение проверки трактуется как «нельзя»', async () => {
    getChatMember.mockRejectedValue(new Error('403 kicked'));

    await expect(service.botCanPostToGroup(100)).resolves.toBe(false);
  });

  it('без бота — нельзя', async () => {
    const fresh = new NotificationService();

    await expect(fresh.botCanPostToGroup(100)).resolves.toBe(false);
  });
});

describe('deleteStoreRunMessages', () => {
  it('удаляет и групповой пост, и личные приглашения', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(
      storeRunFixture({
        dmMessages: JSON.stringify([
          { chatId: 777, messageId: 11 },
          { chatId: 888, messageId: 12 },
        ]),
      }) as never
    );

    await service.deleteStoreRunMessages(5);

    expect(deleteMessage).toHaveBeenCalledWith(-1001, 77);
    expect(deleteMessage).toHaveBeenCalledWith(777, 11);
    expect(deleteMessage).toHaveBeenCalledWith(888, 12);
  });

  it('уже удалённое сообщение не роняет очистку', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(
      storeRunFixture({
        dmMessages: JSON.stringify([{ chatId: 777, messageId: 11 }]),
      }) as never
    );
    deleteMessage.mockRejectedValue(new Error('message to delete not found'));

    await expect(service.deleteStoreRunMessages(5)).resolves.toBeUndefined();
  });

  it('битый JSON приглашений не роняет очистку', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(
      storeRunFixture({ dmMessages: '{не json' }) as never
    );

    await service.deleteStoreRunMessages(5);

    // Групповой пост всё равно удалён.
    expect(deleteMessage).toHaveBeenCalledWith(-1001, 77);
  });

  it('без группового сообщения удаляются только личные', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(
      storeRunFixture({
        groupMessageId: null,
        dmMessages: JSON.stringify([{ chatId: 777, messageId: 11 }]),
      }) as never
    );

    await service.deleteStoreRunMessages(5);

    expect(deleteMessage).toHaveBeenCalledTimes(1);
  });

  it('забега нет — молчим', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(null);

    await service.deleteStoreRunMessages(5);

    expect(deleteMessage).not.toHaveBeenCalled();
  });

  it('без бота молчим', async () => {
    const fresh = new NotificationService();

    await expect(fresh.deleteStoreRunMessages(5)).resolves.toBeUndefined();
  });
});

describe('markStoreRunGroupCompleted', () => {
  it('правит групповой пост и снимает кнопку', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(storeRunFixture() as never);

    await service.markStoreRunGroupCompleted(5);

    expect(editMessageText).toHaveBeenCalledWith(
      -1001,
      77,
      expect.stringContaining('завершён'),
      { parse_mode: 'HTML' }
    );
    // reply_markup не передаётся — Telegram убирает клавиатуру.
    expect(editMessageText.mock.calls[0][3]).not.toHaveProperty('reply_markup');
  });

  it('без группового сообщения правка не нужна', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(
      storeRunFixture({ groupMessageId: null }) as never
    );

    await service.markStoreRunGroupCompleted(5);

    expect(editMessageText).not.toHaveBeenCalled();
  });

  it('падение правки не выбрасывается наружу', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(storeRunFixture() as never);
    editMessageText.mockRejectedValue(new Error('message is not modified'));

    await expect(service.markStoreRunGroupCompleted(5)).resolves.toBeUndefined();
  });

  it('забега нет — молчим', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(null);

    await service.markStoreRunGroupCompleted(5);

    expect(editMessageText).not.toHaveBeenCalled();
  });

  it('без бота молчим', async () => {
    const fresh = new NotificationService();

    await expect(
      fresh.markStoreRunGroupCompleted(5)
    ).resolves.toBeUndefined();
  });
});

describe('notifyStoreRunParticipantsNoDebt', () => {
  beforeEach(() => {
    prismaMock.storeRun.findUnique.mockResolvedValue({
      initiatorId: 1,
      storeName: 'Магнит',
    } as never);
    asMock(prismaMock.storeItem.findMany).mockResolvedValue([
      { userId: 2 },
      { userId: 3 },
      { userId: 1 },
    ] as never);
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      { fromUserId: 2 },
    ] as never);
    asMock(prismaMock.user.findMany).mockResolvedValue([
      { id: 3, telegramId: BigInt(888) },
    ] as never);
  });

  it('пишет только тем, у кого долга не возникло', async () => {
    const results = await service.notifyStoreRunParticipantsNoDebt(5);

    // Участник 2 — должник, инициатор исключён, остаётся 3.
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [3] }, isActive: true } })
    );
    expect(results).toHaveLength(1);
    expect(sendMessage.mock.calls[0][1]).toContain('платить не надо');
  });

  it('все участники — должники, писать некому', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      { fromUserId: 2 },
      { fromUserId: 3 },
    ] as never);

    await expect(
      service.notifyStoreRunParticipantsNoDebt(5)
    ).resolves.toEqual([]);
  });

  it('позиций нет — писать некому', async () => {
    asMock(prismaMock.storeItem.findMany).mockResolvedValue([
      { userId: 1 },
    ] as never);

    await expect(
      service.notifyStoreRunParticipantsNoDebt(5)
    ).resolves.toEqual([]);
  });

  it('забега нет — пусто', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(null);

    await expect(
      service.notifyStoreRunParticipantsNoDebt(5)
    ).resolves.toEqual([]);
  });

  it('получатели деактивированы — пусто', async () => {
    asMock(prismaMock.user.findMany).mockResolvedValue([] as never);

    await expect(
      service.notifyStoreRunParticipantsNoDebt(5)
    ).resolves.toEqual([]);
  });

  it('без бота — пусто', async () => {
    const fresh = new NotificationService();

    await expect(
      fresh.notifyStoreRunParticipantsNoDebt(5)
    ).resolves.toEqual([]);
  });
});

/**
 * Текст шаблонов однажды был испорчен перекодировкой: UTF-8 байты прочитаны
 * как windows-1251 и записаны обратно, так что от `Началось голосование!`
 * осталась нечитаемая последовательность (пример — в
 * scripts/check-mojibake.mjs). Дожило это до коммита именно потому, что НИ
 * ОДИН тест не смотрел на сам текст: все проверки касались того, кому и
 * сколько раз уходит сообщение.
 *
 * Здесь закреплены читаемые строки. Тест намеренно сверяет подстроки, а не
 * шаблон целиком: цель — поймать порчу кодировки, а не запретить правки
 * формулировок.
 *
 * Честная оговорка о силе этих тестов: до починки кодировки упал бы только
 * первый из них (текст POLL_STARTED действительно был испорчен). Остальные —
 * не доказательство, а забор: они закрепляют текст, который уже был читаемым.
 * Испорченные заголовки закрыть тестом нельзя вовсе — `getTitle` не вызывается
 * ни для одного шаблона, а у ORDER_REMINDER нет и публичного метода отправки.
 * Это отдельная находка для задачи 07, а не пробел в покрытии здесь.
 */
describe('читаемость текста шаблонов', () => {
  /** Маркеры mojibake из scripts/check-mojibake.mjs. */
  const MOJIBAKE = /Р[°Ѕµё‘‚]|С[‚†Ѓњ‹]/;

  it('уведомление о старте голосования читаемо', async () => {
    await service.sendPollStartedNotification([555], {
      groupTitle: 'Команда',
      menuItems: [{ id: 1, name: 'Плов' }],
      endTime: NOW,
    } as never);

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).not.toMatch(MOJIBAKE);
    expect(message).toContain('В группе *Команда* началось новое голосование!');
    expect(message).toContain('Доступно блюд: 1');
    expect(message).toContain('Проголосуй в чате группы!');
  });

  it('уведомление победителю рулетки читаемо', async () => {
    await service.sendRouletteWinnerNotification({
      winner: { firstName: 'Игорь', telegramId: BigInt(555) },
      winnerItem: { name: 'Плов', price: 250 },
      voters: [{ id: 1 }, { id: 2 }],
    } as never);

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).not.toMatch(MOJIBAKE);
    expect(message).toContain('Поздравляем, Игорь!');
    expect(message).toContain('Рулетка выбрала тебя ответственным за заказ.');
    expect(message).toContain('Заказываем: Плов');
    expect(message).toContain('Участников: 2');
  });

  it('уведомление о завершении голосования читаемо', async () => {
    await service.sendPollEndedNotification([555], {
      totalVotes: 3,
      groupTitle: 'Команда',
      winners: [],
    } as never);

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).not.toMatch(MOJIBAKE);
    expect(message).toContain('Всего голосов: 3');
  });

  it('пустое голосование объясняет себя человеческим текстом', async () => {
    await service.sendPollEndedNotification([555], {
      totalVotes: 0,
      groupTitle: 'Команда',
      winners: [],
    } as never);

    expect(sendMessage.mock.calls[0][1]).toContain(
      'Никто не проголосовал. Все на диете?'
    );
  });
});

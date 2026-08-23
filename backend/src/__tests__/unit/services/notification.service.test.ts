/**
 * Транспорт уведомлений. Всё, что здесь ломается, пользователь видит как «бот
 * молчит», поэтому проверяются именно тихие отказы:
 *
 * - заглушение ищется по TELEGRAM-id, а не по внутреннему User.id (из-за этой
 *   путаницы каждое уведомление однажды молча считалось «muted»);
 * - падение Telegram не выбрасывается наружу, а приходит в результате.
 *
 * Домены живут отдельно: `poll-notification.service.test.ts` и
 * `store-run-notification.service.test.ts`.
 */
import { NotificationService } from '../../../services/notification.service';
import { NotificationType } from '../../../types/notification.types';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/**
 * Бот приходит из общего синглтона, а не из `initialize(bot)` на экземпляре.
 * Раньше «бота нет» изображал свежий `new`-экземпляр; теперь у сервисов нет
 * своего поля, и отсутствие бота — это пустой синглтон.
 */
jest.mock('../../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(),
}));

const mockedGetBotInstance = getBotInstance as jest.MockedFunction<
  typeof getBotInstance
>;

const NOW = new Date('2026-08-03T12:00:00.000Z');

let service: NotificationService;
let sendMessage: jest.Mock;
let getChatMember: jest.Mock;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  sendMessage = jest.fn().mockResolvedValue({ message_id: 42 });
  getChatMember = jest.fn().mockResolvedValue({ status: 'administrator' });

  service = new NotificationService();
  mockedGetBotInstance.mockReturnValue({
    api: { sendMessage, getChatMember },
    botInfo: { id: 999 },
  } as never);

  prismaMock.user.findUnique.mockResolvedValue({ isActive: true } as never);
});

afterEach(() => {
  jest.useRealTimers();
});

/**
 * Сценарий «бот не поднят». Возвращает тот же сервис: экземпляр здесь ни при
 * чём, важно только состояние синглтона.
 */
function withoutBot(): NotificationService {
  mockedGetBotInstance.mockReturnValue(null);
  return service;
}

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
    const fresh = withoutBot();

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

describe('произвольные и массовые уведомления', () => {
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
    const fresh = withoutBot();

    await expect(fresh.botCanPostToGroup(100)).resolves.toBe(false);
  });
});

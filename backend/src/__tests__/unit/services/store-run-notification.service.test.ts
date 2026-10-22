/**
 * Уведомления домена «иду в магазин». Отправка идёт через реальный транспорт
 * (`notification.service`) — замокан только бот и Prisma.
 *
 * Здесь два отдельных источника тихих отказов:
 *
 * - в групповой пост забега нельзя ставить web_app-кнопку, только deep-link:
 *   в группах web_app не работает;
 * - названия магазинов и имена людей уходят в HTML и обязаны экранироваться,
 *   иначе Telegram отвечает `can't parse entities` и сообщение не доходит.
 *
 * Кто получает приглашения и что id сообщений сохраняются, проверяет
 * integration/api/store-runs.redis.test.ts.
 */
import { StoreRunNotificationService } from '../../../services/store-run-notification.service';
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

let service: StoreRunNotificationService;
let sendMessage: jest.Mock;
let editMessageText: jest.Mock;
let deleteMessage: jest.Mock;

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

  service = new StoreRunNotificationService();
  mockedGetBotInstance.mockReturnValue({
    api: { sendMessage, editMessageText, deleteMessage },
    botInfo: { id: 999 },
  } as never);

  prismaMock.user.findUnique.mockResolvedValue({ isActive: true } as never);
  process.env.WEBAPP_URL = 'https://app.example.com';
});

afterEach(() => {
  jest.useRealTimers();
});

describe('notifyGroupMembersAboutStoreRun', () => {
  beforeEach(() => {
    prismaMock.storeRun.findUnique.mockResolvedValue(storeRunFixture() as never);
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { userId: 2, user: { id: 2, firstName: 'Аня', telegramId: BigInt(777) } },
    ] as never);
    asMock(prismaMock.storeRun.update).mockResolvedValue({ id: 5 });
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

  it('падение записи id не роняет рассылку', async () => {
    asMock(prismaMock.storeRun.update).mockRejectedValue(new Error('db down'));

    await expect(
      service.notifyGroupMembersAboutStoreRun(5)
    ).resolves.toHaveLength(1);
  });

  it('некому писать — пустой результат', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([] as never);

    await expect(service.notifyGroupMembersAboutStoreRun(5)).resolves.toEqual([]);
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
});

describe('notifyStoreRunExpired', () => {
  it('инициатору сообщают об авто-отмене', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(storeRunFixture() as never);

    await service.notifyStoreRunExpired(5);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0][0]).toBe(555);
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

  it('падение записи id не отменяет успех публикации', async () => {
    asMock(prismaMock.storeRun.update).mockRejectedValue(new Error('db down'));

    await expect(service.postStoreRunToGroup(5)).resolves.toMatchObject({
      success: true,
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
    asMock(prismaMock.storeItem.count).mockResolvedValue(17);
  });

  it('сообщает число собранных позиций и даёт кнопку', async () => {
    const result = await service.notifyInitiatorCollectionClosed(5);

    expect(sendMessage.mock.calls[0][1]).toContain('17');
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
});

describe('deleteStoreRunMessages', () => {
  it('сбой одного удаления не мешает удалить остальные', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue(
      storeRunFixture({
        dmMessages: JSON.stringify([{ chatId: 777, messageId: 11 }]),
      }) as never
    );
    deleteMessage.mockRejectedValueOnce(new Error('message to delete not found'));

    await expect(service.deleteStoreRunMessages(5)).resolves.toBeUndefined();
    expect(deleteMessage).toHaveBeenCalledWith(-1001, 77);
    expect(deleteMessage).toHaveBeenCalledWith(777, 11);
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
});

describe('markStoreRunGroupCompleted', () => {
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

  it('получатели деактивированы — пусто', async () => {
    asMock(prismaMock.user.findMany).mockResolvedValue([] as never);

    await expect(
      service.notifyStoreRunParticipantsNoDebt(5)
    ).resolves.toEqual([]);
  });

  it('сбой отправки одному не мешает остальным, результат на каждого', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);
    asMock(prismaMock.user.findMany).mockResolvedValue([
      { id: 2, telegramId: BigInt(777) },
      { id: 3, telegramId: BigInt(888) },
    ] as never);
    sendMessage.mockRejectedValueOnce(new Error('bot blocked by user'));

    const results = await service.notifyStoreRunParticipantsNoDebt(5);

    expect(results.map(r => r.success)).toEqual([false, true]);
  });
});

/**
 * Без бота или без забега ни один метод не бросает и ничего не шлёт в
 * Telegram. Данные во всех строках такие, что с ботом и забегом каждый метод
 * дошёл бы до Telegram: это проверяет первая таблица.
 */
describe('без бота или без забега', () => {
  const METHODS = [
    'notifyGroupMembersAboutStoreRun',
    'notifyShoppingStarted',
    'notifyStoreRunExpired',
    'postStoreRunToGroup',
    'notifyInitiatorCollectionClosed',
    'deleteStoreRunMessages',
    'markStoreRunGroupCompleted',
    'notifyStoreRunParticipantsNoDebt',
  ] as const;
  type Method = (typeof METHODS)[number];

  function call(method: Method): Promise<unknown> {
    return service[method](5);
  }

  function telegramCalls(): number {
    return (
      sendMessage.mock.calls.length +
      editMessageText.mock.calls.length +
      deleteMessage.mock.calls.length
    );
  }

  beforeEach(() => {
    prismaMock.storeRun.findUnique.mockResolvedValue(
      storeRunFixture({
        dmMessages: JSON.stringify([{ chatId: 777, messageId: 11 }]),
      }) as never
    );
    asMock(prismaMock.storeRun.update).mockResolvedValue({ id: 5 });
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { userId: 2, user: { id: 2, firstName: 'Аня', telegramId: BigInt(777) } },
    ] as never);
    asMock(prismaMock.storeItem.findMany).mockResolvedValue([{ userId: 2 }] as never);
    asMock(prismaMock.storeItem.count).mockResolvedValue(1);
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);
    asMock(prismaMock.user.findMany).mockResolvedValue([
      { id: 2, telegramId: BigInt(777), firstName: 'Аня' },
    ] as never);
  });

  it.each(METHODS)('с ботом и забегом %s доходит до Telegram', async method => {
    await call(method);

    expect(telegramCalls()).toBeGreaterThan(0);
  });

  const failed = (error: string) => expect.objectContaining({ success: false, error });

  it.each([
    ['notifyGroupMembersAboutStoreRun', []],
    ['notifyShoppingStarted', []],
    ['notifyStoreRunExpired', undefined],
    ['postStoreRunToGroup', failed('bot_not_initialized')],
    ['notifyInitiatorCollectionClosed', failed('bot_not_initialized')],
    ['deleteStoreRunMessages', undefined],
    ['markStoreRunGroupCompleted', undefined],
    ['notifyStoreRunParticipantsNoDebt', []],
  ] as Array<[Method, unknown]>)('без бота %s молчит', async (method, expected) => {
    mockedGetBotInstance.mockReturnValue(null);

    await expect(call(method)).resolves.toEqual(expected);
    expect(telegramCalls()).toBe(0);
  });

  it.each([
    ['notifyGroupMembersAboutStoreRun', []],
    ['notifyShoppingStarted', []],
    ['notifyStoreRunExpired', undefined],
    ['postStoreRunToGroup', failed('run_not_found')],
    ['notifyInitiatorCollectionClosed', failed('run_not_found')],
    ['deleteStoreRunMessages', undefined],
    ['markStoreRunGroupCompleted', undefined],
    ['notifyStoreRunParticipantsNoDebt', []],
  ] as Array<[Method, unknown]>)('забега нет: %s молчит', async (method, expected) => {
    prismaMock.storeRun.findUnique.mockResolvedValue(null);

    await expect(call(method)).resolves.toEqual(expected);
    expect(telegramCalls()).toBe(0);
  });
});

/**
 * Экранирование HTML на каждом пути, который что-то отправляет.
 *
 * Это единственная проверка, которая ловит потерю `escapeHtml` при переносе
 * кода: все сообщения уходят с `parse_mode: 'HTML'`, и на латинице без `&` и
 * `<` пропущенный вызов выглядит нормально. На реальных данных — название
 * магазина «Пятёрочка & <Магнит>», имя «Аня & <Оля>» — Telegram отвечает
 * `400 Bad Request: can't parse entities`, и сообщение не доставляется вообще.
 *
 * Поэтому здесь нарочно русский текст со всеми тремя символами: `&`, `<`, `>`.
 */
describe('экранирование HTML на русских данных', () => {
  const DIRTY_STORE = 'Пятёрочка & <Магнит>';
  const DIRTY_NAME = 'Аня & <Оля>';
  const CLEAN_STORE = 'Пятёрочка &amp; &lt;Магнит&gt;';
  const CLEAN_NAME = 'Аня &amp; &lt;Оля&gt;';

  beforeEach(() => {
    prismaMock.storeRun.findUnique.mockResolvedValue(
      storeRunFixture({
        storeName: DIRTY_STORE,
        initiator: { id: 1, firstName: DIRTY_NAME, telegramId: BigInt(555) },
      }) as never
    );
    asMock(prismaMock.storeRun.update).mockResolvedValue({ id: 5 });
    asMock(prismaMock.storeItem.count).mockResolvedValue(2);
  });

  /** Ни одного «сырого» символа разметки в тексте, ушедшем в Telegram. */
  function expectEscaped(text: string): void {
    expect(text).not.toContain(DIRTY_STORE);
    expect(text).not.toContain('<Магнит>');
    expect(text).not.toContain(' & ');
  }

  it('приглашение в личку экранирует магазин и имя инициатора', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { userId: 2, user: { id: 2, firstName: 'Аня', telegramId: BigInt(777) } },
    ] as never);

    await service.notifyGroupMembersAboutStoreRun(5);

    const text = sendMessage.mock.calls[0][1] as string;
    expect(text).toContain(CLEAN_STORE);
    expect(text).toContain(CLEAN_NAME);
    expectEscaped(text);
  });

  it('групповой пост экранирует магазин и имя инициатора', async () => {
    await service.postStoreRunToGroup(5);

    const text = sendMessage.mock.calls[0][1] as string;
    expect(text).toContain(CLEAN_STORE);
    expect(text).toContain(CLEAN_NAME);
    expectEscaped(text);
  });

  it('сообщение о начале закупки экранирует магазин и имя', async () => {
    asMock(prismaMock.storeItem.findMany).mockResolvedValue([
      { userId: 2 },
    ] as never);
    asMock(prismaMock.user.findMany).mockResolvedValue([
      { id: 2, telegramId: BigInt(777), firstName: 'Аня' },
    ] as never);

    await service.notifyShoppingStarted(5);

    const text = sendMessage.mock.calls[0][1] as string;
    expect(text).toContain(CLEAN_STORE);
    expect(text).toContain(CLEAN_NAME);
    expectEscaped(text);
  });

  it('авто-отмена экранирует название магазина', async () => {
    await service.notifyStoreRunExpired(5);

    const text = sendMessage.mock.calls[0][1] as string;
    expect(text).toContain(CLEAN_STORE);
    expectEscaped(text);
  });

  it('закрытие сбора по таймеру экранирует название магазина', async () => {
    await service.notifyInitiatorCollectionClosed(5);

    const text = sendMessage.mock.calls[0][1] as string;
    expect(text).toContain(CLEAN_STORE);
    expectEscaped(text);
  });

  it('правка группового поста экранирует название магазина', async () => {
    await service.markStoreRunGroupCompleted(5);

    const text = editMessageText.mock.calls[0][2] as string;
    expect(text).toContain(CLEAN_STORE);
    expectEscaped(text);
  });

  it('сообщение «платить не надо» экранирует название магазина', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue({
      initiatorId: 1,
      storeName: DIRTY_STORE,
    } as never);
    asMock(prismaMock.storeItem.findMany).mockResolvedValue([
      { userId: 2 },
    ] as never);
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);
    asMock(prismaMock.user.findMany).mockResolvedValue([
      { id: 2, telegramId: BigInt(777) },
    ] as never);

    await service.notifyStoreRunParticipantsNoDebt(5);

    const text = sendMessage.mock.calls[0][1] as string;
    expect(text).toContain(CLEAN_STORE);
    expectEscaped(text);
  });
});

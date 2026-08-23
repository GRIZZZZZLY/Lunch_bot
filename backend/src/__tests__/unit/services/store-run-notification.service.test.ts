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

function withoutBot(): StoreRunNotificationService {
  mockedGetBotInstance.mockReturnValue(null);
  return service;
}

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
    const fresh = withoutBot();

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
    const fresh = withoutBot();

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
    const fresh = withoutBot();

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
    const fresh = withoutBot();

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
    const fresh = withoutBot();

    await expect(
      fresh.notifyInitiatorCollectionClosed(5)
    ).resolves.toMatchObject({ error: 'bot_not_initialized' });
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
    const fresh = withoutBot();

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
    const fresh = withoutBot();

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
    const fresh = withoutBot();

    await expect(
      fresh.notifyStoreRunParticipantsNoDebt(5)
    ).resolves.toEqual([]);
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

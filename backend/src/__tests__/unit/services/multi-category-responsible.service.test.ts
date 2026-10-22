/**
 * Распределение ответственных по категориям. Отклик добровольца через бота
 * («один человек — одна категория», гонка, отказ не голосовавшему) проверяют
 * интеграционные тесты. Здесь — рулетка (сначала из тех, кто ещё свободен),
 * таймаут, экранирование и устойчивость без бота.
 *
 * Отдельно: сообщение в группе редактируется, а не плодится, и кнопки остаются
 * только у нераспределённых категорий.
 */
import { MultiCategoryResponsibleService } from '../../../services/multi-category-responsible.service';
import { CategoryOrderService } from '../../../services/category-order.service';
import { GroupService } from '../../../services/group.service';
import { VoteService } from '../../../services/vote.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { awardXP } from '../../helpers/gamification-mock';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/category-order.service', () => ({
  CategoryOrderService: {
    getCategoryOrdersForPoll: jest.fn(),
    getCategoryOrder: jest.fn(),
    getParticipants: jest.fn(),
    setResponsible: jest.fn(),
  },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupMember: jest.fn() },
}));

jest.mock('../../../services/vote.service', () => ({
  VoteService: { getVoteBreakdown: jest.fn() },
}));

jest.mock('../../../services/roulette.service', () => ({
  RouletteService: jest.fn(),
}));

jest.mock('../../../services/gamification.service', () =>
  require('../../helpers/gamification-mock')
);

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const categoryOrders = asServiceMock(CategoryOrderService);
const groupService = asServiceMock(GroupService);
const voteService = asServiceMock(VoteService);
const botInstance = asMock(getBotInstance);

const NOW = new Date('2026-08-03T12:00:00.000Z');

function orderFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    pollId: 5,
    category: 'Плов',
    participantCount: 3,
    selectionStatus: 'VOLUNTEER_OPEN',
    responsibleUser: null,
    poll: { id: 5, groupId: 100, status: 'COMPLETED' },
    ...overrides,
  };
}

let sendMessage: jest.Mock;
let editMessageText: jest.Mock;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  sendMessage = jest.fn().mockResolvedValue({ message_id: 42 });
  editMessageText = jest.fn().mockResolvedValue(undefined);
  botInstance.mockReturnValue({ api: { sendMessage, editMessageText } });

  categoryOrders.getCategoryOrdersForPoll.mockResolvedValue([orderFixture()]);
  categoryOrders.getCategoryOrder.mockResolvedValue(orderFixture());
  categoryOrders.getParticipants.mockResolvedValue([1, 2, 3]);
  categoryOrders.setResponsible.mockResolvedValue({ id: 1 });

  groupService.isUserGroupMember.mockResolvedValue(true);
  voteService.getVoteBreakdown.mockResolvedValue([
    { menuItemName: 'Плов', votes: 3, percentage: 100, voters: [] },
  ]);

  asMock(prismaMock.poll.findUnique).mockResolvedValue({
    chatId: BigInt(-1001),
    messageId: 77,
    duration: 30,
    startedAt: NOW,
    selectedMenuItemIds: '[1,2]',
  });
  prismaMock.user.findUnique.mockResolvedValue({
    id: 1,
    firstName: 'Игорь',
    telegramId: BigInt(555),
  } as never);
  asMock(prismaMock.categoryOrder.findFirst).mockResolvedValue(null);
  asMock(prismaMock.categoryOrder.update).mockResolvedValue({ id: 1 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('startMultiCategorySelection', () => {
  it('нераспределённые категории попадают в сообщение с кнопками', async () => {
    await MultiCategoryResponsibleService.startMultiCategorySelection(5);

    const [, , , options] = editMessageText.mock.calls[0];
    expect(options.reply_markup.inline_keyboard[0][0]).toMatchObject({
      callback_data: 'volunteer_category:1',
    });
  });

  /**
   * Название категории задаёт пользователь. В ТЕКСТЕ сообщения его нужно
   * экранировать, а в `text` кнопки — нельзя: текст кнопки Telegram как
   * Markdown не разбирает, и человек увидел бы `\_` буквально.
   */
  it('категория экранируется в тексте, но не в подписи кнопки', async () => {
    categoryOrders.getCategoryOrdersForPoll.mockResolvedValue([
      orderFixture({ category: 'Соус_острый' }),
    ]);

    await MultiCategoryResponsibleService.startMultiCategorySelection(5);

    const [, , message, options] = editMessageText.mock.calls[0];
    expect(message).toContain('Соус\\_острый');
    const buttonText = options.reply_markup.inline_keyboard[0][0].text;
    expect(buttonText).toContain('Соус_острый');
    expect(buttonText).not.toContain('\\');
  });

  it('имя автоответственного в сообщении о категориях экранируется', async () => {
    categoryOrders.getCategoryOrdersForPoll.mockResolvedValue([
      orderFixture({
        participantCount: 1,
        category: 'Плов_с бараниной',
        responsibleUser: { id: 1, firstName: 'Аня_К' },
      }),
    ]);

    await MultiCategoryResponsibleService.startMultiCategorySelection(5);

    const message = editMessageText.mock.calls[0][2];
    expect(message).toContain('Плов\\_с бараниной');
    expect(message).toContain('Аня\\_К');
  });

  it('уже распределённая категория сразу рассылает уведомления', async () => {
    categoryOrders.getCategoryOrdersForPoll.mockResolvedValue([
      orderFixture({
        selectionStatus: 'SELECTED_AUTO',
        participantCount: 1,
        responsibleUser: { id: 1, firstName: 'Игорь', telegramId: BigInt(555) },
      }),
    ]);

    await MultiCategoryResponsibleService.startMultiCategorySelection(5);

    expect(sendMessage).toHaveBeenCalledWith('555', expect.any(String));
    expect(editMessageText).not.toHaveBeenCalled();
  });

  it('без категорий ничего не происходит', async () => {
    categoryOrders.getCategoryOrdersForPoll.mockResolvedValue([]);

    await MultiCategoryResponsibleService.startMultiCategorySelection(5);

    expect(editMessageText).not.toHaveBeenCalled();
  });

  it('без сообщения голосования правка невозможна, но процесс не падает', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({
      chatId: null,
      messageId: null,
    });

    await expect(
      MultiCategoryResponsibleService.startMultiCategorySelection(5)
    ).resolves.toBeUndefined();
    expect(editMessageText).not.toHaveBeenCalled();
  });

  it('битый список блюд не роняет сборку сообщения', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({
      chatId: BigInt(-1001),
      messageId: 77,
      duration: 30,
      startedAt: NOW,
      selectedMenuItemIds: '{не json',
    });

    await MultiCategoryResponsibleService.startMultiCategorySelection(5);

    expect(editMessageText).toHaveBeenCalled();
  });

  it('по истечении трёх минут запускается рулетка', async () => {
    await MultiCategoryResponsibleService.startMultiCategorySelection(5);
    editMessageText.mockClear();

    await jest.advanceTimersByTimeAsync(3 * 60 * 1000);

    expect(categoryOrders.setResponsible).toHaveBeenCalledWith(
      1,
      expect.any(Number),
      'roulette'
    );
  });
});

describe('handleVolunteerForCategory', () => {
  it('категории нет — отказ', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue(null);

    await expect(
      MultiCategoryResponsibleService.handleVolunteerForCategory(1, BigInt(555))
    ).resolves.toBe(false);
  });

  it('незнакомый пользователь — отказ', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      MultiCategoryResponsibleService.handleVolunteerForCategory(1, BigInt(555))
    ).resolves.toBe(false);
  });

  it('не участник группы — отказ', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);

    await expect(
      MultiCategoryResponsibleService.handleVolunteerForCategory(1, BigInt(555))
    ).resolves.toBe(false);
  });
});

describe('handleVolunteerTimeoutForCategory', () => {
  it('нераспределённая категория уходит в рулетку', async () => {
    await MultiCategoryResponsibleService.handleVolunteerTimeoutForCategory(1);

    expect(categoryOrders.setResponsible).toHaveBeenCalledWith(
      1,
      expect.any(Number),
      'roulette'
    );
  });

  it('уже распределённую категорию таймаут не трогает', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue(
      orderFixture({ selectionStatus: 'SELECTED_VOLUNTEER' })
    );

    await MultiCategoryResponsibleService.handleVolunteerTimeoutForCategory(1);

    expect(categoryOrders.setResponsible).not.toHaveBeenCalled();
  });

  it('категории нет — тихо выходим', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue(null);

    await expect(
      MultiCategoryResponsibleService.handleVolunteerTimeoutForCategory(1)
    ).resolves.toBeUndefined();
  });
});

describe('runRouletteForCategory', () => {
  it('выбирает из тех, кто ещё не ответственный', async () => {
    // Участник 1 уже ведёт другую категорию, 2 и 3 свободны.
    asMock(prismaMock.categoryOrder.findFirst).mockImplementation((async (args: {
      where: { responsibleUserId: number };
    }) => (args.where.responsibleUserId === 1 ? { id: 2 } : null)) as never);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    await MultiCategoryResponsibleService.runRouletteForCategory(1);

    expect(categoryOrders.setResponsible).toHaveBeenCalledWith(1, 2, 'roulette');
    randomSpy.mockRestore();
  });

  it('если свободных нет — выбирает из всех участников', async () => {
    asMock(prismaMock.categoryOrder.findFirst).mockResolvedValue({
      id: 2,
    });
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    await MultiCategoryResponsibleService.runRouletteForCategory(1);

    expect(categoryOrders.setResponsible).toHaveBeenCalledWith(1, 1, 'roulette');
    randomSpy.mockRestore();
  });

  it('выбранный получает XP с ключом, одинаковым при повторе', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    await MultiCategoryResponsibleService.runRouletteForCategory(1);
    await MultiCategoryResponsibleService.runRouletteForCategory(1);

    const keys = awardXP.mock.calls.map(call => call[5]);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toEqual(expect.any(String));
    expect(keys[1]).toBe(keys[0]);
    randomSpy.mockRestore();
  });

  it('без участников рулетка не запускается', async () => {
    categoryOrders.getParticipants.mockResolvedValue([]);

    await MultiCategoryResponsibleService.runRouletteForCategory(1);

    expect(categoryOrders.setResponsible).not.toHaveBeenCalled();
  });

  it('категории нет — тихо выходим', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue(null);

    await MultiCategoryResponsibleService.runRouletteForCategory(1);

    expect(categoryOrders.setResponsible).not.toHaveBeenCalled();
  });

  it('победителя нет в базе — уведомления не рассылаются', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await MultiCategoryResponsibleService.runRouletteForCategory(1);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('падение назначения не выбрасывается наружу', async () => {
    categoryOrders.setResponsible.mockRejectedValue(new Error('db down'));

    await expect(
      MultiCategoryResponsibleService.runRouletteForCategory(1)
    ).resolves.toBeUndefined();
  });
});

describe('сообщение со списком категорий', () => {
  it('когда все распределены — кнопок нет', async () => {
    await MultiCategoryResponsibleService.startMultiCategorySelection(5);
    editMessageText.mockClear();
    // Доброволец забрал последнюю категорию.
    await MultiCategoryResponsibleService.handleVolunteerForCategory(
      1,
      BigInt(555)
    );

    const [, , , options] = editMessageText.mock.calls[0];
    expect(options.reply_markup.inline_keyboard).toEqual([]);
  });

  it('падение правки сообщения не роняет процесс', async () => {
    editMessageText.mockRejectedValue(new Error('message not modified'));

    await expect(
      MultiCategoryResponsibleService.startMultiCategorySelection(5)
    ).resolves.toBeUndefined();
  });
});

/**
 * Guard «бота нет» проверял ССЫЛКУ на локальный хелпер `botInstance`, а не
 * результат вызова, поэтому ветка отказа была недостижима и код падал ниже
 * на `botInstance()!.api` с TypeError.
 */
describe('бота нет', () => {
  beforeEach(() => {
    botInstance.mockReturnValue(null);
  });

  it('распределение категорий проходит, сообщение не правится', async () => {
    await expect(
      MultiCategoryResponsibleService.startMultiCategorySelection(5)
    ).resolves.toBeUndefined();
  });

  it('доброволец забирает категорию и без бота', async () => {
    await expect(
      MultiCategoryResponsibleService.handleVolunteerForCategory(1, BigInt(555))
    ).resolves.toBe(true);

    expect(categoryOrders.setResponsible).toHaveBeenCalledWith(
      1,
      1,
      'volunteer'
    );
  });

  /* Метод не отправляет сообщений — он ставит таймаут фолбэка на рулетку.
     Без бота он обязан работать как обычно, иначе категория останется
     VOLUNTEER_OPEN навсегда. */
  it('фолбэк на рулетку ставится и без бота', async () => {
    await expect(
      MultiCategoryResponsibleService.sendVolunteerPromptForCategory(1)
    ).resolves.toBeUndefined();

    expect(categoryOrders.setResponsible).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(3 * 60 * 1000);

    expect(categoryOrders.setResponsible).toHaveBeenCalledWith(
      1,
      expect.any(Number),
      'roulette'
    );
  });
});

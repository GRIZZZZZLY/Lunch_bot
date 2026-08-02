/**
 * Распределение ответственных по категориям. Правило продукта: один человек —
 * одна категория, поэтому проверяется, что второй раз взять роль нельзя, и что
 * рулетка сначала пытается выбрать из тех, кто ещё свободен.
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

    const [, , message, options] = editMessageText.mock.calls[0];
    expect(message).toContain('Категории заказа');
    expect(message).toContain('⏳ Плов — 3 участников');
    expect(options.reply_markup.inline_keyboard[0][0]).toMatchObject({
      callback_data: 'volunteer_category:1',
    });
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

    expect(sendMessage).toHaveBeenCalledWith(
      '555',
      expect.stringContaining('Ты ответственный за "Плов"')
    );
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

  it('ошибка чтения категорий выбрасывается наружу', async () => {
    categoryOrders.getCategoryOrdersForPoll.mockRejectedValue(
      new Error('db down')
    );

    await expect(
      MultiCategoryResponsibleService.startMultiCategorySelection(5)
    ).rejects.toThrow('db down');
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
  it('участник категории забирает роль и получает XP', async () => {
    const claimed =
      await MultiCategoryResponsibleService.handleVolunteerForCategory(
        1,
        BigInt(555)
      );

    expect(claimed).toBe(true);
    expect(categoryOrders.setResponsible).toHaveBeenCalledWith(1, 1, 'volunteer');
    expect(awardXP).toHaveBeenCalledWith(
      1,
      expect.any(Number),
      expect.any(String),
      expect.any(String),
      { categoryOrderId: 1, selectionMode: 'volunteer' },
      'category-volunteer:1:1'
    );
  });

  it('категории нет — отказ', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue(null);

    await expect(
      MultiCategoryResponsibleService.handleVolunteerForCategory(1, BigInt(555))
    ).resolves.toBe(false);
  });

  it('категория уже распределена — отказ', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue(
      orderFixture({ selectionStatus: 'SELECTED_VOLUNTEER' })
    );

    await expect(
      MultiCategoryResponsibleService.handleVolunteerForCategory(1, BigInt(555))
    ).resolves.toBe(false);
    expect(categoryOrders.setResponsible).not.toHaveBeenCalled();
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

  it('не голосовавшему за категорию отвечают отказом в личку', async () => {
    categoryOrders.getParticipants.mockResolvedValue([2, 3]);

    const claimed =
      await MultiCategoryResponsibleService.handleVolunteerForCategory(
        1,
        BigInt(555)
      );

    expect(claimed).toBe(false);
    expect(sendMessage).toHaveBeenCalledWith(
      '555',
      expect.stringContaining('Ты не участвуешь в этой категории')
    );
  });

  it('один человек — одна категория: второй раз роль не взять', async () => {
    asMock(prismaMock.categoryOrder.findFirst).mockResolvedValue({
      id: 2,
      category: 'Шурпа',
    });

    const claimed =
      await MultiCategoryResponsibleService.handleVolunteerForCategory(
        1,
        BigInt(555)
      );

    expect(claimed).toBe(false);
    expect(sendMessage).toHaveBeenCalledWith(
      '555',
      expect.stringContaining('Ты уже ответственный за "Шурпа"')
    );
    expect(categoryOrders.setResponsible).not.toHaveBeenCalled();
  });

  it('гонка на записи (категорию заняли) даёт false, а не исключение', async () => {
    categoryOrders.setResponsible.mockRejectedValue(
      new Error('Failed to set responsible user')
    );

    await expect(
      MultiCategoryResponsibleService.handleVolunteerForCategory(1, BigInt(555))
    ).resolves.toBe(false);
  });

  it('участникам сообщают, что ждут расчёта, и запоминают их сообщения', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: 1,
        firstName: 'Игорь',
        telegramId: BigInt(555),
      } as never)
      .mockResolvedValueOnce({ id: 2, telegramId: BigInt(777) } as never)
      .mockResolvedValueOnce({ id: 3, telegramId: BigInt(888) } as never);

    await MultiCategoryResponsibleService.handleVolunteerForCategory(
      1,
      BigInt(555)
    );

    expect(sendMessage).toHaveBeenCalledWith(
      '777',
      expect.stringContaining('Ожидаем расчёт от Игорь')
    );
    expect(prismaMock.categoryOrder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { participantMessages: expect.stringContaining('"messageId":42') },
    });
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

  it('выбранный получает XP с идемпотентным ключом', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    await MultiCategoryResponsibleService.runRouletteForCategory(1);

    expect(awardXP).toHaveBeenCalledWith(
      1,
      expect.any(Number),
      expect.any(String),
      expect.any(String),
      { categoryOrderId: 1, selectionMode: 'roulette' },
      'category-roulette:1:1'
    );
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
  it('распределённые категории показываются с именем ответственного', async () => {
    categoryOrders.getCategoryOrdersForPoll.mockResolvedValue([
      orderFixture({
        id: 1,
        selectionStatus: 'SELECTED_VOLUNTEER',
        responsibleUser: { id: 1, firstName: 'Игорь', telegramId: BigInt(555) },
      }),
      orderFixture({ id: 2, category: 'Шурпа' }),
    ]);

    await MultiCategoryResponsibleService.startMultiCategorySelection(5);

    const message = editMessageText.mock.calls[0][2] as string;
    expect(message).toContain('✅ Плов — Игорь');
    expect(message).toContain('⏳ Шурпа');
  });

  it('категория на одного помечается как авто', async () => {
    categoryOrders.getCategoryOrdersForPoll.mockResolvedValue([
      orderFixture({
        id: 1,
        participantCount: 1,
        selectionStatus: 'SELECTED_AUTO',
        responsibleUser: { id: 1, firstName: 'Игорь', telegramId: BigInt(555) },
      }),
      orderFixture({ id: 2, category: 'Шурпа' }),
    ]);

    await MultiCategoryResponsibleService.startMultiCategorySelection(5);

    expect(editMessageText.mock.calls[0][2]).toContain('✅ Плов — Игорь (авто)');
  });

  it('когда все распределены — кнопок нет и сказано об этом', async () => {
    await MultiCategoryResponsibleService.startMultiCategorySelection(5);
    editMessageText.mockClear();
    // Доброволец забрал последнюю категорию.
    await MultiCategoryResponsibleService.handleVolunteerForCategory(
      1,
      BigInt(555)
    );

    const [, , message, options] = editMessageText.mock.calls[0];
    expect(message).toContain('Все категории распределены');
    expect(options.reply_markup.inline_keyboard).toEqual([]);
  });

  it('падение правки сообщения не роняет процесс', async () => {
    editMessageText.mockRejectedValue(new Error('message not modified'));

    await expect(
      MultiCategoryResponsibleService.startMultiCategorySelection(5)
    ).resolves.toBeUndefined();
  });
});

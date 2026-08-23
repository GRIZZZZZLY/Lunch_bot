/**
 * Доставка голосования в группу и его автозавершение по таймеру. Это самый
 * заметный путь в продукте: сообщение в группе, таймер, итоги в том же
 * сообщении.
 *
 * Файл переименован вслед за кодом: функция жила в `poll.service.extensions.ts`
 * под именем `createPollFromWebApp`, теперь это `createAndSendPoll` из
 * `poll-send.service.ts` (задача 06). Модули по пути — `poll-announce` (текст и
 * правка сообщений) и `poll-timer` (таймер) — здесь НЕ замоканы: проверяется
 * вся цепочка до вызова бота, как и раньше.
 *
 * Ключевые свойства: chatId и messageId обязаны попасть в базу (без них
 * последующие правки сообщения некуда адресовать), а таймер автозавершения
 * должен проверять, что голосование ещё активно — иначе досрочно закрытое
 * голосование «завершилось» бы второй раз.
 */
import { createAndSendPoll } from '../../../services/poll-send.service';
import { PollService } from '../../../services/poll.service';
import { GroupService } from '../../../services/group.service';
import { VoteService } from '../../../services/vote.service';
import { CategoryOrderService } from '../../../services/category-order.service';
import { MultiCategoryResponsibleService } from '../../../services/multi-category-responsible.service';
import { UserService } from '../../../services/user.service';
import {
  getBotInstance,
  BotNotInitializedError,
} from '../../../bot/bot-instance';
import { asMock, asServiceMock } from '../../helpers/mocks';
import { PollQueryService } from '../../../services/poll-query.service';
import { PollStatsService } from '../../../services/poll-stats.service';
import { PollCompletionService } from '../../../services/poll-completion.service';

jest.mock('../../../services/poll.service', () => ({
  PollService: {
    createPoll: jest.fn(),
    updatePoll: jest.fn(),
    runRoulette: jest.fn(),
  },
}));

jest.mock('../../../services/poll-completion.service', () => ({
  PollCompletionService: {
    completePoll: jest.fn(),
  },
}));


jest.mock('../../../services/poll-stats.service', () => ({
  PollStatsService: {
    getPollVoteBreakdown: jest.fn(),
  },
}));


jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: {
    getPollById: jest.fn(),
  },
}));


jest.mock('../../../services/group.service', () => ({
  GroupService: {
    getGroupById: jest.fn(),
    getRealMemberCount: jest.fn(),
    getGroupSettings: jest.fn(),
    updateGroupSettings: jest.fn(),
  },
}));

jest.mock('../../../services/vote.service', () => ({
  VoteService: { getPollVotes: jest.fn() },
}));

jest.mock('../../../services/notification.service', () => ({
  NotificationService: jest.fn(),
}));

jest.mock('../../../services/user.service', () => ({
  UserService: { getPaymentInfo: jest.fn() },
}));

jest.mock('../../../services/category-order.service', () => ({
  CategoryOrderService: { createCategoryOrders: jest.fn() },
}));

jest.mock('../../../services/multi-category-responsible.service', () => ({
  MultiCategoryResponsibleService: {
    startMultiCategorySelection: jest.fn(),
  },
}));

/* getRequiredBotInstance выражен через getBotInstance, чтобы один mockReturnValue
   управлял обеими дверями: createPollFromWebApp обязан упасть без бота (его
   контракт — вернуть messageId), а автозавершение — тихо выйти. Класс ошибки
   берём настоящий: тест сверяется с тем типом, который ловит HTTP-слой, а не
   с текстом, придуманным здесь. */
jest.mock('../../../bot/bot-instance', () => {
  const actual = jest.requireActual('../../../bot/bot-instance');
  const getBotInstance = jest.fn();
  return {
    BotNotInitializedError: actual.BotNotInitializedError,
    getBotInstance,
    getRequiredBotInstance: () => {
      const bot = getBotInstance();
      if (!bot) throw new actual.BotNotInitializedError();
      return bot;
    },
  };
});

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const pollService = asServiceMock(PollService);
const pollCompletion = asServiceMock(PollCompletionService);
const pollStats = asServiceMock(PollStatsService);
const pollQuery = asServiceMock(PollQueryService);
const groupService = asServiceMock(GroupService);
const voteService = asServiceMock(VoteService);
const categoryOrders = asServiceMock(CategoryOrderService);
const multiCategory = asServiceMock(MultiCategoryResponsibleService);
const userService = asServiceMock(UserService);
const botInstance = asMock(getBotInstance);

const NOW = new Date('2026-08-03T12:00:00.000Z');

const MENU_ITEMS = [
  { id: 1, name: 'Плов', price: 250 },
  { id: 2, name: 'Шурпа', price: 200 },
] as never[];

const PARAMS = {
  groupId: 100,
  duration: 30,
  createdBy: 1,
  menuItems: MENU_ITEMS,
};

let sendMessage: jest.Mock;
let editMessageText: jest.Mock;
let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  /* .env подтягивается по цепочке импортов (config/bot.config), и там
     AUTO_ROULETTE_ENABLED=true. Флаг задаём явно: иначе откат на личные
     уведомления уходит в ветку с рулеткой и двухсекундной паузой, и тест
     проверял бы не то, что написано в его названии. */
  envBackup = { ...process.env };
  process.env.AUTO_ROULETTE_ENABLED = 'false';

  sendMessage = jest.fn().mockResolvedValue({ message_id: 77 });
  editMessageText = jest.fn().mockResolvedValue(undefined);
  botInstance.mockReturnValue({ api: { sendMessage, editMessageText } });

  groupService.getGroupById.mockResolvedValue({
    id: 100,
    telegramId: BigInt(-1001),
  });
  groupService.getRealMemberCount.mockResolvedValue(8);
  groupService.getGroupSettings.mockResolvedValue({ expectedParticipants: 5 });
  groupService.updateGroupSettings.mockResolvedValue(undefined);

  pollService.createPoll.mockResolvedValue({ id: 5, groupId: 100 });
  pollService.updatePoll.mockResolvedValue({ id: 5 });
  pollQuery.getPollById.mockResolvedValue({
    id: 5,
    status: 'ACTIVE',
    duration: 30,
    selectedMenuItemIds: '[1,2]',
    title: null,
  });
  pollCompletion.completePoll.mockResolvedValue({ totalVotes: 3 });
  pollStats.getPollVoteBreakdown.mockResolvedValue([
    { menuItemId: 1, menuItemName: 'Плов', votes: 2, percentage: 67, voters: [] },
  ]);
  voteService.getPollVotes.mockResolvedValue([
    { id: 1, menuItemId: 1, user: { id: 1, telegramId: BigInt(555) } },
  ]);
  categoryOrders.createCategoryOrders.mockResolvedValue([{ id: 1 }]);
  multiCategory.startMultiCategorySelection.mockResolvedValue(undefined);
  userService.getPaymentInfo.mockResolvedValue({ paymentCard: 'card' });
});

afterEach(() => {
  jest.useRealTimers();
  process.env = envBackup;
});

describe('createAndSendPoll', () => {
  it('создаёт голосование и отправляет сообщение в группу', async () => {
    const result = await createAndSendPoll(PARAMS);

    expect(pollService.createPoll).toHaveBeenCalledWith({
      groupId: 100,
      duration: 30,
      createdBy: 1,
      isMultiSelect: true,
      maxSelections: 3,
    });
    expect(sendMessage).toHaveBeenCalledWith(
      -1001,
      expect.stringContaining('Голосование за обед запущено'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
    expect(result).toEqual({ pollId: 5, messageId: 77 });
  });

  it('chatId и messageId сохраняются — без них сообщение потом не поправить', async () => {
    await createAndSendPoll(PARAMS);

    expect(pollService.updatePoll).toHaveBeenCalledWith(5, {
      chatId: BigInt(-1001),
      messageId: 77,
    });
  });

  it('выбранные блюда сохраняются строкой JSON', async () => {
    await createAndSendPoll({ ...PARAMS, selectedMenuItemIds: [1, 2] });

    expect(pollService.updatePoll).toHaveBeenCalledWith(5, {
      selectedMenuItemIds: '[1,2]',
    });
  });

  it('пустой список выбранных блюд не пишется', async () => {
    await createAndSendPoll({ ...PARAMS, selectedMenuItemIds: [] });

    expect(pollService.updatePoll).not.toHaveBeenCalledWith(
      5,
      expect.objectContaining({ selectedMenuItemIds: expect.anything() })
    );
  });

  it('своё название попадает в сообщение', async () => {
    await createAndSendPoll({ ...PARAMS, title: 'Пятничный обед' });

    expect(sendMessage.mock.calls[0][1]).toContain('Пятничный обед');
  });

  it('одиночный выбор передаётся в сервис как есть', async () => {
    await createAndSendPoll({
      ...PARAMS,
      isMultiSelect: false,
      maxSelections: 1,
    });

    expect(pollService.createPoll).toHaveBeenCalledWith(
      expect.objectContaining({ isMultiSelect: false, maxSelections: 1 })
    );
  });

  it('число участников обновляется по реальному составу группы', async () => {
    await createAndSendPoll(PARAMS);

    expect(groupService.updateGroupSettings).toHaveBeenCalledWith(100, {
      expectedParticipants: 8,
    });
  });

  it('неизвестное число участников не затирает настройки', async () => {
    groupService.getRealMemberCount.mockResolvedValue(0);

    await createAndSendPoll(PARAMS);

    expect(groupService.updateGroupSettings).not.toHaveBeenCalled();
  });

  it('падение подсчёта участников не мешает создать голосование', async () => {
    groupService.getRealMemberCount.mockRejectedValue(new Error('api down'));

    await expect(createAndSendPoll(PARAMS)).resolves.toMatchObject({
      pollId: 5,
    });
  });

  it('группа не найдена — понятная ошибка', async () => {
    groupService.getGroupById.mockResolvedValue(null);

    await expect(createAndSendPoll(PARAMS)).rejects.toThrow('Group not found');
    expect(pollService.createPoll).not.toHaveBeenCalled();
  });

  it('падение отправки в Telegram выбрасывается наружу', async () => {
    sendMessage.mockRejectedValue(new Error('chat not found'));

    await expect(createAndSendPoll(PARAMS)).rejects.toThrow('chat not found');
  });

  it('дедлайн в сообщении считается от текущего момента', async () => {
    await createAndSendPoll(PARAMS);

    // 12:00 UTC + 30 мин = 12:30 UTC = 15:30 по Москве.
    expect(sendMessage.mock.calls[0][1]).toContain('До 15:30');
  });
});

describe('автозавершение по таймеру', () => {
  /**
   * Пропускает таймер вместе с микрозадачами: автозавершение — длинная цепочка
   * await-ов, и обычный advanceTimersByTime возвращает управление раньше, чем
   * она доходит до отправки уведомлений.
   */
  async function fireTimer(minutes = 30): Promise<void> {
    await jest.advanceTimersByTimeAsync(minutes * 60 * 1000);
  }

  it('активное голосование завершается и итоги уходят в то же сообщение', async () => {
    await createAndSendPoll(PARAMS);

    await fireTimer();

    expect(pollCompletion.completePoll).toHaveBeenCalledWith(5);
    expect(editMessageText).toHaveBeenCalledWith(
      -1001,
      77,
      expect.stringContaining('Голосование завершено'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
  });

  it('уже завершённое голосование повторно не закрывается', async () => {
    pollQuery.getPollById.mockResolvedValue({
      id: 5,
      status: 'COMPLETED',
      selectedMenuItemIds: '[]',
    });
    await createAndSendPoll(PARAMS);

    await fireTimer();

    expect(pollCompletion.completePoll).not.toHaveBeenCalled();
  });

  it('при наличии голосов запускается разбор по категориям', async () => {
    await createAndSendPoll(PARAMS);

    await fireTimer();

    expect(categoryOrders.createCategoryOrders).toHaveBeenCalledWith(5);
    expect(multiCategory.startMultiCategorySelection).toHaveBeenCalledWith(5);
  });

  it('без голосов категорий не создаётся', async () => {
    pollCompletion.completePoll.mockResolvedValue({ totalVotes: 0 });
    await createAndSendPoll(PARAMS);

    await fireTimer();

    expect(categoryOrders.createCategoryOrders).not.toHaveBeenCalled();
  });

  it('падение разбора по категориям откатывается на личные уведомления', async () => {
    categoryOrders.createCategoryOrders.mockRejectedValue(
      new Error('categories down')
    );
    await createAndSendPoll(PARAMS);

    await fireTimer();

    // Участник получает личное сообщение с итогами.
    expect(sendMessage).toHaveBeenCalledWith(
      555,
      expect.stringContaining('Голосование завершено'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
  });

  it('с включённой авторулеткой откат назначает ответственного и рассылает реквизиты', async () => {
    process.env.AUTO_ROULETTE_ENABLED = 'true';
    categoryOrders.createCategoryOrders.mockRejectedValue(
      new Error('categories down')
    );
    pollService.runRoulette.mockResolvedValue({
      responsibleUser: { id: 2, firstName: 'Аня', username: 'anya' },
    });
    await createAndSendPoll(PARAMS);

    await fireTimer();
    // Ветка с рулеткой ждёт 2 секунды перед запуском — этот таймер создаётся
    // уже во время обработки, поэтому его нужно проскочить отдельно.
    await jest.advanceTimersByTimeAsync(3000);

    expect(pollService.runRoulette).toHaveBeenCalledWith(5);
    expect(sendMessage).toHaveBeenCalledWith(
      555,
      expect.stringContaining('Ответственный: Аня (@anya)'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
  });

  it('ответственный без реквизитов — участнику говорят написать напрямую', async () => {
    process.env.AUTO_ROULETTE_ENABLED = 'true';
    categoryOrders.createCategoryOrders.mockRejectedValue(
      new Error('categories down')
    );
    pollService.runRoulette.mockResolvedValue({
      responsibleUser: { id: 2, firstName: 'Аня' },
    });
    userService.getPaymentInfo.mockResolvedValue({});
    await createAndSendPoll(PARAMS);

    await fireTimer();
    await jest.advanceTimersByTimeAsync(3000);

    expect(sendMessage).toHaveBeenCalledWith(
      555,
      expect.stringContaining('не добавил реквизиты'),
      expect.any(Object)
    );
  });

  it('недоставленное личное уведомление не роняет завершение', async () => {
    categoryOrders.createCategoryOrders.mockRejectedValue(
      new Error('categories down')
    );
    sendMessage
      .mockResolvedValueOnce({ message_id: 77 })
      .mockRejectedValue(new Error('bot blocked'));
    await createAndSendPoll(PARAMS);

    await expect(fireTimer()).resolves.toBeUndefined();
  });

  it('падение правки сообщения не отменяет завершение', async () => {
    editMessageText.mockRejectedValue(new Error('message not found'));
    await createAndSendPoll(PARAMS);

    await fireTimer();

    expect(categoryOrders.createCategoryOrders).toHaveBeenCalled();
  });

  it('падение завершения не выбрасывается из таймера', async () => {
    pollCompletion.completePoll.mockRejectedValue(new Error('db down'));
    await createAndSendPoll(PARAMS);

    await expect(fireTimer()).resolves.toBeUndefined();
  });

  it('исчезнувшее голосование не роняет таймер', async () => {
    await createAndSendPoll(PARAMS);
    pollQuery.getPollById.mockResolvedValue(null);

    await expect(fireTimer()).resolves.toBeUndefined();
  });
});

/**
 * Guard «бота нет» проверял ССЫЛКУ на локальный хелпер `botInstance`, а не
 * результат вызова, поэтому ветка отказа была недостижима и код падал ниже
 * на `botInstance()!.api` с TypeError. Решение здесь разное по методам:
 * создание опроса обязано вернуть messageId, поэтому падает громко;
 * автозавершение вызывается из таймера и обязано выйти тихо.
 */
describe('бота нет', () => {
  it('создание падает громко и не создаёт опрос', async () => {
    botInstance.mockReturnValue(null);

    await expect(createAndSendPoll(PARAMS)).rejects.toThrow(
      BotNotInitializedError
    );

    expect(pollService.createPoll).not.toHaveBeenCalled();
  });

  /**
   * Бота могли снять между созданием опроса и срабатыванием таймера.
   *
   * ПОВЕДЕНИЕ ИЗМЕНЕНО ОСОЗНАННО (задача 06). Раньше отсутствие бота
   * прекращало автозавершение целиком: голосование оставалось `ACTIVE`, и
   * позже планировщик его ОТМЕНЯЛ — то есть недоступность чата стоила группе
   * готового результата обеда. Теперь голосование закрывается, итоги
   * считаются, а не отправляется только сообщение в чат: без бота недоступна
   * доставка, а не подсчёт.
   *
   * Из таймера исключение по-прежнему не летит: ловить его некому.
   */
  it('без бота голосование всё равно закрывается, а сообщение не правится', async () => {
    await createAndSendPoll(PARAMS);
    botInstance.mockReturnValue(null);

    await expect(
      jest.advanceTimersByTimeAsync(30 * 60 * 1000)
    ).resolves.toBeUndefined();

    expect(pollCompletion.completePoll).toHaveBeenCalledWith(5);
    expect(editMessageText).not.toHaveBeenCalled();
  });

  /* Личные уведомления — best-effort ветка автозавершения: голосование уже
     закрыто, недоставленные сообщения не должны ронять таймер. */
  it('личные уведомления пропускаются без падения', async () => {
    process.env.AUTO_ROULETTE_ENABLED = 'false';
    categoryOrders.createCategoryOrders.mockRejectedValue(
      new Error('no categories')
    );
    await createAndSendPoll(PARAMS);
    sendMessage.mockClear();
    botInstance.mockReturnValue(null);

    await expect(
      jest.advanceTimersByTimeAsync(30 * 60 * 1000)
    ).resolves.toBeUndefined();

    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe('пересчёт числа участников', () => {
  /* Раньше сюда уезжала ССЫЛКА на локальный хелпер `botInstance`: у функции
     нет `.api`, поэтому getRealMemberCount молча отдавал null, и
     expectedParticipants никогда не обновлялся из Telegram. */
  it('в getRealMemberCount уходит сам бот, а не функция', async () => {
    await createAndSendPoll(PARAMS);

    const [, passedBot] = groupService.getRealMemberCount.mock.calls[0];
    expect(typeof passedBot).toBe('object');
    expect(passedBot).toHaveProperty('api');
  });

  it('полученное число участников попадает в настройки группы', async () => {
    await createAndSendPoll(PARAMS);

    expect(groupService.updateGroupSettings).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ expectedParticipants: 8 })
    );
  });
});

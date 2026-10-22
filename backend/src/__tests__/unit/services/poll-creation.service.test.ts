/**
 * Создание и повтор голосования: значения по умолчанию, ограничения выбора и
 * ветки, которые не видны через HTTP. Отказы на маршруте (чужие блюда, уже
 * идущее голосование, меньше двух блюд, повтор несуществующего) проверяются на
 * настоящей БД в integration/api/polls-lifecycle.redis.test.ts.
 *
 * Отказы проверяются по ТИПУ ошибки, а не по тексту: статус и код клиенту
 * выбирает класс, и подмена класса — это подмена ответа.
 */
import {
  createPollForGroup,
  repeatPoll,
} from '../../../services/poll-creation.service';
import {
  NoMenuItemsError,
  PollGroupNotFoundError,
} from '../../../services/poll.errors';
import { GroupService } from '../../../services/group.service';
import { MenuService } from '../../../services/menu.service';
import { PollService } from '../../../services/poll.service';
import { createAndSendPoll } from '../../../services/poll-send.service';
import { asMock, asServiceMock } from '../../helpers/mocks';
import { PollQueryService } from '../../../services/poll-query.service';

jest.mock('../../../services/group.service', () => ({
  GroupService: { getGroupById: jest.fn() },
}));

jest.mock('../../../services/menu.service', () => ({
  MenuService: { getActiveMenuItems: jest.fn(), getMenuItemsByIds: jest.fn() },
}));

jest.mock('../../../services/poll.service', () => ({
  PollService: {
  },
}));

jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: {
    getPollById: jest.fn(),
    getActivePollInGroup: jest.fn(),
  },
}));


jest.mock('../../../services/poll-send.service', () => ({
  createAndSendPoll: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const groups = asServiceMock(GroupService);
const menu = asServiceMock(MenuService);
const polls = asServiceMock(PollService);
const pollQuery = asServiceMock(PollQueryService);
const sendPoll = asMock(createAndSendPoll);

const MENU = [
  { id: 1, name: 'Плов' },
  { id: 2, name: 'Шурпа' },
  { id: 3, name: 'Лагман' },
];

beforeEach(() => {
  jest.clearAllMocks();
  groups.getGroupById.mockResolvedValue({ id: 100, title: 'Команда' });
  pollQuery.getActivePollInGroup.mockResolvedValue(null);
  menu.getActiveMenuItems.mockResolvedValue(MENU);
  sendPoll.mockResolvedValue({ pollId: 21, messageId: 99 });
});

describe('createPollForGroup', () => {
  const params = { groupId: 100, createdBy: 7, duration: 30 };

  it('без выбора берёт все активные блюда группы', async () => {
    await createPollForGroup(params);

    expect(sendPoll).toHaveBeenCalledWith(
      expect.objectContaining({ selectedMenuItemIds: [1, 2, 3] })
    );
  });

  it('без duration ставит 30 минут', async () => {
    const result = await createPollForGroup({ groupId: 100, createdBy: 7 });

    expect(sendPoll).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 30 })
    );
    expect(result.duration).toBe(30);
  });

  it('одиночный выбор ограничивает maxSelections до 1', async () => {
    await createPollForGroup({ ...params, isMultiSelect: false, maxSelections: 3 });

    expect(sendPoll).toHaveBeenCalledWith(
      expect.objectContaining({ isMultiSelect: false, maxSelections: 1 })
    );
  });

  it('maxSelections больше трёх обрезается до трёх', async () => {
    await createPollForGroup({ ...params, maxSelections: 10 });

    expect(sendPoll).toHaveBeenCalledWith(
      expect.objectContaining({ maxSelections: 3 })
    );
  });

  /* Ноль исторически означает «не задано». Это поведение сохранено при
     переносе намеренно: смена умолчания выглядела бы как та же правка, но
     меняла бы продукт. */
  it('maxSelections = 0 понимается как «не задано» и даёт три', async () => {
    await createPollForGroup({ ...params, maxSelections: 0 });

    expect(sendPoll).toHaveBeenCalledWith(
      expect.objectContaining({ maxSelections: 3 })
    );
  });

  it('группы нет — PollGroupNotFoundError, сообщение в чат не уходит', async () => {
    groups.getGroupById.mockResolvedValue(null);

    await expect(createPollForGroup(params)).rejects.toBeInstanceOf(
      PollGroupNotFoundError
    );
    expect(sendPoll).not.toHaveBeenCalled();
  });

});

describe('repeatPoll', () => {
  function sourcePoll(over: Record<string, unknown> = {}): void {
    pollQuery.getPollById.mockResolvedValue({
      id: 10,
      groupId: 100,
      duration: 45,
      selectedMenuItemIds: null,
      ...over,
    });
  }

  beforeEach(() => {
    sourcePoll();
    menu.getMenuItemsByIds.mockResolvedValue([MENU[0], MENU[1]] as never);
  });

  it('без сохранённого состава берёт все активные блюда группы', async () => {
    await repeatPoll(10, 7);

    expect(menu.getActiveMenuItems).toHaveBeenCalledWith(100);
    expect(sendPoll).toHaveBeenCalledWith(
      expect.objectContaining({ selectedMenuItemIds: undefined })
    );
  });

  /* Битую строку здесь нечем починить, а повтор полезнее отказа. */
  it('битый JSON состава не роняет повтор', async () => {
    sourcePoll({ selectedMenuItemIds: '{не json' });

    await repeatPoll(10, 7);

    expect(menu.getActiveMenuItems).toHaveBeenCalledWith(100);
  });

  it('в группе нет активных блюд — NoMenuItemsError', async () => {
    menu.getActiveMenuItems.mockResolvedValue([] as never);

    await expect(repeatPoll(10, 7)).rejects.toBeInstanceOf(NoMenuItemsError);
    expect(sendPoll).not.toHaveBeenCalled();
  });
});

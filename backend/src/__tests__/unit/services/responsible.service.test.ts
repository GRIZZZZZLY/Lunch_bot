/**
 * Выбор ответственного за заказ. Кто им станет — тот платит за всех и потом
 * собирает деньги, поэтому важны два свойства:
 *
 * 1. Захват роли атомарен: два одновременных «Я оформлю!» не должны сделать
 *    ответственными двоих (updateMany со status: WAITING в условии).
 * 2. Откликнуться может только участник группы, которого ждут в этом
 *    голосовании — иначе назначить себя мог бы посторонний.
 */
import { ResponsibleService } from '../../../services/responsible.service';
import { PollService } from '../../../services/poll.service';
import { UserService } from '../../../services/user.service';
import { GroupService } from '../../../services/group.service';
import { RouletteService } from '../../../services/roulette.service';
import { PollFlowService } from '../../../services/poll-flow.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { awardXP } from '../../helpers/gamification-mock';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/poll.service', () => ({
  PollService: { getPollById: jest.fn() },
}));

jest.mock('../../../services/user.service', () => ({
  UserService: { getUserByTelegramId: jest.fn() },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: {
    getGroupSettings: jest.fn(),
    isUserGroupMember: jest.fn(),
  },
}));

/* RouletteService создаётся через new — мокаем как класс, экземпляр берём
   через функцию (фабрика jest.mock поднимается выше объявлений). */
let rouletteStub: Record<string, jest.Mock>;
function currentRouletteStub(): Record<string, jest.Mock> {
  return rouletteStub;
}

jest.mock('../../../services/roulette.service', () => ({
  RouletteService: jest.fn(() => currentRouletteStub()),
}));

jest.mock('../../../services/gamification.service', () =>
  require('../../helpers/gamification-mock')
);

/* PollFlowService подтягивается динамически с расширением .js — для jest это
   отдельный путь модуля, нужен второй мок. */
jest.mock('../../../services/poll-flow.service', () => ({
  PollFlowService: { processResponsibleSelected: jest.fn() },
}));

jest.mock(
  '../../../services/poll-flow.service.js',
  () => require('../../../services/poll-flow.service'),
  { virtual: true }
);

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const pollService = asServiceMock(PollService);
const userService = asServiceMock(UserService);
const groupService = asServiceMock(GroupService);
const pollFlowService = asServiceMock(PollFlowService);
const botInstance = asMock(getBotInstance);

const NOW = new Date('2026-08-03T12:00:00.000Z');
const USER = { id: 7, firstName: 'Игорь', telegramId: BigInt(555) };

const RESULT_DATA = {
  winners: [
    {
      menuItemName: 'Плов',
      voteCount: 2,
      menuItemSnapshot: { price: 250 },
    },
  ],
  bringOwn: { count: 1 },
};

function pollFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    groupId: 100,
    chatId: BigInt(-1001),
    messageId: 42,
    result: { rouletteData: JSON.stringify(RESULT_DATA) },
    ...overrides,
  };
}

let sendMessage: jest.Mock;
let editMessageText: jest.Mock;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  sendMessage = jest.fn().mockResolvedValue({ message_id: 99 });
  editMessageText = jest.fn().mockResolvedValue(undefined);
  botInstance.mockReturnValue({ api: { sendMessage, editMessageText } });

  rouletteStub = {
    runRoulette: jest.fn().mockResolvedValue({
      responsibleUserId: 7,
      responsibleUserName: 'Игорь',
    }),
  };

  pollService.getPollById.mockResolvedValue(pollFixture());
  groupService.getGroupSettings.mockResolvedValue({
    responsibleSelectionMode: 'volunteer_with_fallback',
    volunteerTimeoutMinutes: 3,
  });
  groupService.isUserGroupMember.mockResolvedValue(true);
  userService.getUserByTelegramId.mockResolvedValue(USER);
  pollFlowService.processResponsibleSelected.mockResolvedValue(undefined);

  asMock(prismaMock.responsibleSelection.create).mockResolvedValue({
    id: 1,
    timeoutMinutes: 3,
  });
  asMock(prismaMock.responsibleSelection.findUnique).mockResolvedValue({
    id: 1,
    status: 'WAITING',
    messageId: 42,
    chatId: BigInt(-1001),
  });
  asMock(prismaMock.responsibleSelection.update).mockResolvedValue({
    id: 1,
  });
  asMock(prismaMock.responsibleSelection.updateMany).mockResolvedValue({
    count: 1,
  });
  asMock(prismaMock.pollResult.update).mockResolvedValue({ id: 1 });
  asMock(prismaMock.poll.findUnique).mockResolvedValue({ groupId: 100 });
  asMock(prismaMock.pollParticipant.count).mockResolvedValue(1);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('startResponsibleSelection', () => {
  it('в режиме добровольца создаёт запись с таймаутом и правит сообщение группы', async () => {
    await ResponsibleService.startResponsibleSelection(5);

    expect(prismaMock.responsibleSelection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pollId: 5,
        mode: 'volunteer_with_fallback',
        status: 'WAITING',
        timeoutMinutes: 3,
        timeoutAt: new Date('2026-08-03T12:03:00.000Z'),
      }),
    });
    expect(editMessageText).toHaveBeenCalled();
  });

  it('в режиме рулетки доброволец не ожидается', async () => {
    groupService.getGroupSettings.mockResolvedValue({
      responsibleSelectionMode: 'roulette',
    });

    await ResponsibleService.startResponsibleSelection(5);

    expect(prismaMock.responsibleSelection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mode: 'roulette', timeoutAt: null }),
    });
    expect(rouletteStub.runRoulette).toHaveBeenCalledWith(5);
  });

  it('без настройки берётся режим с добровольцем', async () => {
    groupService.getGroupSettings.mockResolvedValue({});

    await ResponsibleService.startResponsibleSelection(5);

    expect(prismaMock.responsibleSelection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mode: 'volunteer_with_fallback' }),
    });
  });

  it('без голосования ничего не создаётся', async () => {
    pollService.getPollById.mockResolvedValue(null);

    await ResponsibleService.startResponsibleSelection(5);

    expect(prismaMock.responsibleSelection.create).not.toHaveBeenCalled();
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.responsibleSelection.create).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      ResponsibleService.startResponsibleSelection(5)
    ).rejects.toThrow('db down');
  });
});

describe('sendVolunteerPrompt', () => {
  const selection = { id: 1, timeoutMinutes: 3 };

  it('в сообщении есть итоги, сумма и кнопка отклика', async () => {
    await ResponsibleService.sendVolunteerPrompt(5, selection);

    const [, , message, options] = editMessageText.mock.calls[0];
    expect(message).toContain('Плов — 2 чел. (500.00₽)');
    expect(message).toContain('Общая сумма: 500₽');
    expect(message).toContain('Принесут своё — 1 чел.');
    expect(options.reply_markup.inline_keyboard[0][0]).toMatchObject({
      callback_data: 'volunteer:5',
    });
  });

  it('без сообщения голосования отправляется новое и его id сохраняется', async () => {
    pollService.getPollById.mockResolvedValue(pollFixture({ messageId: null }));

    await ResponsibleService.sendVolunteerPrompt(5, selection);

    expect(sendMessage).toHaveBeenCalled();
    expect(prismaMock.responsibleSelection.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { messageId: 99 },
    });
  });

  it('без результатов голосования подсказка не отправляется', async () => {
    pollService.getPollById.mockResolvedValue(pollFixture({ result: null }));

    await ResponsibleService.sendVolunteerPrompt(5, selection);

    expect(editMessageText).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('по истечении таймаута включается рулетка', async () => {
    await ResponsibleService.sendVolunteerPrompt(5, selection);

    jest.advanceTimersByTime(3 * 60 * 1000);
    await Promise.resolve();
    await Promise.resolve();

    expect(prismaMock.responsibleSelection.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'WAITING' },
      data: { status: 'TIMEOUT' },
    });
  });

  it('падение отправки не выбрасывается наружу', async () => {
    editMessageText.mockRejectedValue(new Error('telegram down'));

    await expect(
      ResponsibleService.sendVolunteerPrompt(5, selection)
    ).resolves.toBeUndefined();
  });
});

describe('handleVolunteer', () => {
  it('участник группы забирает роль, получает XP и запускает расчёты', async () => {
    const claimed = await ResponsibleService.handleVolunteer(5, 555);

    expect(claimed).toBe(true);
    expect(prismaMock.responsibleSelection.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'WAITING' },
      data: expect.objectContaining({
        status: 'VOLUNTEER_SELECTED',
        selectedUserId: 7,
        volunteerUserId: 7,
      }),
    });
    expect(awardXP).toHaveBeenCalledWith(
      7,
      expect.any(Number),
      expect.any(String),
      expect.any(String),
      { pollId: 5, selectionMode: 'volunteer' },
      'poll-volunteer:5:7'
    );
    expect(pollFlowService.processResponsibleSelected).toHaveBeenCalledWith(5, 7);
  });

  it('гонка: если роль уже занята, второй отклик не проходит', async () => {
    asMock(prismaMock.responsibleSelection.updateMany).mockResolvedValue({
      count: 0,
    });

    const claimed = await ResponsibleService.handleVolunteer(5, 555);

    expect(claimed).toBe(false);
    expect(pollFlowService.processResponsibleSelected).not.toHaveBeenCalled();
  });

  it('процесс уже завершён — отклик игнорируется', async () => {
    asMock(prismaMock.responsibleSelection.findUnique).mockResolvedValue({
      id: 1,
      status: 'VOLUNTEER_SELECTED',
    });

    await expect(ResponsibleService.handleVolunteer(5, 555)).resolves.toBe(
      false
    );
  });

  it('процесса выбора нет — отклик игнорируется', async () => {
    asMock(prismaMock.responsibleSelection.findUnique).mockResolvedValue(
      null
    );

    await expect(ResponsibleService.handleVolunteer(5, 555)).resolves.toBe(
      false
    );
  });

  it('незнакомый пользователь роль не получает', async () => {
    userService.getUserByTelegramId.mockResolvedValue(null);

    await expect(ResponsibleService.handleVolunteer(5, 555)).resolves.toBe(
      false
    );
  });

  it('не участник группы роль не получает', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);

    const claimed = await ResponsibleService.handleVolunteer(5, 555);

    expect(claimed).toBe(false);
    expect(prismaMock.responsibleSelection.updateMany).not.toHaveBeenCalled();
  });

  it('тот, кого не ждут в этом голосовании, роль не получает', async () => {
    asMock(prismaMock.pollParticipant.count).mockResolvedValue(0);

    await expect(ResponsibleService.handleVolunteer(5, 555)).resolves.toBe(
      false
    );
  });

  it('голосования нет — отклик отклоняется', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await expect(ResponsibleService.handleVolunteer(5, 555)).resolves.toBe(
      false
    );
  });

  it('падение начисления XP не отменяет назначение', async () => {
    asMock(awardXP).mockRejectedValue(new Error('xp down'));

    await expect(ResponsibleService.handleVolunteer(5, 555)).resolves.toBe(true);
    expect(pollFlowService.processResponsibleSelected).toHaveBeenCalled();
  });

  it('падение правки сообщения не отменяет назначение', async () => {
    editMessageText.mockRejectedValue(new Error('telegram down'));

    await expect(ResponsibleService.handleVolunteer(5, 555)).resolves.toBe(true);
  });

  it('ошибка базы даёт false, а не исключение', async () => {
    asMock(prismaMock.responsibleSelection.findUnique).mockRejectedValue(
      new Error('db down')
    );

    await expect(ResponsibleService.handleVolunteer(5, 555)).resolves.toBe(
      false
    );
  });
});

describe('handleVolunteerTimeout', () => {
  it('переводит процесс в TIMEOUT и запускает рулетку', async () => {
    await ResponsibleService.handleVolunteerTimeout(5);

    expect(prismaMock.responsibleSelection.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'WAITING' },
      data: { status: 'TIMEOUT' },
    });
    expect(rouletteStub.runRoulette).toHaveBeenCalledWith(5);
  });

  it('если доброволец успел — таймаут ничего не делает', async () => {
    asMock(prismaMock.responsibleSelection.findUnique).mockResolvedValue({
      id: 1,
      status: 'VOLUNTEER_SELECTED',
    });

    await ResponsibleService.handleVolunteerTimeout(5);

    expect(rouletteStub.runRoulette).not.toHaveBeenCalled();
  });

  it('гонка с добровольцем: перевод в TIMEOUT не удался — рулетки нет', async () => {
    asMock(prismaMock.responsibleSelection.updateMany).mockResolvedValue({
      count: 0,
    });

    await ResponsibleService.handleVolunteerTimeout(5);

    expect(rouletteStub.runRoulette).not.toHaveBeenCalled();
  });

  it('процесса нет — тихо выходим', async () => {
    asMock(prismaMock.responsibleSelection.findUnique).mockResolvedValue(
      null
    );

    await expect(
      ResponsibleService.handleVolunteerTimeout(5)
    ).resolves.toBeUndefined();
  });

  it('падение правки сообщения не мешает рулетке', async () => {
    editMessageText.mockRejectedValue(new Error('telegram down'));

    await ResponsibleService.handleVolunteerTimeout(5);

    expect(rouletteStub.runRoulette).toHaveBeenCalled();
  });

  it('ошибка базы не выбрасывается наружу', async () => {
    asMock(prismaMock.responsibleSelection.findUnique).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      ResponsibleService.handleVolunteerTimeout(5)
    ).resolves.toBeUndefined();
  });
});

describe('runRouletteAndProceed', () => {
  it('записывает ответственного, но не перетирает результаты голосования', async () => {
    await ResponsibleService.runRouletteAndProceed(5);

    expect(prismaMock.pollResult.update).toHaveBeenCalledWith({
      where: { pollId: 5 },
      data: { responsibleUserId: 7 },
    });
    // rouletteData содержит итоги голосования и в этом обновлении не участвует.
    const data = (
      prismaMock.pollResult.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      }
    ).data;
    expect(data).not.toHaveProperty('rouletteData');
  });

  it('процесс выбора закрывается со статусом рулетки', async () => {
    await ResponsibleService.runRouletteAndProceed(5);

    expect(prismaMock.responsibleSelection.update).toHaveBeenCalledWith({
      where: { pollId: 5 },
      data: expect.objectContaining({
        status: 'ROULETTE_RUN',
        selectedUserId: 7,
        rouletteWinnerId: 7,
      }),
    });
  });

  it('выбранный получает XP с идемпотентным ключом', async () => {
    await ResponsibleService.runRouletteAndProceed(5);

    expect(awardXP).toHaveBeenCalledWith(
      7,
      expect.any(Number),
      expect.any(String),
      expect.any(String),
      { pollId: 5, selectionMode: 'roulette' },
      'poll-roulette:5:7'
    );
  });

  it('группе сообщают имя выбранного', async () => {
    await ResponsibleService.runRouletteAndProceed(5);

    expect(editMessageText).toHaveBeenCalledWith(
      -1001,
      42,
      expect.stringContaining('Ответственный:* Игорь'),
      { parse_mode: 'Markdown' }
    );
  });

  it('без сообщения выбора правка не нужна', async () => {
    asMock(prismaMock.responsibleSelection.findUnique).mockResolvedValue({
      id: 1,
      messageId: null,
      chatId: null,
    });

    await ResponsibleService.runRouletteAndProceed(5);

    expect(editMessageText).not.toHaveBeenCalled();
    expect(pollFlowService.processResponsibleSelected).toHaveBeenCalled();
  });

  it('падение начисления XP не отменяет расчёты', async () => {
    asMock(awardXP).mockRejectedValue(new Error('xp down'));

    await ResponsibleService.runRouletteAndProceed(5);

    expect(pollFlowService.processResponsibleSelected).toHaveBeenCalledWith(5, 7);
  });

  it('падение рулетки не выбрасывается наружу', async () => {
    rouletteStub.runRoulette.mockRejectedValue(new Error('no voters'));

    await expect(
      ResponsibleService.runRouletteAndProceed(5)
    ).resolves.toBeUndefined();
    expect(pollFlowService.processResponsibleSelected).not.toHaveBeenCalled();
  });
});

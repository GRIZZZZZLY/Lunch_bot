/**
 * Кнопки под сообщением голосования в группе. Права админа группы, завершение,
 * отмену и deep-link на тестовой БД проверяет integration/bot/poll-callbacks.
 * Здесь — то, что через настоящий бот не воспроизвести: авторулетка, анимация
 * рулетки и её запасные пути, сбои сервисов и Telegram.
 */
import {
  handleCompletePoll,
  handleRunRoulette,
  handleCancelPoll,
  handleOpenPollButton,
} from '../../../bot/handlers/poll.handlers';
import { PollService } from '../../../services/poll.service';
import { VoteService } from '../../../services/vote.service';
import { UserService } from '../../../services/user.service';
import { GroupService } from '../../../services/group.service';
import { RouletteService } from '../../../services/roulette.service';
import { asServiceMock } from '../../helpers/mocks';
import type { BotContext } from '../../../types/bot.types';
import type { CallbackQueryContext } from 'grammy';
import { PollQueryService } from '../../../services/poll-query.service';
import { PollCompletionService } from '../../../services/poll-completion.service';

jest.mock('../../../services/poll.service', () => ({
  PollService: {
    cancelPoll: jest.fn(),
    getPollResult: jest.fn(),
    savePollResult: jest.fn(),
  },
}));

jest.mock('../../../services/poll-completion.service', () => ({
  PollCompletionService: {
    completePoll: jest.fn(),
  },
}));


jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: {
    getPollById: jest.fn(),
  },
}));


jest.mock('../../../services/vote.service', () => ({
  VoteService: {
    getPollVotes: jest.fn(),
    getVoteBreakdown: jest.fn(),
    getVoteTypeStats: jest.fn(),
  },
}));

jest.mock('../../../services/user.service', () => ({
  UserService: { getUserByTelegramId: jest.fn() },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupAdmin: jest.fn() },
}));

/* RouletteService создаётся через new. */
let rouletteStub: Record<string, jest.Mock>;
function currentRouletteStub(): Record<string, jest.Mock> {
  return rouletteStub;
}

jest.mock('../../../services/roulette.service', () => ({
  RouletteService: jest.fn(() => currentRouletteStub()),
}));

/* Уведомления берутся из общего синглтона, а не создаются через new: у
   собственного экземпляра не было поднятого бота, и notifyResponsible не
   отправлял ничего. */
jest.mock('../../../services/poll-notification.service', () => ({
  pollNotificationService: { notifyResponsible: jest.fn() },
}));

const { pollNotificationService } = jest.requireMock(
  '../../../services/poll-notification.service'
);
const notificationStub = pollNotificationService as Record<string, jest.Mock>;

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const pollService = asServiceMock(PollService);
const pollCompletion = asServiceMock(PollCompletionService);
const pollQuery = asServiceMock(PollQueryService);
const voteService = asServiceMock(VoteService);
const userService = asServiceMock(UserService);
const groupService = asServiceMock(GroupService);

const NOW = new Date('2026-08-03T12:00:00.000Z');

/**
 * То, что РЕАЛЬНО возвращает `completePoll`: запись `PollResult` со связями
 * (`poll`, `winnerMenuItem`, `responsibleUser`) — она приходит из
 * `PollService.getPollResult`.
 *
 * Раньше здесь стоял плоский `{ id, status, title }`, то есть фикстура
 * соответствовала не сервису, а ошибке в handler'е: тот передавал итог туда,
 * где ожидался опрос. С плоским объектом тесты были зелёными, а в группе
 * сообщение печатало «undefined» вместо названия и теряло победителя с
 * ответственным.
 */
const COMPLETED_RESULT = {
  id: 9,
  pollId: 5,
  totalVotes: 3,
  poll: {
    id: 5,
    groupId: 100,
    status: 'COMPLETED',
    title: 'Обед',
    duration: 30,
    startedAt: new Date('2026-08-03T11:00:00.000Z'),
  },
  winnerMenuItem: { id: 1, name: 'Плов' },
  responsibleUser: { id: 7, firstName: 'Игорь', username: 'igor' },
};

function makeCtx(withCallbackMessage = true) {
  const answerCallbackQuery = jest.fn().mockResolvedValue(undefined);
  const editMessageText = jest.fn().mockResolvedValue(undefined);
  const reply = jest.fn().mockResolvedValue({
    chat: { id: -1001 },
    message_id: 77,
  });
  const apiEditMessageText = jest.fn().mockResolvedValue(undefined);
  const getMe = jest.fn().mockResolvedValue({ username: 'rocket_lunch_bot' });

  return {
    from: { id: 555 },
    callbackQuery: withCallbackMessage
      ? { message: { chat: { id: -1001 }, message_id: 77 } }
      : undefined,
    answerCallbackQuery,
    editMessageText,
    reply,
    api: { editMessageText: apiEditMessageText, getMe },
  } as unknown as CallbackQueryContext<BotContext> & {
    answerCallbackQuery: jest.Mock;
    editMessageText: jest.Mock;
    reply: jest.Mock;
    api: { editMessageText: jest.Mock; getMe: jest.Mock };
  };
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);
  envBackup = { ...process.env };
  process.env.AUTO_ROULETTE_ENABLED = 'false';
  process.env.NOTIFICATION_ENABLED = 'false';

  rouletteStub = {
    runRoulette: jest.fn().mockResolvedValue({
      winnerMenuItemId: 1,
      responsibleUserId: 7,
      responsibleUserName: 'Игорь',
      winnerMenuItemName: 'Плов',
      totalVotes: 3,
      animationData: {
        steps: [
          { delay: 100, message: '🎰 1' },
          { delay: 100, message: '🎰 2' },
        ],
      },
    }),
  };
  notificationStub.notifyResponsible.mockResolvedValue({ success: true });

  pollQuery.getPollById.mockResolvedValue({
    id: 5,
    groupId: 100,
    status: 'COMPLETED',
    title: 'Обед',
  });
  pollCompletion.completePoll.mockResolvedValue(COMPLETED_RESULT);
  pollService.cancelPoll.mockResolvedValue({ id: 5 });
  pollService.getPollResult.mockResolvedValue(null);
  pollService.savePollResult.mockResolvedValue({ id: 1 });

  userService.getUserByTelegramId.mockResolvedValue({ id: 1 });
  groupService.isUserGroupAdmin.mockResolvedValue(true);

  voteService.getPollVotes.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
  voteService.getVoteBreakdown.mockResolvedValue([
    { menuItemName: 'Плов', votes: 3, percentage: 100, voters: [] },
  ]);
  voteService.getVoteTypeStats.mockResolvedValue({
    menuItemVotes: 3,
    bringOwnVotes: 0,
    skipVotes: 0,
    total: 3,
  });
});

afterEach(() => {
  jest.useRealTimers();
  process.env = envBackup;
});

type Ctx = ReturnType<typeof makeCtx>;

/** Анимация рулетки идёт на таймерах: прогоняем её до конца. */
async function runRoulette(ctx: Ctx): Promise<void> {
  const promise = handleRunRoulette(ctx, 5);
  await jest.advanceTimersByTimeAsync(3000);
  await promise;
}

describe('handleCompletePoll: авторулетка', () => {
  it('с включённой авторулеткой она запускается после завершения', async () => {
    process.env.AUTO_ROULETTE_ENABLED = 'true';

    await handleCompletePoll(makeCtx(), 5);
    await jest.advanceTimersByTimeAsync(3000);

    expect(rouletteStub.runRoulette).toHaveBeenCalledWith(5);
  });

  it('без голосов авторулетка не запускается', async () => {
    process.env.AUTO_ROULETTE_ENABLED = 'true';
    voteService.getPollVotes.mockResolvedValue([]);

    await handleCompletePoll(makeCtx(), 5);
    await jest.advanceTimersByTimeAsync(3000);

    expect(rouletteStub.runRoulette).not.toHaveBeenCalled();
  });
});

describe('handleRunRoulette', () => {
  /**
   * Имена участников попадают и в шаги анимации (их собирает
   * `roulette.service`), и в финальное сообщение. Шаблон шага разметки не
   * содержит — только эмодзи и текст, — поэтому строка шага экранируется
   * целиком уже на отправке: сама `animationData` уезжает в БД, и
   * экранированный текст в хранилище был бы порчей данных под один транспорт.
   */
  it('спецсимволы в именах и блюде экранируются в анимации и в финале', async () => {
    rouletteStub.runRoulette.mockResolvedValue({
      winnerMenuItemId: 1,
      responsibleUserId: 7,
      responsibleUserName: 'Аня_К',
      winnerMenuItemName: 'Соус_острый *акция*',
      totalVotes: 3,
      animationData: { steps: [{ delay: 100, message: '🎯 Игорь_П...' }] },
    });
    const ctx = makeCtx();

    await runRoulette(ctx);

    const texts: string[] = ctx.api.editMessageText.mock.calls.map(call => call[2]);
    expect(texts.some(text => text.includes('Игорь\\_П'))).toBe(true);
    const final = texts[texts.length - 1];
    expect(final).toContain('Аня\\_К');
    expect(final).toContain('Соус\\_острый \\*акция\\*');
  });

  it.each<[string, () => void]>([
    ['без голосов рулетка не крутится', () => voteService.getPollVotes.mockResolvedValue([])],
    [
      'повторный запуск отклоняется',
      () => pollService.getPollResult.mockResolvedValue({ responsibleUserId: 7 }),
    ],
  ])('%s', async (_name, arrange) => {
    arrange();
    const ctx = makeCtx();

    await handleRunRoulette(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    expect(rouletteStub.runRoulette).not.toHaveBeenCalled();
    expect(pollService.savePollResult).not.toHaveBeenCalled();
  });

  /* Уведомления берутся из общего синглтона: у собственного экземпляра не
     было бота, и notifyResponsible не отправлял ничего. */
  it('с включёнными уведомлениями ответственному пишут', async () => {
    process.env.NOTIFICATION_ENABLED = 'true';

    await runRoulette(makeCtx());

    expect(notificationStub.notifyResponsible).toHaveBeenCalledWith(5, 7);
  });

  it('без сообщения в callback анимация отправляется новым сообщением', async () => {
    const ctx = makeCtx(false);

    await runRoulette(ctx);

    expect(ctx.reply).toHaveBeenCalled();
  });

  it('невозможность править сообщение приводит к новому', async () => {
    const ctx = makeCtx();
    ctx.api.editMessageText.mockRejectedValueOnce(new Error('too old'));

    await runRoulette(ctx);

    expect(ctx.reply).toHaveBeenCalled();
  });
});

/* Ветка отказа или ошибки: нажатие отвечено (иначе у кнопки вечный спиннер),
   действие не выполнено, ссылки на голосование нет. */
describe('отказ или ошибка — нажатие отвечено, действие не выполнено', () => {
  const activePoll = () =>
    pollQuery.getPollById.mockResolvedValue({ id: 5, groupId: 100, status: 'ACTIVE' });

  it.each<[string, (ctx: Ctx) => void, (ctx: Ctx) => Promise<void>, () => jest.Mock[]]>([
    [
      'завершение: голосования нет',
      () => pollQuery.getPollById.mockResolvedValue(null),
      ctx => handleCompletePoll(ctx, 5),
      () => [pollCompletion.completePoll],
    ],
    [
      'завершение: ошибка сервиса',
      () => pollCompletion.completePoll.mockRejectedValue(new Error('db down')),
      ctx => handleCompletePoll(ctx, 5),
      () => [],
    ],
    [
      'рулетка: падение розыгрыша',
      () => rouletteStub.runRoulette.mockRejectedValue(new Error('no voters')),
      ctx => handleRunRoulette(ctx, 5),
      () => [pollService.savePollResult],
    ],
    [
      'отмена: ошибка сервиса',
      () => pollService.cancelPoll.mockRejectedValue(new Error('db down')),
      ctx => handleCancelPoll(ctx, 5),
      () => [],
    ],
    [
      'открытие: голосования нет',
      () => pollQuery.getPollById.mockResolvedValue(null),
      ctx => handleOpenPollButton(ctx, 5),
      () => [],
    ],
    [
      'открытие: без пользователя',
      ctx => {
        activePoll();
        (ctx as unknown as { from: undefined }).from = undefined;
      },
      ctx => handleOpenPollButton(ctx, 5),
      () => [],
    ],
    [
      'открытие: падение Telegram API',
      ctx => {
        activePoll();
        ctx.api.getMe.mockRejectedValue(new Error('api down'));
      },
      ctx => handleOpenPollButton(ctx, 5),
      () => [],
    ],
  ])('%s', async (_name, arrange, act, untouched) => {
    const ctx = makeCtx();
    arrange(ctx);

    await act(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    expect(JSON.stringify(ctx.answerCallbackQuery.mock.calls)).not.toContain('"url"');
    for (const mock of untouched()) {
      expect(mock).not.toHaveBeenCalled();
    }
  });
});

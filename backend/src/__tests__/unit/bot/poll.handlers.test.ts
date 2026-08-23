/**
 * Кнопки под сообщением голосования в группе. Их видят все участники, поэтому
 * каждое действие сначала проверяет права АДМИНА ЭТОЙ ГРУППЫ: без этого любой
 * участник мог бы завершить или отменить общий обед.
 *
 * Отдельно: рулетка не должна запускаться дважды и не должна крутиться, пока
 * голосование ещё активно.
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
import { NotificationService } from '../../../services/notification.service';
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

/* RouletteService и NotificationService создаются через new. */
let rouletteStub: Record<string, jest.Mock>;
let notificationStub: Record<string, jest.Mock>;
function currentRouletteStub(): Record<string, jest.Mock> {
  return rouletteStub;
}
function currentNotificationStub(): Record<string, jest.Mock> {
  return notificationStub;
}

jest.mock('../../../services/roulette.service', () => ({
  RouletteService: jest.fn(() => currentRouletteStub()),
}));

jest.mock('../../../services/notification.service', () => ({
  NotificationService: jest.fn(() => currentNotificationStub()),
}));

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
  notificationStub = {
    notifyResponsible: jest.fn().mockResolvedValue({ success: true }),
  };

  pollQuery.getPollById.mockResolvedValue({
    id: 5,
    groupId: 100,
    status: 'COMPLETED',
    title: 'Обед',
  });
  pollCompletion.completePoll.mockResolvedValue({
    id: 5,
    status: 'COMPLETED',
    title: 'Обед',
  });
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

describe('handleCompletePoll', () => {
  it('админ группы завершает голосование и видит результаты', async () => {
    const ctx = makeCtx();

    await handleCompletePoll(ctx, 5);

    expect(pollCompletion.completePoll).toHaveBeenCalledWith(5);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      '✅ Голосование завершено'
    );
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('Результаты голосования'),
      { parse_mode: 'Markdown' }
    );
  });

  it('не админ группы завершить не может', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const ctx = makeCtx();

    await handleCompletePoll(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('Только администратор этой группы')
    );
    expect(pollCompletion.completePoll).not.toHaveBeenCalled();
  });

  it('незнакомый пользователь завершить не может', async () => {
    userService.getUserByTelegramId.mockResolvedValue(null);
    const ctx = makeCtx();

    await handleCompletePoll(ctx, 5);

    expect(pollCompletion.completePoll).not.toHaveBeenCalled();
  });

  it('голосования нет — отказ', async () => {
    pollQuery.getPollById.mockResolvedValue(null);
    const ctx = makeCtx();

    await handleCompletePoll(ctx, 5);

    expect(pollCompletion.completePoll).not.toHaveBeenCalled();
  });

  it('с включённой авторулеткой она запускается после завершения', async () => {
    process.env.AUTO_ROULETTE_ENABLED = 'true';
    const ctx = makeCtx();

    await handleCompletePoll(ctx, 5);
    await jest.advanceTimersByTimeAsync(3000);

    expect(rouletteStub.runRoulette).toHaveBeenCalledWith(5);
  });

  it('без голосов авторулетка не запускается', async () => {
    process.env.AUTO_ROULETTE_ENABLED = 'true';
    voteService.getPollVotes.mockResolvedValue([]);
    const ctx = makeCtx();

    await handleCompletePoll(ctx, 5);
    await jest.advanceTimersByTimeAsync(3000);

    expect(rouletteStub.runRoulette).not.toHaveBeenCalled();
  });

  it('ошибка завершения отвечает на нажатие', async () => {
    pollCompletion.completePoll.mockRejectedValue(new Error('db down'));
    const ctx = makeCtx();

    await handleCompletePoll(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('Ошибка при завершении')
    );
  });
});

describe('handleRunRoulette', () => {
  it('крутит рулетку и сохраняет результат', async () => {
    const ctx = makeCtx();

    const promise = handleRunRoulette(ctx, 5);
    await jest.advanceTimersByTimeAsync(3000);
    await promise;

    expect(pollService.savePollResult).toHaveBeenCalledWith({
      pollId: 5,
      winnerMenuItemId: 1,
      responsibleUserId: 7,
      totalVotes: 3,
      rouletteData: expect.any(String),
    });
  });

  it('анимация правит одно и то же сообщение', async () => {
    const ctx = makeCtx();

    const promise = handleRunRoulette(ctx, 5);
    await jest.advanceTimersByTimeAsync(3000);
    await promise;

    // Начальный текст + два шага + финал.
    expect(ctx.api.editMessageText).toHaveBeenCalledTimes(4);
    expect(ctx.api.editMessageText).toHaveBeenLastCalledWith(
      -1001,
      77,
      expect.stringContaining('Игорь оформляет заказ'),
      { parse_mode: 'Markdown' }
    );
  });

  it('активное голосование сначала надо завершить', async () => {
    pollQuery.getPollById.mockResolvedValue({
      id: 5,
      groupId: 100,
      status: 'ACTIVE',
    });
    const ctx = makeCtx();

    await handleRunRoulette(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('Сначала завершите голосование')
    );
    expect(rouletteStub.runRoulette).not.toHaveBeenCalled();
  });

  it('без голосов рулетка не крутится', async () => {
    voteService.getPollVotes.mockResolvedValue([]);
    const ctx = makeCtx();

    await handleRunRoulette(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('Никто не проголосовал')
    );
  });

  it('повторный запуск отклоняется', async () => {
    pollService.getPollResult.mockResolvedValue({ responsibleUserId: 7 });
    const ctx = makeCtx();

    await handleRunRoulette(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('Рулетка уже была запущена')
    );
    expect(rouletteStub.runRoulette).not.toHaveBeenCalled();
  });

  it('не админ группы рулетку не запускает', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const ctx = makeCtx();

    await handleRunRoulette(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('нет прав администратора')
    );
  });

  it('с включёнными уведомлениями ответственному пишут', async () => {
    process.env.NOTIFICATION_ENABLED = 'true';
    const ctx = makeCtx();

    const promise = handleRunRoulette(ctx, 5);
    await jest.advanceTimersByTimeAsync(3000);
    await promise;

    expect(notificationStub.notifyResponsible).toHaveBeenCalledWith(5, 7);
  });

  it('без сообщения в callback анимация отправляется новым сообщением', async () => {
    const ctx = makeCtx(false);

    const promise = handleRunRoulette(ctx, 5);
    await jest.advanceTimersByTimeAsync(3000);
    await promise;

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Крутим рулетку'),
      { parse_mode: 'Markdown' }
    );
  });

  it('невозможность править сообщение приводит к новому', async () => {
    const ctx = makeCtx();
    ctx.api.editMessageText.mockRejectedValueOnce(new Error('too old'));

    const promise = handleRunRoulette(ctx, 5);
    await jest.advanceTimersByTimeAsync(3000);
    await promise;

    expect(ctx.reply).toHaveBeenCalled();
  });

  it('падение рулетки отвечает на нажатие', async () => {
    rouletteStub.runRoulette.mockRejectedValue(new Error('no voters'));
    const ctx = makeCtx();

    await handleRunRoulette(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('Ошибка при запуске рулетки')
    );
  });
});

describe('handleCancelPoll', () => {
  it('админ группы отменяет голосование', async () => {
    const ctx = makeCtx();

    await handleCancelPoll(ctx, 5);

    expect(pollService.cancelPoll).toHaveBeenCalledWith(
      5,
      1,
      'Отменено администратором'
    );
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('Голосование отменено админом'),
      { parse_mode: 'Markdown' }
    );
  });

  it('не админ группы отменить не может', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const ctx = makeCtx();

    await handleCancelPoll(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('Только администратор этой группы')
    );
    expect(pollService.cancelPoll).not.toHaveBeenCalled();
  });

  it('ошибка отмены отвечает на нажатие', async () => {
    pollService.cancelPoll.mockRejectedValue(new Error('db down'));
    const ctx = makeCtx();

    await handleCancelPoll(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('Ошибка при отмене')
    );
  });
});

describe('handleOpenPollButton', () => {
  beforeEach(() => {
    pollQuery.getPollById.mockResolvedValue({
      id: 5,
      groupId: 100,
      status: 'ACTIVE',
    });
  });

  it('отдаёт deep-link на личный чат с ботом', async () => {
    const ctx = makeCtx();

    await handleOpenPollButton(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
      text: '📱 Открываю голосование...',
      url: 'https://t.me/rocket_lunch_bot?start=vote_5',
    });
  });

  it('голосования нет — отказ', async () => {
    pollQuery.getPollById.mockResolvedValue(null);
    const ctx = makeCtx();

    await handleOpenPollButton(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      '❌ Голосование не найдено'
    );
  });

  it('завершённое голосование не открывается', async () => {
    pollQuery.getPollById.mockResolvedValue({
      id: 5,
      groupId: 100,
      status: 'COMPLETED',
    });
    const ctx = makeCtx();

    await handleOpenPollButton(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      '⚠️ Голосование уже завершено'
    );
  });

  it('без пользователя просит перезапуск', async () => {
    const ctx = makeCtx();
    (ctx as unknown as { from: undefined }).from = undefined;

    await handleOpenPollButton(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('/start')
    );
  });

  it('падение Telegram API отвечает на нажатие', async () => {
    const ctx = makeCtx();
    ctx.api.getMe.mockRejectedValue(new Error('api down'));

    await handleOpenPollButton(ctx, 5);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('Ошибка при открытии')
    );
  });
});

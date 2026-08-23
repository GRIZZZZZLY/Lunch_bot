/**
 * Доменные сбои голосования как ТИПЫ, а не как строки сообщений.
 *
 * Зачем это отдельный файл. Статус ответа сейчас выбирает контроллер, сравнивая
 * `error.message` со списком литералов: «Poll not found» → 404, «Only an active
 * poll can be cancelled» → 409 и так далее. Это работает, пока обе стороны
 * повторяют одну и ту же строку, и молча ломается, когда сервис её меняет:
 * `catch` перестаёт совпадать, и осмысленный 409 превращается в 500.
 *
 * Задача 03 называет типизацию сервисных ошибок предпосылкой для перевода
 * `catch` на `next(err)` и оставляет её задачам 05–08. Здесь она делается для
 * голосований: сервис бросает класс, несущий свой `statusCode` и `code`, а
 * `error-handler` отдаёт их клиенту. Сообщения СОХРАНЕНЫ дословно — на них
 * опираются и существующие тесты сервисов, и обработчики бота, которые
 * сравнивают `error.message`.
 *
 * Проверяется именно пара (статус, код): без неё тест «бросает ошибку» пройдёт
 * и на обычном `Error`, то есть окажется вакуумным.
 */
import { PollService } from '../../../services/poll.service';
import {
  NoVotersError,
  PollAlreadyCompletedError,
  PollNotFoundError,
  PollStateError,
} from '../../../services/poll.errors';
import { VoteService } from '../../../services/vote.service';
import {
  VoteNotFoundError,
  VotingError,
} from '../../../services/vote.errors';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';
import { PollCompletionService } from '../../../services/poll-completion.service';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/cache.service', () => ({
  cacheService: { get: jest.fn(), set: jest.fn(), del: jest.fn(), getOrSet: jest.fn() },
  CacheInvalidator: { invalidatePoll: jest.fn(), invalidateVote: jest.fn() },
  CACHE_KEYS: { ACTIVE_POLLS: 'active_polls' },
  CACHE_TTL: { ACTIVE_POLLS: 30 },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { getGroupSettings: jest.fn() },
}));

jest.mock('../../../services/poll-notification.service', () => ({
  pollNotificationService: {
    sendPollCompletionNotifications: jest.fn(),
    sendPollCancelledNotifications: jest.fn(),
  },
}));

jest.mock('../../../services/event-bus.service', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}));

jest.mock('../../../services/gamification.service', () => ({
  GamificationService: { awardXP: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/** Ошибка с HTTP-смыслом: класс, статус и код проверяются вместе. */
async function rejectsWith(
  call: Promise<unknown>,
  expected: { type: new (...args: never[]) => Error; status: number; code: string; message: string }
): Promise<void> {
  await expect(call).rejects.toBeInstanceOf(expected.type);
  await call.catch((error: unknown) => {
    const typed = error as { statusCode: number; code: string; message: string };
    expect(typed.statusCode).toBe(expected.status);
    expect(typed.code).toBe(expected.code);
    expect(typed.message).toBe(expected.message);
  });
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
});

describe('PollCompletionService.completePoll', () => {
  it('голосования нет — 404 POLL_NOT_FOUND', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await rejectsWith(PollCompletionService.completePoll(5), {
      type: PollNotFoundError,
      status: 404,
      code: 'POLL_NOT_FOUND',
      message: 'Poll not found',
    });
  });

  it('уже завершённое — 400 POLL_ALREADY_COMPLETED', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({
      id: 5,
      groupId: 100,
      status: 'COMPLETED',
      votes: [],
    });

    await rejectsWith(PollCompletionService.completePoll(5), {
      type: PollAlreadyCompletedError,
      status: 400,
      code: 'POLL_ALREADY_COMPLETED',
      message: 'Poll is already completed',
    });
  });

  /* Отменённое голосование раньше давало клиенту 500 INTERNAL_ERROR: контроллер
     сверялся ровно со строкой «Poll is already completed», а приходило
     «Poll is already cancelled». Конфликт состояния — это 409, и теперь его
     выбирает сам класс ошибки, а не совпадение строк. */
  it('отменённое — 409 INVALID_POLL_STATE, а не 500', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({
      id: 5,
      groupId: 100,
      status: 'CANCELLED',
      votes: [],
    });

    await rejectsWith(PollCompletionService.completePoll(5), {
      type: PollStateError,
      status: 409,
      code: 'INVALID_POLL_STATE',
      message: 'Poll is already cancelled',
    });
  });
});

describe('PollService.cancelPoll', () => {
  it('голосования нет — 404 POLL_NOT_FOUND', async () => {
    asMock(prismaMock.poll.updateMany).mockResolvedValue({ count: 0 });
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await rejectsWith(PollService.cancelPoll(5, 1), {
      type: PollNotFoundError,
      status: 404,
      code: 'POLL_NOT_FOUND',
      message: 'Poll not found',
    });
  });

  it('завершённое отменить нельзя — 409 INVALID_POLL_STATE', async () => {
    asMock(prismaMock.poll.updateMany).mockResolvedValue({ count: 0 });
    asMock(prismaMock.poll.findUnique).mockResolvedValue({
      id: 5,
      groupId: 100,
      status: 'COMPLETED',
    });

    await rejectsWith(PollService.cancelPoll(5, 1), {
      type: PollStateError,
      status: 409,
      code: 'INVALID_POLL_STATE',
      message: 'Only an active poll can be cancelled',
    });
  });

  /* Повторная отмена — не ошибка: голосование уже в нужном состоянии. */
  it('уже отменённое отдаётся как есть', async () => {
    asMock(prismaMock.poll.updateMany).mockResolvedValue({ count: 0 });
    asMock(prismaMock.poll.findUnique).mockResolvedValue({
      id: 5,
      groupId: 100,
      status: 'CANCELLED',
    });

    await expect(PollService.cancelPoll(5, 1)).resolves.toMatchObject({ id: 5 });
  });
});

describe('PollService.runRoulette', () => {
  it('голосования нет — 404 POLL_NOT_FOUND', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await rejectsWith(PollService.runRoulette(5), {
      type: PollNotFoundError,
      status: 404,
      code: 'POLL_NOT_FOUND',
      message: 'Poll not found',
    });
  });

  it('никто не голосовал — 400 NO_VOTERS', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({
      id: 5,
      groupId: 100,
      status: 'COMPLETED',
      votes: [],
    });

    await rejectsWith(PollService.runRoulette(5), {
      type: NoVotersError,
      status: 400,
      code: 'NO_VOTERS',
      message: 'No voters found',
    });
  });
});

describe('PollCompletionService.completePollMultiWinner', () => {
  it('голосования нет — 404 POLL_NOT_FOUND', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await rejectsWith(PollCompletionService.completePollMultiWinner(5, 1), {
      type: PollNotFoundError,
      status: 404,
      code: 'POLL_NOT_FOUND',
      message: 'Poll not found',
    });
  });
});

describe('VoteService', () => {
  /** Голосование, до которого доходит проверка права голоса. */
  function poll(over: Record<string, unknown> = {}): void {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({
      id: 1,
      status: 'ACTIVE',
      endedAt: null,
      groupId: 100,
      selectedMenuItemIds: null,
      ...over,
    });
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue({ isActive: true });
    asMock(prismaMock.pollParticipant.findUnique).mockResolvedValue({
      status: 'EXPECTED',
    });
  }

  it('голос в несуществующем голосовании — 400 POLL_ERROR', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await rejectsWith(
      VoteService.upsertVote({ pollId: 1, userId: 5, menuItemId: 7 }),
      {
        type: VotingError,
        status: 400,
        code: 'POLL_ERROR',
        message: 'Poll not found',
      }
    );
  });

  it('голос в закрытом голосовании — 400 POLL_ERROR', async () => {
    poll({ status: 'COMPLETED' });

    await rejectsWith(
      VoteService.upsertVote({ pollId: 1, userId: 5, menuItemId: 7 }),
      {
        type: VotingError,
        status: 400,
        code: 'POLL_ERROR',
        message: 'Poll is not active',
      }
    );
  });

  it('блюдо не из этого голосования — 400 POLL_ERROR', async () => {
    poll({ selectedMenuItemIds: '[1,2]' });

    await rejectsWith(
      VoteService.upsertVote({ pollId: 1, userId: 5, menuItemId: 7 }),
      {
        type: VotingError,
        status: 400,
        code: 'POLL_ERROR',
        message: 'Menu item is not available for this poll',
      }
    );
  });

  /**
   * Ветка 400 у снятия голоса была НЕДОСТИЖИМА в проде: свой же `catch`
   * подменял «Poll is not active» на «Failed to remove vote», и клиент получал
   * 500. Тест контроллера этого не видел, потому что сам подсовывал сервису
   * нужное сообщение. Типизация делает ветку живой.
   */
  it('снятие голоса в закрытом голосовании — 400 POLL_ERROR, а не 500', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({
      id: 1,
      status: 'COMPLETED',
    });

    await rejectsWith(VoteService.removeVote(1, 5), {
      type: VotingError,
      status: 400,
      code: 'POLL_ERROR',
      message: 'Poll is not active',
    });
  });

  it('снятие голоса в несуществующем голосовании — 400 POLL_ERROR', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await rejectsWith(VoteService.removeVote(1, 5), {
      type: VotingError,
      status: 400,
      code: 'POLL_ERROR',
      message: 'Poll not found',
    });
  });

  it('несколько голосов без списка блюд — 400 POLL_ERROR', async () => {
    poll();

    await rejectsWith(VoteService.createMultipleVotes(1, 5, []), {
      type: VotingError,
      status: 400,
      code: 'POLL_ERROR',
      message: 'Invalid parameters for multiple votes',
    });
  });

  /* Класс для «голоса не было» существует отдельно: у него 404 и свой код,
     который фронт отличает от отказа по состоянию голосования. */
  it('VoteNotFoundError несёт 404 VOTE_NOT_FOUND', () => {
    const error = new VoteNotFoundError();

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('VOTE_NOT_FOUND');
    expect(error.message).toBe('Vote not found');
  });
});

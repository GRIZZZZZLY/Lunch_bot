/**
 * Команды бота. /start — единственная точка входа для всех deep-link'ов
 * (меню группы, добавление блюда, голосование, магазинный забег), поэтому
 * каждая ветка проверяется отдельно: перепутанный префикс открывает не тот
 * экран, а неверный groupId — чужую группу.
 *
 * Отдельно закреплено ограничение Telegram: в группах web_app-кнопки не
 * работают, поэтому там их быть не должно.
 */
import { startCommand } from '../../../bot/commands/start';
import { appCommand } from '../../../bot/commands/app';
import { helpCommand } from '../../../bot/commands/help';
import { UserService } from '../../../services/user.service';
import { PollService } from '../../../services/poll.service';
import { VoteService } from '../../../services/vote.service';
import { asServiceMock } from '../../helpers/mocks';
import type { BotContext } from '../../../types/bot.types';
import { PollQueryService } from '../../../services/poll-query.service';

jest.mock('../../../services/user.service', () => ({
  UserService: { upsertUser: jest.fn(), getUserByTelegramId: jest.fn() },
}));

jest.mock('../../../services/poll.service', () => ({
  PollService: { getPollById: jest.fn() },
}));

jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: {
    getPollById: jest.fn(),
  },
}));


jest.mock('../../../services/vote.service', () => ({
  VoteService: { getUserVotes: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const userService = asServiceMock(UserService);
const pollService = asServiceMock(PollService);
const pollQuery = asServiceMock(PollQueryService);
const voteService = asServiceMock(VoteService);

const NOW = new Date('2026-08-03T12:00:00.000Z');

interface CtxInit {
  from?: { id: number; first_name?: string; username?: string; last_name?: string };
  chat?: { id: number; type: string };
  match?: string;
}

function makeCtx(init: CtxInit = {}) {
  const reply = jest.fn().mockResolvedValue(undefined);
  return {
    from:
      'from' in init
        ? init.from
        : { id: 555, first_name: 'Игорь', username: 'igor' },
    chat: 'chat' in init ? init.chat : { id: 555, type: 'private' },
    match: init.match,
    reply,
  } as unknown as BotContext & { reply: jest.Mock };
}

/** Последние переданные в reply опции. */
function lastOptions(ctx: { reply: jest.Mock }): Record<string, unknown> {
  const call = ctx.reply.mock.calls[ctx.reply.mock.calls.length - 1];
  return (call?.[1] ?? {}) as Record<string, unknown>;
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);
  envBackup = { ...process.env };
  process.env.WEBAPP_URL = 'https://app.example.com';

  userService.upsertUser.mockResolvedValue({
    id: 1,
    isAdmin: false,
    createdAt: new Date(NOW.getTime() - 60_000),
  });
  userService.getUserByTelegramId.mockResolvedValue({ id: 1, isAdmin: false });
  pollQuery.getPollById.mockResolvedValue({ id: 5, status: 'ACTIVE' });
  voteService.getUserVotes.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
  process.env = envBackup;
});

describe('/start — регистрация', () => {
  it('нового пользователя приветствует подробно', async () => {
    userService.upsertUser.mockResolvedValue({
      id: 1,
      isAdmin: false,
      createdAt: NOW,
    });
    const ctx = makeCtx();

    await startCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).toContain('Привет, Игорь!');
    expect(ctx.reply.mock.calls[0][0]).toContain('Добавь меня в группу');
  });

  it('вернувшегося — коротко', async () => {
    const ctx = makeCtx();

    await startCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).toContain('С возвращением, Игорь!');
  });

  it('в личке даёт кнопку Mini App', async () => {
    const ctx = makeCtx();

    await startCommand(ctx);

    expect(lastOptions(ctx)).toMatchObject({
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Открыть Mini App', web_app: { url: 'https://app.example.com' } }],
        ],
      },
    });
  });

  it('в группе web_app-кнопки нет — ограничение Telegram', async () => {
    const ctx = makeCtx({ chat: { id: -1001, type: 'supergroup' } });

    await startCommand(ctx);

    expect(lastOptions(ctx).reply_markup).toBeUndefined();
  });

  it('локальный адрес не годится для web_app-кнопки', async () => {
    process.env.WEBAPP_URL = 'http://localhost:5173';
    const ctx = makeCtx();

    await startCommand(ctx);

    expect(lastOptions(ctx).reply_markup).toBeUndefined();
  });

  it('без пользователя просит перезапустить', async () => {
    const ctx = makeCtx({ from: undefined });

    await startCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/start'));
    expect(userService.upsertUser).not.toHaveBeenCalled();
  });

  it('падение записи пользователя не оставляет человека без ответа', async () => {
    userService.upsertUser.mockRejectedValue(new Error('db down'));
    const ctx = makeCtx();

    await startCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('ошибка при регистрации')
    );
  });
});

describe('/start — deep links', () => {
  it('menu_<groupId> открывает меню этой группы', async () => {
    const ctx = makeCtx({ match: 'menu_-1001' });

    await startCommand(ctx);

    expect(lastOptions(ctx)).toMatchObject({
      reply_markup: {
        inline_keyboard: [
          [
            expect.objectContaining({
              web_app: { url: 'https://app.example.com?groupId=-1001' },
            }),
          ],
        ],
      },
    });
  });

  it('add_<groupId> открывает добавление блюда', async () => {
    const ctx = makeCtx({ match: 'add_-1001' });

    await startCommand(ctx);

    expect(JSON.stringify(lastOptions(ctx))).toContain(
      'groupId=-1001&action=add'
    );
  });

  it('vote_<pollId> открывает голосование', async () => {
    const ctx = makeCtx({ match: 'vote_5' });

    await startCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      '🗳️ Голосование',
      expect.objectContaining({
        reply_markup: {
          inline_keyboard: [
            [
              expect.objectContaining({
                web_app: { url: 'https://app.example.com?pollId=5' },
              }),
            ],
          ],
        },
      })
    );
  });

  it('нечисловой pollId — понятный отказ', async () => {
    const ctx = makeCtx({ match: 'vote_abc' });

    await startCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Неверная ссылка на голосование'),
      expect.any(Object)
    );
  });

  it('голосования нет — так и говорим', async () => {
    pollQuery.getPollById.mockResolvedValue(null);
    const ctx = makeCtx({ match: 'vote_5' });

    await startCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Голосование не найдено'),
      expect.any(Object)
    );
  });

  it('завершённое голосование не открывается', async () => {
    pollQuery.getPollById.mockResolvedValue({ id: 5, status: 'COMPLETED' });
    const ctx = makeCtx({ match: 'vote_5' });

    await startCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Голосование завершено'),
      expect.any(Object)
    );
  });

  it('уже проголосовавшему сообщают, что голос учтён', async () => {
    voteService.getUserVotes.mockResolvedValue([{ id: 1 }]);
    const ctx = makeCtx({ match: 'vote_5' });

    await startCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Ты уже проголосовал'),
      expect.any(Object)
    );
  });

  it('storerun_<id> открывает заполнение заказа', async () => {
    const ctx = makeCtx({ match: 'storerun_9' });

    await startCommand(ctx);

    expect(JSON.stringify(lastOptions(ctx))).toContain('storeRunId=9');
  });

  it('нечисловой id забега — отказ', async () => {
    const ctx = makeCtx({ match: 'storerun_abc' });

    await startCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Неверная ссылка на забег'),
      expect.any(Object)
    );
  });

  it('poll_<groupId> открывает создание голосования', async () => {
    const ctx = makeCtx({ match: 'poll_-1001' });

    await startCommand(ctx);

    expect(JSON.stringify(lastOptions(ctx))).toContain(
      'groupId=-1001&action=poll'
    );
  });

  it('без пригодного адреса Mini App предлагает команду в группе', async () => {
    process.env.WEBAPP_URL = 'http://localhost:5173';
    const ctx = makeCtx({ match: 'poll_-1001' });

    await startCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('/startpoll'),
      expect.any(Object)
    );
  });

  it('неизвестный префикс ведёт к обычному приветствию', async () => {
    const ctx = makeCtx({ match: 'somethingelse' });

    await startCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).toContain('С возвращением');
  });
});

describe('/app', () => {
  it('в личке даёт кнопку Mini App и подсказки', async () => {
    const ctx = makeCtx();

    await appCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).toContain('Личный режим');
    expect(JSON.stringify(lastOptions(ctx))).toContain('web_app');
  });

  it('админу перечисляют права на изменение меню', async () => {
    userService.getUserByTelegramId.mockResolvedValue({ id: 1, isAdmin: true });
    const ctx = makeCtx();

    await appCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).toContain('права администратора');
  });

  it('в группе кнопок web_app нет, зато объяснено почему', async () => {
    const ctx = makeCtx({ chat: { id: -1001, type: 'supergroup' } });

    await appCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).toContain('Групповой режим');
    expect(JSON.stringify(lastOptions(ctx))).not.toContain('web_app');
  });

  it('админ в группе видит расширенный список функций', async () => {
    userService.getUserByTelegramId.mockResolvedValue({ id: 1, isAdmin: true });
    const ctx = makeCtx({ chat: { id: -1001, type: 'supergroup' } });

    await appCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).toContain('Создание голосований');
  });

  it('незарегистрированному предлагают /start', async () => {
    userService.getUserByTelegramId.mockResolvedValue(null);
    const ctx = makeCtx();

    await appCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Отправь /start'),
      expect.any(Object)
    );
  });

  it('без пользователя просит перезапуск', async () => {
    const ctx = makeCtx({ from: undefined });

    await appCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/start'));
  });

  it('ошибка базы не оставляет без ответа', async () => {
    userService.getUserByTelegramId.mockRejectedValue(new Error('db down'));
    const ctx = makeCtx();

    await appCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Произошла ошибка')
    );
  });

  it('отсутствующий WEBAPP_URL логируется как предупреждение', async () => {
    const { logger } = jest.requireMock('../../../utils/logger');
    delete process.env.WEBAPP_URL;
    const ctx = makeCtx();

    await appCommand(ctx);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('WEBAPP_URL is not set')
    );
  });
});

describe('/help', () => {
  it('в личке к тексту прилагается кнопка Mini App', async () => {
    const ctx = makeCtx();

    await helpCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).toContain('Rocket Lunch');
    expect(JSON.stringify(lastOptions(ctx))).toContain('web_app');
  });

  it('в группе только текст', async () => {
    const ctx = makeCtx({ chat: { id: -1001, type: 'supergroup' } });

    await helpCommand(ctx);

    expect(lastOptions(ctx)).toEqual({ parse_mode: 'Markdown' });
  });
});

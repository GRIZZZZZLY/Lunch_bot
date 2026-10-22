/**
 * Команды бота. Deep-link'и /start, кнопки web_app в личке и в группе и
 * регистрацию пользователя на тестовой БД проверяет integration/bot/commands.
 * Здесь — то, что через настоящий бот не воспроизвести: сбой базы и
 * экранирование имени из Telegram.
 */
import { startCommand } from '../../../bot/commands/start';
import { appCommand } from '../../../bot/commands/app';
import { UserService } from '../../../services/user.service';
import { asServiceMock } from '../../helpers/mocks';
import type { BotContext } from '../../../types/bot.types';

jest.mock('../../../services/user.service', () => ({
  UserService: { upsertUser: jest.fn(), getUserByTelegramId: jest.fn() },
}));

jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: { getPollById: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const userService = asServiceMock(UserService);

const NOW = new Date('2026-08-03T12:00:00.000Z');

function makeCtx(init: { first_name?: string; match?: string } = {}) {
  return {
    from: { id: 555, first_name: init.first_name ?? 'Игорь', username: 'igor' },
    chat: { id: 555, type: 'private' },
    match: init.match,
    reply: jest.fn().mockResolvedValue(undefined),
  } as unknown as BotContext & { reply: jest.Mock };
}

/** Пользователь, записанный `ageMs` миллисекунд назад: 0 — новый. */
function registered(ageMs: number) {
  userService.upsertUser.mockResolvedValue({
    id: 1,
    isAdmin: false,
    createdAt: new Date(NOW.getTime() - ageMs),
  });
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);
  envBackup = { ...process.env };
  process.env.WEBAPP_URL = 'https://app.example.com';
  registered(60_000);
  userService.getUserByTelegramId.mockResolvedValue({ id: 1, isAdmin: false });
});

afterEach(() => {
  jest.useRealTimers();
  process.env = envBackup;
});

describe('/start', () => {
  /* Имя приходит из Telegram, где `_` в нике — обычное дело. Без
     экранирования приветствие не доходит совсем: `can't parse entities`. */
  it.each<[string, number, string, string]>([
    ['новому', 0, 'Соус_острый', 'Соус\\_острый'],
    ['вернувшемуся', 60_000, 'Аня *К*', 'Аня \\*К\\*'],
  ])('спецсимволы в имени экранируются в приветствии %s', async (_who, ageMs, name, escaped) => {
    registered(ageMs);
    const ctx = makeCtx({ first_name: name });

    await startCommand(ctx);

    expect(ctx.reply.mock.calls[0][0]).toContain(escaped);
  });

  it('неизвестный префикс deep-link ведёт в корень Mini App', async () => {
    const ctx = makeCtx({ match: 'somethingelse' });

    await startCommand(ctx);

    expect(JSON.stringify(ctx.reply.mock.calls)).toContain('"web_app":{"url":"https://app.example.com"}');
  });
});

describe('сбой базы не оставляет человека без ответа', () => {
  it.each<[string, () => void, (ctx: BotContext) => Promise<void>]>([
    ['/start: падение записи пользователя', () => userService.upsertUser.mockRejectedValue(new Error('db down')), startCommand],
    ['/app: ошибка чтения пользователя', () => userService.getUserByTelegramId.mockRejectedValue(new Error('db down')), appCommand],
  ])('%s', async (_name, arrange, command) => {
    arrange();
    const ctx = makeCtx();

    await command(ctx);

    expect(ctx.reply).toHaveBeenCalled();
  });
});

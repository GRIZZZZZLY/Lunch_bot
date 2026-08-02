/**
 * Вход в Mini App. Это граница доверия: за ней initData уже считается
 * подтверждённой. Проверяем формат, подпись, запрет обхода проверки в
 * продакшене и то, что членство в группе по deep-link добавляется только
 * когда группа реально найдена.
 */
import { AuthController } from '../../../api/controllers/auth.controller';
import { UserService } from '../../../services/user.service';
import { GroupService } from '../../../services/group.service';
import { validateTelegramInitData } from '../../../utils/telegram-auth';
import { JwtService } from '../../../services/jwt.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/user.service', () => ({
  UserService: { upsertUser: jest.fn(), getUserById: jest.fn() },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: {
    getGroupById: jest.fn(),
    addMemberFromStartParam: jest.fn(),
  },
}));

jest.mock('../../../utils/telegram-auth', () => ({
  validateTelegramInitData: jest.fn(),
  parseInitDataUnsafe: jest.fn(),
}));

jest.mock('../../../services/jwt.service', () => ({
  JwtService: {
    generateTokenPair: jest.fn(() => ({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const userService = asServiceMock(UserService);
const groupService = asServiceMock(GroupService);
const validateInitData = asMock(validateTelegramInitData);
const { parseInitDataUnsafe }: { parseInitDataUnsafe: jest.Mock } =
  jest.requireMock('../../../utils/telegram-auth');
const jwtService = asServiceMock(JwtService);

const STORED_USER = {
  id: 1,
  telegramId: BigInt(555),
  username: 'igor',
  firstName: 'Игорь',
  lastName: null,
  photoUrl: null,
  isAdmin: false,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const TELEGRAM_USER = {
  id: 555,
  username: 'igor',
  first_name: 'Игорь',
  last_name: undefined,
  photo_url: undefined,
};

/** initData с обязательным hash — формат, который проходит первые проверки. */
const SIGNED_INIT_DATA = 'user=%7B%22id%22%3A555%7D&auth_date=1&hash=abc';

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  envBackup = { ...process.env };
  process.env.NODE_ENV = 'test';
  delete process.env.SKIP_TELEGRAM_VALIDATION;

  userService.upsertUser.mockResolvedValue(STORED_USER);
  userService.getUserById.mockResolvedValue(STORED_USER);
  validateInitData.mockReturnValue(TELEGRAM_USER);
  jwtService.generateTokenPair.mockReturnValue({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  });
});

afterEach(() => {
  process.env = envBackup;
});

describe('POST /api/auth/validate — формат initData', () => {
  it.each([
    ['отсутствует', {}],
    ['не строка', { initData: 42 }],
    ['пустая строка', { initData: '   ' }],
    ['длиннее 5000 символов', { initData: 'x'.repeat(5001) }],
  ])('initData %s — 400 INVALID_REQUEST', async (_label, body) => {
    const res = mockResponse();

    await AuthController.validateInitData(mockRequest({ body }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_REQUEST' });
    expect(userService.upsertUser).not.toHaveBeenCalled();
  });

  it('без hash и signature — 400', async () => {
    const res = mockResponse();

    await AuthController.validateInitData(
      mockRequest({ body: { initData: 'user=%7B%7D&auth_date=1' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(validateInitData).not.toHaveBeenCalled();
  });

  it('формата signature (Telegram 8.0) достаточно', async () => {
    const res = mockResponse();

    await AuthController.validateInitData(
      mockRequest({ body: { initData: 'user=%7B%7D&signature=xyz' } }),
      res
    );

    expect(validateInitData).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});

describe('POST /api/auth/validate — подпись', () => {
  it('валидная подпись создаёт пользователя и выдаёт пару токенов', async () => {
    const res = mockResponse();

    await AuthController.validateInitData(
      mockRequest({ body: { initData: SIGNED_INIT_DATA } }),
      res
    );

    expect(userService.upsertUser).toHaveBeenCalledWith({
      telegramId: '555',
      username: 'igor',
      firstName: 'Игорь',
      lastName: undefined,
      photoUrl: undefined,
    });
    expect(res.body).toMatchObject({
      success: true,
      user: { id: 1, telegramId: '555' },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    });
  });

  it('неверная подпись — 401 INVALID_INIT_DATA', async () => {
    validateInitData.mockReturnValue(null);
    const res = mockResponse();

    await AuthController.validateInitData(
      mockRequest({ body: { initData: SIGNED_INIT_DATA } }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'INVALID_INIT_DATA' });
    expect(userService.upsertUser).not.toHaveBeenCalled();
  });

  it('падение записи пользователя — 500', async () => {
    userService.upsertUser.mockRejectedValue(new Error('db down'));
    const res = mockResponse();

    await AuthController.validateInitData(
      mockRequest({ body: { initData: SIGNED_INIT_DATA } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('POST /api/auth/validate — SKIP_TELEGRAM_VALIDATION', () => {
  it('в продакшене обход проверки блокируется как ошибка конфигурации', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';
    const res = mockResponse();

    await AuthController.validateInitData(
      mockRequest({ body: { initData: SIGNED_INIT_DATA } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'SECURITY_VIOLATION' });
    expect(userService.upsertUser).not.toHaveBeenCalled();
  });

  it('в разработке берёт настоящего пользователя из initData без проверки подписи', async () => {
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';
    parseInitDataUnsafe.mockReturnValue({
      id: 777,
      username: 'dev',
      first_name: 'Dev',
    });
    const res = mockResponse();

    await AuthController.validateInitData(
      mockRequest({ body: { initData: SIGNED_INIT_DATA } }),
      res
    );

    expect(validateInitData).not.toHaveBeenCalled();
    expect(userService.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ telegramId: '777', username: 'dev' })
    );
    expect(res.body).toMatchObject({ success: true });
  });

  it('без username подставляет user_<id>', async () => {
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';
    parseInitDataUnsafe.mockReturnValue({ id: 777, first_name: 'Dev' });

    await AuthController.validateInitData(
      mockRequest({ body: { initData: SIGNED_INIT_DATA } }),
      mockResponse()
    );

    expect(userService.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'user_777' })
    );
  });

  it('нераспознанный initData откатывается на TEST_USER_ID', async () => {
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';
    process.env.TEST_USER_ID = '424242';
    parseInitDataUnsafe.mockReturnValue(null);
    const res = mockResponse();

    await AuthController.validateInitData(
      mockRequest({ body: { initData: SIGNED_INIT_DATA } }),
      res
    );

    expect(userService.upsertUser).toHaveBeenCalledWith({
      telegramId: '424242',
      username: 'dev_user',
      firstName: 'Dev',
      lastName: 'User',
    });
    expect(res.body).toMatchObject({ success: true });
  });

  it('мок-токен из старого клиента тоже уходит в fallback', async () => {
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';
    delete process.env.TEST_USER_ID;

    await AuthController.validateInitData(
      mockRequest({ body: { initData: 'mock_jwt_token_12345678' } }),
      mockResponse()
    );

    expect(parseInitDataUnsafe).not.toHaveBeenCalled();
    expect(userService.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ telegramId: '123456789' })
    );
  });
});

describe('POST /api/auth/validate — членство по deep-link', () => {
  const initDataWith = (startParam: string): string =>
    `user=%7B%22id%22%3A555%7D&auth_date=1&hash=abc&start_param=${startParam}`;

  beforeEach(() => {
    groupService.getGroupById.mockResolvedValue({
      id: 100,
      telegramId: BigInt(-1001),
    });
    groupService.addMemberFromStartParam.mockResolvedValue(true);
  });

  it('vote_<pollId> добавляет в группу голосования', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({ groupId: 100 } as never);

    await AuthController.validateInitData(
      mockRequest({ body: { initData: initDataWith('vote_7') } }),
      mockResponse()
    );

    expect(prismaMock.poll.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      select: { groupId: true },
    });
    expect(groupService.addMemberFromStartParam).toHaveBeenCalled();
  });

  it('storerun_<id> добавляет в группу забега', async () => {
    prismaMock.storeRun.findUnique.mockResolvedValue({ groupId: 100 } as never);

    await AuthController.validateInitData(
      mockRequest({ body: { initData: initDataWith('storerun_9') } }),
      mockResponse()
    );

    expect(prismaMock.storeRun.findUnique).toHaveBeenCalledWith({
      where: { id: 9 },
      select: { groupId: true },
    });
    expect(groupService.addMemberFromStartParam).toHaveBeenCalled();
  });

  it.each(['menu_-1001', 'add_-1001', 'poll_-1001'])(
    '%s ищет группу по telegramId',
    async startParam => {
      prismaMock.group.findUnique.mockResolvedValue({ id: 100 } as never);

      await AuthController.validateInitData(
        mockRequest({ body: { initData: initDataWith(startParam) } }),
        mockResponse()
      );

      expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
        where: { telegramId: BigInt(-1001) },
        select: { id: true },
      });
    }
  );

  it('неизвестный префикс членство не меняет', async () => {
    await AuthController.validateInitData(
      mockRequest({ body: { initData: initDataWith('somethingelse') } }),
      mockResponse()
    );

    expect(groupService.addMemberFromStartParam).not.toHaveBeenCalled();
  });

  it.each([
    ['нечисловой pollId', 'vote_abc'],
    ['нечисловой runId', 'storerun_abc'],
    ['telegramId не число', 'menu_abc'],
    ['пустой telegramId', 'menu_'],
  ])('%s не приводит к добавлению в группу', async (_label, startParam) => {
    const res = mockResponse();

    await AuthController.validateInitData(
      mockRequest({ body: { initData: initDataWith(startParam) } }),
      res
    );

    expect(groupService.addMemberFromStartParam).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('голосования нет — членство не добавляется', async () => {
    prismaMock.poll.findUnique.mockResolvedValue(null);

    await AuthController.validateInitData(
      mockRequest({ body: { initData: initDataWith('vote_7') } }),
      mockResponse()
    );

    expect(groupService.addMemberFromStartParam).not.toHaveBeenCalled();
  });

  it('группа не найдена в сервисе — членство не добавляется', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({ groupId: 100 } as never);
    groupService.getGroupById.mockResolvedValue(null);

    await AuthController.validateInitData(
      mockRequest({ body: { initData: initDataWith('vote_7') } }),
      mockResponse()
    );

    expect(groupService.addMemberFromStartParam).not.toHaveBeenCalled();
  });

  it('падение добавления членства не ломает вход', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({ groupId: 100 } as never);
    groupService.addMemberFromStartParam.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await AuthController.validateInitData(
      mockRequest({ body: { initData: initDataWith('vote_7') } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it('ошибка базы при разборе start_param не ломает вход', async () => {
    prismaMock.poll.findUnique.mockRejectedValue(new Error('db down'));
    const res = mockResponse();

    await AuthController.validateInitData(
      mockRequest({ body: { initData: initDataWith('vote_7') } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(groupService.addMemberFromStartParam).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/me', () => {
  it('отдаёт текущего пользователя', async () => {
    const res = mockResponse();

    await AuthController.getCurrentUser(
      mockRequest({ user: STORED_USER }),
      res
    );

    expect(res.body).toMatchObject({
      success: true,
      data: { id: 1, telegramId: '555', username: 'igor' },
    });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await AuthController.getCurrentUser(mockRequest(), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'NOT_AUTHENTICATED' });
  });

  it('падение сериализации — 500', async () => {
    const res = mockResponse();
    (res.json as jest.Mock).mockImplementationOnce(() => {
      throw new Error('serialize failed');
    });

    await AuthController.getCurrentUser(
      mockRequest({ user: STORED_USER }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/auth/status', () => {
  it('для аутентифицированного отдаёт краткий профиль', async () => {
    const res = mockResponse();

    await AuthController.getAuthStatus(
      mockRequest({ user: STORED_USER }),
      res
    );

    expect(res.body).toMatchObject({
      authenticated: true,
      user: { id: 1, telegramId: '555', firstName: 'Игорь' },
    });
  });

  it('без токена отвечает authenticated: false, а не ошибкой', async () => {
    const res = mockResponse();

    await AuthController.getAuthStatus(mockRequest(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ authenticated: false, user: null });
  });

  it('внутренний сбой — 500', async () => {
    const res = mockResponse();
    (res.json as jest.Mock).mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await AuthController.getAuthStatus(mockRequest(), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/auth/refresh', () => {
  it('выдаёт новую пару токенов по свежим данным пользователя', async () => {
    const res = mockResponse();

    await AuthController.refreshAuth(
      mockRequest({ user: { id: 1 } }),
      res
    );

    expect(userService.getUserById).toHaveBeenCalledWith(1);
    expect(res.body).toMatchObject({
      success: true,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await AuthController.refreshAuth(mockRequest(), res);

    expect(res.statusCode).toBe(401);
    expect(userService.getUserById).not.toHaveBeenCalled();
  });

  it('пользователя больше нет — 401 USER_NOT_ACTIVE', async () => {
    userService.getUserById.mockResolvedValue(null);
    const res = mockResponse();

    await AuthController.refreshAuth(
      mockRequest({ user: { id: 1 } }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'USER_NOT_ACTIVE' });
  });

  it('деактивированный пользователь новых токенов не получает', async () => {
    userService.getUserById.mockResolvedValue({
      ...STORED_USER,
      isActive: false,
    });
    const res = mockResponse();

    await AuthController.refreshAuth(
      mockRequest({ user: { id: 1 } }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(jwtService.generateTokenPair).not.toHaveBeenCalled();
  });

  it('ошибка базы — 500', async () => {
    userService.getUserById.mockRejectedValue(new Error('db down'));
    const res = mockResponse();

    await AuthController.refreshAuth(
      mockRequest({ user: { id: 1 } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

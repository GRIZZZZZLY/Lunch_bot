/**
 * Аутентификация HTTP-слоя. Это граница доверия всего API: за ней контроллеры
 * считают `req.user` доказанным.
 *
 * Обычные исходы (нет токена, истёк, refresh вместо access, пользователь
 * деактивирован, обход подписи в production) проверены на настоящем API в
 * integration/api/auth-surface.routes.test.ts. Здесь остаются ветки, до
 * которых через HTTP не добраться без подмены сервисов:
 *
 * - legacy-откат на initData, когда проверка JWT бросает;
 * - режим обхода подписи: НЕТ отката на TEST_USER_ID — иначе голоса разных
 *   людей смешались бы под одним аккаунтом.
 *
 * Разбор подписи initData покрыт в unit/utils/telegram-auth.test.ts.
 */
import { telegramAuthMiddleware } from '../../../api/middleware/telegram-auth';
import { UserService } from '../../../services/user.service';
import { JwtService } from '../../../services/jwt.service';
import { validateTelegramInitData } from '../../../utils/telegram-auth';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../services/user.service', () => ({
  UserService: {
    getUserById: jest.fn(),
    getUserByTelegramId: jest.fn(),
    createUser: jest.fn(),
  },
}));

jest.mock('../../../services/jwt.service', () => ({
  JwtService: { verifyToken: jest.fn() },
}));

jest.mock('../../../utils/telegram-auth', () => ({
  validateTelegramInitData: jest.fn(),
  parseInitDataUnsafe: jest.fn(),
}));

jest.mock('../../../services/cache.service', () => ({
  cacheService: { setIfAbsent: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const userService = asServiceMock(UserService);
const jwtService = asServiceMock(JwtService);
const validateInitData = asMock(validateTelegramInitData);
const { parseInitDataUnsafe } = jest.requireMock(
  '../../../utils/telegram-auth'
);

const USER = { id: 1, telegramId: BigInt(555), isActive: true, isAdmin: false };
/** JWT начинается с 'eyJ' — по этому признаку middleware отличает его от initData. */
const JWT = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  envBackup = { ...process.env };
  process.env.NODE_ENV = 'test';
  delete process.env.SKIP_TELEGRAM_VALIDATION;

  userService.getUserById.mockResolvedValue(USER);
  userService.getUserByTelegramId.mockResolvedValue(USER);
  jwtService.verifyToken.mockReturnValue({ userId: 1, type: 'access' });
});

afterEach(() => {
  process.env = envBackup;
});

describe('telegramAuthMiddleware — legacy-откат на initData', () => {
  beforeEach(() => {
    jwtService.verifyToken.mockImplementation(() => {
      throw new Error('malformed');
    });
  });

  it('падение JWT-проверки откатывается на initData (обратная совместимость)', async () => {
    validateInitData.mockReturnValue({ id: 555 });
    const req = mockRequest({ headers: { authorization: 'Bearer initdata' } });
    const next = jest.fn();

    await telegramAuthMiddleware(req, mockResponse(), next);

    expect((req as unknown as { user: unknown }).user).toBe(USER);
    expect(next).toHaveBeenCalled();
  });

  it('невалидный initData в legacy-пути — 401 INVALID_TOKEN', async () => {
    validateInitData.mockReturnValue(null);
    const res = mockResponse();

    await telegramAuthMiddleware(
      mockRequest({ headers: { authorization: 'Bearer garbage' } }),
      res,
      jest.fn()
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('legacy-путь: неактивный пользователь — 401 USER_NOT_ACTIVE', async () => {
    validateInitData.mockReturnValue({ id: 555 });
    userService.getUserByTelegramId.mockResolvedValue({
      ...USER,
      isActive: false,
    });
    const res = mockResponse();

    await telegramAuthMiddleware(
      mockRequest({ headers: { authorization: 'Bearer initdata' } }),
      res,
      jest.fn()
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'USER_NOT_ACTIVE' });
  });

  it('падение разбора initData тоже даёт 401, а не 500', async () => {
    validateInitData.mockImplementation(() => {
      throw new Error('boom');
    });
    const res = mockResponse();

    await telegramAuthMiddleware(
      mockRequest({ headers: { authorization: 'Bearer garbage' } }),
      res,
      jest.fn()
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'INVALID_TOKEN' });
  });
});

describe('telegramAuthMiddleware — режим обхода подписи', () => {
  beforeEach(() => {
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  });

  it('initData даёт настоящего пользователя из Telegram', async () => {
    const dev = { ...USER, id: 7, telegramId: BigInt(777) };
    parseInitDataUnsafe.mockReturnValue({ id: 777, first_name: 'Dev' });
    userService.getUserByTelegramId.mockImplementation(async (telegramId: bigint) =>
      telegramId === BigInt(777) ? dev : null
    );
    const req = mockRequest({ headers: { authorization: 'Bearer initdata' } });
    const next = jest.fn();

    await telegramAuthMiddleware(req, mockResponse(), next);

    expect((req as unknown as { user: unknown }).user).toBe(dev);
    expect(next).toHaveBeenCalled();
  });

  it('неизвестный Telegram-пользователь создаётся с его настоящим id', async () => {
    parseInitDataUnsafe.mockReturnValue({
      id: 777,
      first_name: 'Dev',
      username: 'dev',
    });
    userService.getUserByTelegramId.mockResolvedValue(null);
    userService.createUser.mockResolvedValue({ id: 42 });
    const req = mockRequest({ headers: { authorization: 'Bearer initdata' } });

    await telegramAuthMiddleware(req, mockResponse(), jest.fn());

    expect(userService.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ telegramId: '777' })
    );
    expect((req as unknown as { user: { id: number } }).user.id).toBe(42);
  });

  it('без пригодных данных отказывает, а НЕ подставляет тестового пользователя', async () => {
    process.env.TEST_USER_ID = '424242';
    parseInitDataUnsafe.mockReturnValue(null);
    const res = mockResponse();
    const next = jest.fn();

    await telegramAuthMiddleware(
      mockRequest({ headers: { authorization: 'Bearer initdata' } }),
      res,
      next
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'MISSING_TELEGRAM_DATA' });
    expect(userService.createUser).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('вообще без заголовка тоже отказ', async () => {
    const res = mockResponse();

    await telegramAuthMiddleware(mockRequest(), res, jest.fn());

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'MISSING_TELEGRAM_DATA' });
  });

  it('невалидный тип JWT в режиме обхода не пропускает', async () => {
    jwtService.verifyToken.mockReturnValue({ userId: 1, type: 'refresh' });
    const res = mockResponse();
    const next = jest.fn();

    await telegramAuthMiddleware(
      mockRequest({ headers: { authorization: `Bearer ${JWT}` } }),
      res,
      next
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('деактивированный пользователь по JWT не проходит', async () => {
    userService.getUserById.mockResolvedValue({ ...USER, isActive: false });
    const res = mockResponse();
    const next = jest.fn();

    await telegramAuthMiddleware(
      mockRequest({ headers: { authorization: `Bearer ${JWT}` } }),
      res,
      next
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('падение проверки JWT не пропускает запрос дальше', async () => {
    jwtService.verifyToken.mockImplementation(() => {
      throw new Error('malformed');
    });
    const res = mockResponse();
    const next = jest.fn();

    await telegramAuthMiddleware(
      mockRequest({ headers: { authorization: `Bearer ${JWT}` } }),
      res,
      next
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('падение разбора initData не пропускает запрос дальше', async () => {
    parseInitDataUnsafe.mockImplementation(() => {
      throw new Error('boom');
    });
    const res = mockResponse();
    const next = jest.fn();

    await telegramAuthMiddleware(
      mockRequest({ headers: { authorization: 'Bearer initdata' } }),
      res,
      next
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

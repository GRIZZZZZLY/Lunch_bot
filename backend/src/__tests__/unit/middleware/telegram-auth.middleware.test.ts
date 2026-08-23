/**
 * Аутентификация HTTP-слоя. Это граница доверия всего API: за ней контроллеры
 * считают `req.user` доказанным. Проверяются все ветки, включая режим обхода
 * подписи:
 *
 * - SKIP_TELEGRAM_VALIDATION в продакшене обязан ломать запрос, а не тихо
 *   пропускать всех;
 * - в режиме обхода НЕТ отката на TEST_USER_ID — иначе голоса разных людей
 *   смешались бы под одним аккаунтом;
 * - access-токеном нельзя обновлять сессию, refresh-токеном нельзя ходить по API.
 *
 * Повторное использование refresh-токена и разбор подписи покрыты отдельно в
 * unit/refresh-token.middleware.test.ts и unit/telegram-auth.security.test.ts.
 */
import {
  telegramAuthMiddleware,
  validateInitDataMiddleware,
  optionalAuthMiddleware,
} from '../../../api/middleware/telegram-auth';
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

describe('telegramAuthMiddleware — обычный режим', () => {
  it('валидный access-токен пропускает и кладёт пользователя в запрос', async () => {
    const req = mockRequest({ headers: { authorization: `Bearer ${JWT}` } });
    const res = mockResponse();
    const next = jest.fn();

    await telegramAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as unknown as { user: unknown }).user).toBe(USER);
  });

  it.each([
    ['без заголовка', {}],
    ['не Bearer', { authorization: 'Basic abc' }],
  ])('%s — 401 MISSING_TOKEN', async (_label, headers) => {
    const res = mockResponse();
    const next = jest.fn();

    await telegramAuthMiddleware(mockRequest({ headers }), res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'MISSING_TOKEN' });
    expect(next).not.toHaveBeenCalled();
  });

  it('истёкший токен — 401 TOKEN_EXPIRED', async () => {
    jwtService.verifyToken.mockReturnValue(null);
    validateInitData.mockReturnValue(null);
    const res = mockResponse();

    await telegramAuthMiddleware(
      mockRequest({ headers: { authorization: `Bearer ${JWT}` } }),
      res,
      jest.fn()
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'TOKEN_EXPIRED' });
  });

  it('refresh-токеном по API ходить нельзя — 401 INVALID_TOKEN_TYPE', async () => {
    jwtService.verifyToken.mockReturnValue({ userId: 1, type: 'refresh' });
    const res = mockResponse();
    const next = jest.fn();

    await telegramAuthMiddleware(
      mockRequest({ headers: { authorization: `Bearer ${JWT}` } }),
      res,
      next
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'INVALID_TOKEN_TYPE' });
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['пользователя нет', null],
    ['пользователь деактивирован', { ...USER, isActive: false }],
  ])('%s — 401 USER_NOT_ACTIVE', async (_label, user) => {
    userService.getUserById.mockResolvedValue(user);
    const res = mockResponse();

    await telegramAuthMiddleware(
      mockRequest({ headers: { authorization: `Bearer ${JWT}` } }),
      res,
      jest.fn()
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'USER_NOT_ACTIVE' });
  });

  it('падение JWT-проверки откатывается на initData (обратная совместимость)', async () => {
    jwtService.verifyToken.mockImplementation(() => {
      throw new Error('malformed');
    });
    validateInitData.mockReturnValue({ id: 555 });
    const req = mockRequest({ headers: { authorization: 'Bearer initdata' } });
    const next = jest.fn();

    await telegramAuthMiddleware(req, mockResponse(), next);

    expect(validateInitData).toHaveBeenCalledWith('initdata');
    expect((req as unknown as { user: unknown }).user).toBe(USER);
    expect(next).toHaveBeenCalled();
  });

  it('невалидный initData в legacy-пути — 401 INVALID_TOKEN', async () => {
    jwtService.verifyToken.mockImplementation(() => {
      throw new Error('malformed');
    });
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
    jwtService.verifyToken.mockImplementation(() => {
      throw new Error('malformed');
    });
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
    jwtService.verifyToken.mockImplementation(() => {
      throw new Error('malformed');
    });
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

  it('неожиданная ошибка внутри — 500', async () => {
    const res = mockResponse();
    (res.status as jest.Mock).mockImplementationOnce(() => {
      throw new Error('response broken');
    });

    await telegramAuthMiddleware(mockRequest({ headers: {} }), res, jest.fn());

    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('telegramAuthMiddleware — режим обхода подписи', () => {
  beforeEach(() => {
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  });

  it('в продакшене режим обхода ломает запрос, а не пропускает всех', async () => {
    process.env.NODE_ENV = 'production';
    const res = mockResponse();
    const next = jest.fn();

    await telegramAuthMiddleware(
      mockRequest({ headers: { authorization: `Bearer ${JWT}` } }),
      res,
      next
    );

    expect(res.statusCode).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('JWT в режиме обхода всё равно проверяется', async () => {
    const req = mockRequest({ headers: { authorization: `Bearer ${JWT}` } });
    const next = jest.fn();

    await telegramAuthMiddleware(req, mockResponse(), next);

    expect(jwtService.verifyToken).toHaveBeenCalledWith(JWT);
    expect((req as unknown as { user: unknown }).user).toBe(USER);
  });

  it('initData даёт настоящего пользователя из Telegram', async () => {
    parseInitDataUnsafe.mockReturnValue({ id: 777, first_name: 'Dev' });
    const req = mockRequest({ headers: { authorization: 'Bearer initdata' } });
    const next = jest.fn();

    await telegramAuthMiddleware(req, mockResponse(), next);

    expect(userService.getUserByTelegramId).toHaveBeenCalledWith(BigInt(777));
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

    expect(userService.createUser).toHaveBeenCalledWith({
      telegramId: '777',
      username: 'dev',
      firstName: 'Dev',
      lastName: undefined,
    });
    expect((req as unknown as { user: { id: number } }).user.id).toBe(42);
  });

  it('без username подставляется user_<id>', async () => {
    parseInitDataUnsafe.mockReturnValue({ id: 777, first_name: 'Dev' });
    userService.getUserByTelegramId.mockResolvedValue(null);
    userService.createUser.mockResolvedValue({ id: 42 });

    await telegramAuthMiddleware(
      mockRequest({ headers: { authorization: 'Bearer initdata' } }),
      mockResponse(),
      jest.fn()
    );

    expect(userService.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'user_777' })
    );
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

/* Тесты adminMiddleware удалены вместе с самим middleware: понятия глобального
   администратора больше нет. Права на ресурс группы проверяет
   requireGroupAdmin (см. middleware/guards.test.ts), служебные операции —
   operationsApiMiddleware там же. */

describe('validateInitDataMiddleware', () => {
  it('валидный initData кладёт данные Telegram в запрос', async () => {
    validateInitData.mockReturnValue({ id: 555, first_name: 'Игорь' });
    const req = mockRequest({ body: { initData: 'user=...&hash=abc' } });
    const next = jest.fn();

    await validateInitDataMiddleware(req, mockResponse(), next);

    expect((req as unknown as { telegramUser: { id: number } }).telegramUser.id).toBe(
      555
    );
    expect(next).toHaveBeenCalled();
  });

  it('без initData — 400', async () => {
    const res = mockResponse();
    const next = jest.fn();

    await validateInitDataMiddleware(mockRequest({ body: {} }), res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'MISSING_INIT_DATA' });
    expect(next).not.toHaveBeenCalled();
  });

  it('неверная подпись — 400', async () => {
    validateInitData.mockReturnValue(null);
    const res = mockResponse();

    await validateInitDataMiddleware(
      mockRequest({ body: { initData: 'garbage' } }),
      res,
      jest.fn()
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_INIT_DATA' });
  });

  it('в продакшене режим обхода ломает запрос', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';
    const res = mockResponse();

    await validateInitDataMiddleware(
      mockRequest({ body: { initData: 'x' } }),
      res,
      jest.fn()
    );

    expect(res.statusCode).toBe(500);
  });

  it('в режиме обхода берёт настоящего пользователя из initData', async () => {
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';
    parseInitDataUnsafe.mockReturnValue({ id: 777 });
    const req = mockRequest({ body: { initData: 'x' } });
    const next = jest.fn();

    await validateInitDataMiddleware(req, mockResponse(), next);

    expect(validateInitData).not.toHaveBeenCalled();
    expect((req as unknown as { telegramUser: { id: number } }).telegramUser.id).toBe(
      777
    );
    expect(next).toHaveBeenCalled();
  });

  it.each([
    ['пустой initData', ''],
    ['только пробелы', '   '],
  ])('в режиме обхода %s — 401 без подстановки тестового пользователя', async (_label, initData) => {
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';
    const res = mockResponse();
    const next = jest.fn();

    await validateInitDataMiddleware(mockRequest({ body: { initData } }), res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'MISSING_TELEGRAM_DATA' });
    expect(next).not.toHaveBeenCalled();
  });

  it('в режиме обхода пользователь без id не принимается', async () => {
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';
    parseInitDataUnsafe.mockReturnValue({ first_name: 'Dev' });
    const res = mockResponse();

    await validateInitDataMiddleware(
      mockRequest({ body: { initData: 'x' } }),
      res,
      jest.fn()
    );

    expect(res.statusCode).toBe(401);
  });

  it('падение разбора в режиме обхода даёт 401', async () => {
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';
    parseInitDataUnsafe.mockImplementation(() => {
      throw new Error('boom');
    });
    const res = mockResponse();

    await validateInitDataMiddleware(
      mockRequest({ body: { initData: 'x' } }),
      res,
      jest.fn()
    );

    expect(res.statusCode).toBe(401);
  });

  it('неожиданная ошибка — 500', async () => {
    validateInitData.mockImplementation(() => {
      throw new Error('boom');
    });
    const res = mockResponse();

    await validateInitDataMiddleware(
      mockRequest({ body: { initData: 'x' } }),
      res,
      jest.fn()
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('optionalAuthMiddleware', () => {
  it('с валидным токеном пользователь появляется в запросе', async () => {
    const req = mockRequest({ headers: { authorization: `Bearer ${JWT}` } });
    const next = jest.fn();

    await optionalAuthMiddleware(req, mockResponse(), next);

    expect((req as unknown as { user: unknown }).user).toBe(USER);
    expect(next).toHaveBeenCalled();
  });

  it('без токена запрос идёт дальше анонимно', async () => {
    const req = mockRequest();
    const next = jest.fn();

    await optionalAuthMiddleware(req, mockResponse(), next);

    expect((req as unknown as { user: unknown }).user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('битый токен не мешает анонимному доступу', async () => {
    jwtService.verifyToken.mockImplementation(() => {
      throw new Error('malformed');
    });
    const req = mockRequest({ headers: { authorization: 'Bearer garbage' } });
    const next = jest.fn();

    await optionalAuthMiddleware(req, mockResponse(), next);

    expect((req as unknown as { user: unknown }).user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('refresh-токен пользователя не аутентифицирует', async () => {
    jwtService.verifyToken.mockReturnValue({ userId: 1, type: 'refresh' });
    const req = mockRequest({ headers: { authorization: `Bearer ${JWT}` } });
    const next = jest.fn();

    await optionalAuthMiddleware(req, mockResponse(), next);

    expect((req as unknown as { user: unknown }).user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('деактивированный пользователь остаётся анонимным', async () => {
    userService.getUserById.mockResolvedValue({ ...USER, isActive: false });
    const req = mockRequest({ headers: { authorization: `Bearer ${JWT}` } });
    const next = jest.fn();

    await optionalAuthMiddleware(req, mockResponse(), next);

    expect((req as unknown as { user: unknown }).user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

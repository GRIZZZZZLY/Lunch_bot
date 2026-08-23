/**
 * Три стража доступа и счётчик метрик.
 *
 * Каждый из них — единственная защита своего класса маршрутов, поэтому здесь
 * проверяются не «ветки», а конкретные способы обойти проверку:
 *  - groupAdmin: подставить groupId в другое место запроса и оказаться админом
 *    чужой группы;
 *  - operationsApi: попасть в системные операции при выключенном флаге, со
 *    коротким секретом или подобрав секрет по длине ответа;
 *  - avatarAccess: открыть аватар без подписи, с просроченной или чужой.
 */
import crypto from 'crypto';
import { requireGroupAdmin } from '../../../api/middleware/group-admin';
import { operationsApiMiddleware } from '../../../api/middleware/operations-api';
import { avatarAccessMiddleware } from '../../../api/middleware/avatar-signature';
import { metricsMiddleware } from '../../../api/middleware/metrics';
import { GroupService } from '../../../services/group.service';
import { metricsService } from '../../../services/metrics.service';
import { signAvatarUrl } from '../../../utils/avatar-url-signer';
import { mockRequest, mockResponse, emit } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';
import type { MockRequest, MockResponse } from '../../helpers/http';

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupAdmin: jest.fn() },
}));

jest.mock('../../../services/metrics.service', () => ({
  metricsService: {
    recordResponseTime: jest.fn(),
    incrementErrors: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const groupService = asServiceMock(GroupService);
const metrics = asServiceMock(metricsService);
const { logger } = jest.requireMock('../../../utils/logger');

interface ErrorBody {
  success: boolean;
  error: string;
  code: string;
}

function ctx(): { res: MockResponse; next: jest.Mock } {
  return { res: mockResponse(), next: jest.fn() };
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  envBackup = { ...process.env };
  groupService.isUserGroupAdmin.mockResolvedValue(true);
});

afterEach(() => {
  process.env = envBackup;
});

describe('requireGroupAdmin', () => {
  async function call(req: MockRequest) {
    const { res, next } = ctx();
    await requireGroupAdmin(req, res, next);
    return { res, next, body: res.body as ErrorBody };
  }

  it('админ группы проходит дальше', async () => {
    const req = mockRequest({ user: { id: 1 }, params: { groupId: '10' } });

    const { next, res } = await call(req);

    expect(groupService.isUserGroupAdmin).toHaveBeenCalledWith(1, 10);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('не-админ получает 403, а не 404: группа существует, прав нет', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const req = mockRequest({ user: { id: 1 }, params: { groupId: '10' } });

    const { next, res, body } = await call(req);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(body.code).toBe('ACCESS_DENIED');
  });

  it('неаутентифицированный запрос отсекается до обращения к БД', async () => {
    const req = mockRequest({ params: { groupId: '10' } });

    const { res, body } = await call(req);

    expect(res.statusCode).toBe(401);
    expect(body.code).toBe('NOT_AUTHENTICATED');
    expect(groupService.isUserGroupAdmin).not.toHaveBeenCalled();
  });

  it('groupId берётся из query, если нет в params', async () => {
    const req = mockRequest({ user: { id: 1 }, query: { groupId: '11' } });

    await call(req);

    expect(groupService.isUserGroupAdmin).toHaveBeenCalledWith(1, 11);
  });

  it('groupId берётся из тела как последний вариант', async () => {
    const req = mockRequest({ user: { id: 1 }, body: { groupId: 12 } });

    await call(req);

    expect(groupService.isUserGroupAdmin).toHaveBeenCalledWith(1, 12);
  });

  it('params важнее query и body: подменить группу через query нельзя', async () => {
    const req = mockRequest({
      user: { id: 1 },
      params: { groupId: '10' },
      query: { groupId: '99' },
      body: { groupId: 98 },
    });

    await call(req);

    expect(groupService.isUserGroupAdmin).toHaveBeenCalledWith(1, 10);
    expect(groupService.isUserGroupAdmin).not.toHaveBeenCalledWith(1, 99);
  });

  it.each([
    ['без groupId', {}],
    ['нечисловой', { params: { groupId: 'abc' } }],
    ['нулевой', { params: { groupId: '0' } }],
    ['отрицательный', { params: { groupId: '-3' } }],
    ['Infinity', { body: { groupId: Infinity } }],
    ['NaN', { body: { groupId: NaN } }],
  ])('%s → 400 MISSING_GROUP_ID', async (_name, init) => {
    const req = mockRequest({ user: { id: 1 }, ...init });

    const { res, body } = await call(req);

    expect(res.statusCode).toBe(400);
    expect(body.code).toBe('MISSING_GROUP_ID');
    expect(groupService.isUserGroupAdmin).not.toHaveBeenCalled();
  });

  it('сбой проверки прав — 500, а не молчаливый пропуск', async () => {
    groupService.isUserGroupAdmin.mockRejectedValue(new Error('db down'));
    const req = mockRequest({ user: { id: 1 }, params: { groupId: '10' } });

    const { next, res, body } = await call(req);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(logger.error).toHaveBeenCalledWith(
      'requireGroupAdmin error:',
      expect.any(Error)
    );
  });
});

describe('operationsApiMiddleware', () => {
  const SECRET = 'x'.repeat(40);

  function call(headers: Record<string, string> = {}) {
    const req = mockRequest({ headers });
    const res = mockResponse();
    const next = jest.fn();
    operationsApiMiddleware(req, res, next);
    return { res, next, body: res.body as ErrorBody };
  }

  beforeEach(() => {
    process.env.ENABLE_OPERATIONS_API = 'true';
    process.env.OPERATIONS_API_SECRET = SECRET;
  });

  it('верный секрет при включённом флаге пропускает', () => {
    const { next } = call({ 'x-operations-secret': SECRET });

    expect(next).toHaveBeenCalled();
  });

  it('выключенный флаг отвечает 404, а не 403: маршрута как будто нет', () => {
    process.env.ENABLE_OPERATIONS_API = 'false';

    const { res, body, next } = call({ 'x-operations-secret': SECRET });

    expect(res.statusCode).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
    expect(next).not.toHaveBeenCalled();
  });

  it('отсутствующий флаг равносилен выключенному', () => {
    delete process.env.ENABLE_OPERATIONS_API;

    const { res } = call({ 'x-operations-secret': SECRET });

    expect(res.statusCode).toBe(404);
  });

  it('запрос без заголовка получает 403', () => {
    const { res, body } = call();

    expect(res.statusCode).toBe(403);
    expect(body.code).toBe('OPERATIONS_ACCESS_DENIED');
  });

  it('неверный секрет той же длины получает 403', () => {
    const { res } = call({ 'x-operations-secret': 'y'.repeat(40) });

    expect(res.statusCode).toBe(403);
  });

  it('секрет другой длины получает 403 без сравнения байтов', () => {
    const spy = jest.spyOn(crypto, 'timingSafeEqual');

    const { res } = call({ 'x-operations-secret': 'short' });

    expect(res.statusCode).toBe(403);
    spy.mockRestore();
  });

  it('секрет короче 32 символов не принимается даже при совпадении', () => {
    process.env.OPERATIONS_API_SECRET = 'tooshort';

    const { res, next } = call({ 'x-operations-secret': 'tooshort' });

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('незаданный секрет на сервере закрывает доступ', () => {
    delete process.env.OPERATIONS_API_SECRET;

    const { res, next } = call({ 'x-operations-secret': SECRET });

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});

describe('avatarAccessMiddleware', () => {
  const FILE_ID = 'AgACAgIAAxkBAAIB';

  function parse(url: string): { exp: string; sig: string } {
    const query = new URL(url, 'https://example.com').searchParams;
    return {
      exp: query.get('exp') as string,
      sig: query.get('sig') as string,
    };
  }

  async function call(
    query: Record<string, unknown>,
    params: Record<string, string> = { fileId: FILE_ID }
  ) {
    const req = mockRequest({ params, query });
    const res = mockResponse();
    const next = jest.fn();
    await avatarAccessMiddleware(req, res, next);
    return { res, next, body: res.body as ErrorBody };
  }

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-avatar-signing-0123456789';
  });

  it('свежая подпись открывает аватар', async () => {
    const { exp, sig } = parse(signAvatarUrl(FILE_ID));

    const { next, res } = await call({ exp, sig });

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('без подписи — 401 AVATAR_AUTH_REQUIRED', async () => {
    const { res, body, next } = await call({});

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(body.code).toBe('AVATAR_AUTH_REQUIRED');
  });

  it('подпись без exp отклоняется как невалидная', async () => {
    const { sig } = parse(signAvatarUrl(FILE_ID));

    const { res, body } = await call({ sig });

    expect(res.statusCode).toBe(401);
    expect(body.code).toBe('AVATAR_SIG_INVALID');
    expect(body.error).toContain('missing exp');
  });

  it('exp без подписи отклоняется', async () => {
    const { exp } = parse(signAvatarUrl(FILE_ID));

    const { body } = await call({ exp });

    expect(body.error).toContain('missing sig');
  });

  it('просроченная подпись отклоняется', async () => {
    const { exp, sig } = parse(signAvatarUrl(FILE_ID, -60));

    const { res, body } = await call({ exp, sig });

    expect(res.statusCode).toBe(401);
    expect(body.error).toContain('expired');
  });

  it('подпись от другого fileId не открывает этот аватар', async () => {
    const { exp, sig } = parse(signAvatarUrl('someone-else-file-id'));

    const { res, body } = await call({ exp, sig });

    expect(res.statusCode).toBe(401);
    expect(body.error).toContain('bad signature');
  });

  it('подпись, снятая другим секретом, не проходит', async () => {
    const { exp, sig } = parse(signAvatarUrl(FILE_ID));
    process.env.JWT_SECRET = 'a-completely-different-secret-value-here';

    const { res } = await call({ exp, sig });

    expect(res.statusCode).toBe(401);
  });

  it('массив вместо строки в query игнорируется как отсутствие подписи', async () => {
    const { exp, sig } = parse(signAvatarUrl(FILE_ID));

    const { body } = await call({ exp: [exp], sig: [sig] });

    expect(body.code).toBe('AVATAR_AUTH_REQUIRED');
  });

  it('вложенный объект в подписи не проходит проверку типа', async () => {
    const { exp } = parse(signAvatarUrl(FILE_ID));

    const { body } = await call({ exp, sig: { nested: 'x' } });

    expect(body.error).toContain('missing sig');
  });

  it('пустой fileId отклоняется', async () => {
    const { exp, sig } = parse(signAvatarUrl(FILE_ID));

    const { body } = await call({ exp, sig }, {});

    expect(body.error).toContain('missing fileId');
  });

  it('нечисловой exp отклоняется', async () => {
    const { sig } = parse(signAvatarUrl(FILE_ID));

    const { body } = await call({ exp: 'вчера', sig });

    expect(body.error).toContain('invalid exp');
  });

  it('отказ логируется с причиной и IP', async () => {
    await call({ exp: 'вчера', sig: 'x' });

    expect(logger.warn).toHaveBeenCalledWith(
      'avatarAccess: signature rejected',
      expect.objectContaining({ reason: 'invalid exp', ip: '127.0.0.1' })
    );
  });
});

describe('metricsMiddleware', () => {
  it('время ответа пишется после завершения, а не до', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn();

    metricsMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(metrics.recordResponseTime).not.toHaveBeenCalled();

    emit(res, 'finish');

    expect(metrics.recordResponseTime).toHaveBeenCalledWith(expect.any(Number));
  });

  it('5xx увеличивает счётчик ошибок', () => {
    const req = mockRequest();
    const res = mockResponse();
    metricsMiddleware(req, res, jest.fn());

    res.status(503);
    emit(res, 'finish');

    expect(metrics.incrementErrors).toHaveBeenCalledTimes(1);
  });

  it('4xx ошибкой сервера не считается', () => {
    const req = mockRequest();
    const res = mockResponse();
    metricsMiddleware(req, res, jest.fn());

    res.status(404);
    emit(res, 'finish');

    expect(metrics.incrementErrors).not.toHaveBeenCalled();
  });

  it('успешный ответ ошибкой не считается', () => {
    const req = mockRequest();
    const res = mockResponse();
    metricsMiddleware(req, res, jest.fn());

    emit(res, 'finish');

    expect(metrics.incrementErrors).not.toHaveBeenCalled();
  });
});

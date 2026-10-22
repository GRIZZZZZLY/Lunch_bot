/**
 * Два стража доступа и счётчик метрик.
 *
 * Каждый страж — единственная защита своего класса маршрутов, поэтому здесь
 * проверяются не «ветки», а конкретные способы обойти проверку:
 *  - groupAdmin: подставить groupId в другое место запроса и оказаться админом
 *    чужой группы;
 *  - avatarAccess: открыть аватар без подписи, с просроченной или чужой.
 */
import { requireGroupAdmin } from '../../../api/middleware/group-admin';
import { avatarAccessMiddleware } from '../../../api/middleware/avatar-signature';
import { metricsMiddleware } from '../../../api/middleware/metrics';
import { GroupService } from '../../../services/group.service';
import { metricsService } from '../../../services/metrics.service';
import { signAvatarUrl } from '../../../utils/avatar-url-signer';
import { mockRequest, mockResponse, emit } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';
import type { MockRequest, MockRequestInit } from '../../helpers/http';

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupAdmin: jest.fn() },
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

interface ErrorBody {
  success: boolean;
  error: string;
  code: string;
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
    const res = mockResponse();
    const next = jest.fn();
    await requireGroupAdmin(req, res, next);
    return { res, next, body: res.body as ErrorBody };
  }

  it('не-админ получает 403, а не 404: группа существует, прав нет', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const req = mockRequest({ user: { id: 1 }, params: { groupId: '10' } });

    const { next, res, body } = await call(req);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(body.code).toBe('ACCESS_DENIED');
  });

  // Пользователь 1 — админ только группы 10.
  it.each<[string, MockRequestInit, boolean]>([
    ['группа из params', { params: { groupId: '10' } }, true],
    ['группа из query, если нет в params', { query: { groupId: '10' } }, true],
    ['группа из тела как последний вариант', { body: { groupId: 10 } }, true],
    [
      'params важнее query и body',
      { params: { groupId: '10' }, query: { groupId: '99' }, body: { groupId: 98 } },
      true,
    ],
    ['подменить группу через query нельзя', { params: { groupId: '99' }, query: { groupId: '10' } }, false],
    [
      'глобальный админ не пересекает границы группы',
      { user: { id: 1, isAdmin: true }, params: { groupId: '99' } },
      false,
    ],
  ])('%s', async (_name, init, passes) => {
    groupService.isUserGroupAdmin.mockImplementation(
      async (userId: number, groupId: number) => userId === 1 && groupId === 10
    );
    const req = mockRequest({ user: { id: 1 }, ...init });

    const { next, res } = await call(req);

    expect(next).toHaveBeenCalledTimes(passes ? 1 : 0);
    expect(res.statusCode).toBe(passes ? 200 : 403);
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

  type Attempt = () => { query: Record<string, unknown>; params?: Record<string, string> };
  it.each<[string, Attempt]>([
    ['подпись без exp', () => ({ query: { sig: parse(signAvatarUrl(FILE_ID)).sig } })],
    ['exp без подписи', () => ({ query: { exp: parse(signAvatarUrl(FILE_ID)).exp } })],
    ['просроченная подпись', () => ({ query: parse(signAvatarUrl(FILE_ID, -60)) })],
    ['подпись от другого fileId', () => ({ query: parse(signAvatarUrl('someone-else-file-id')) })],
    [
      'вложенный объект в подписи',
      () => ({ query: { exp: parse(signAvatarUrl(FILE_ID)).exp, sig: { nested: 'x' } } }),
    ],
    ['пустой fileId', () => ({ query: parse(signAvatarUrl(FILE_ID)), params: {} })],
    ['нечисловой exp', () => ({ query: { exp: 'вчера', sig: parse(signAvatarUrl(FILE_ID)).sig } })],
  ])('%s — 401 AVATAR_SIG_INVALID', async (_name, attempt) => {
    const { query, params } = attempt();

    const { res, body, next } = await call(query, params);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(body.code).toBe('AVATAR_SIG_INVALID');
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
});

describe('metricsMiddleware', () => {
  it.each([
    [503, 1],
    [500, 1],
    [404, 0],
    [200, 0],
  ])('ответ %i добавляет к счётчику ошибок %i', (status, added) => {
    const before = metricsService.getMetrics().errors24h;
    const res = mockResponse();
    metricsMiddleware(mockRequest(), res, jest.fn());

    res.status(status);
    emit(res, 'finish');

    expect(metricsService.getMetrics().errors24h - before).toBe(added);
  });
});

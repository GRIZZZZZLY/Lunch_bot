/**
 * Живые обновления (SSE). Долгоживущие соединения — единственное место, где
 * утечка не падает, а копится: незакрытый heartbeat и неснятая подписка на
 * EventBus держат ответ и слушатель навсегда. Поэтому тесты проверяют не только
 * доставку событий, но и то, что после разрыва соединение уходит из реестра,
 * таймер остановлен, а подписки сняты.
 *
 * Отдельно проверяем адресность: персональный поток обязан отдавать событие
 * только тем, кто указан в audience, иначе чужие долги видны другому человеку.
 */
import {
  SSEController,
  getSSEConnectionCount,
} from '../../../api/controllers/sse.controller';
import { eventBus } from '../../../services/event-bus.service';
import { GroupService } from '../../../services/group.service';
import { PollService } from '../../../services/poll.service';
import {
  emitRequest,
  mockRequest,
  markStreamClosed,
  mockResponse,
  type MockResponse,
} from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';
import { PollQueryService } from '../../../services/poll-query.service';

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupMember: jest.fn() },
}));

jest.mock('../../../services/poll.service', () => ({
  PollService: { getPollGroupId: jest.fn() },
}));

jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: {
    getPollGroupId: jest.fn(),
  },
}));


jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const groupService = asServiceMock(GroupService);
const pollService = asServiceMock(PollService);
const pollQuery = asServiceMock(PollQueryService);

const USER = { id: 1, isAdmin: false };

/** Соединения, открытые в тесте: закрываем в afterEach, реестр общий на модуль. */
let opened: Array<{ req: ReturnType<typeof mockRequest>; res: MockResponse }>;

async function openPollStream(
  overrides: { user?: typeof USER; pollId?: string } = {}
): Promise<{ req: ReturnType<typeof mockRequest>; res: MockResponse }> {
  const req = mockRequest({
    user: overrides.user ?? USER,
    params: { pollId: overrides.pollId ?? '12' },
  });
  const res = mockResponse();
  await SSEController.stream(req, res);
  opened.push({ req, res });
  return { req, res };
}

async function openPersonalStream(
  user: { id: number } = USER
): Promise<{ req: ReturnType<typeof mockRequest>; res: MockResponse }> {
  const req = mockRequest({ user });
  const res = mockResponse();
  await SSEController.streamMe(req, res);
  opened.push({ req, res });
  return { req, res };
}

/** Тело всех SSE-сообщений одной строкой — так проще искать событие. */
function stream(res: MockResponse): string {
  return res.written.join('');
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  opened = [];
  pollQuery.getPollGroupId.mockResolvedValue(100);
  groupService.isUserGroupMember.mockResolvedValue(true);
});

afterEach(() => {
  // Реестр соединений живёт в модуле: не закрыв, следующий тест начнёт с
  // занятыми лимитами и «загадочными» 503.
  for (const { req } of opened) {
    emitRequest(req, 'close');
  }
  jest.useRealTimers();
  expect(getSSEConnectionCount().total).toBe(0);
});

describe('GET /api/polls/:pollId/stream', () => {
  it('открывает поток с правильными заголовками и первым событием connected', async () => {
    const { res } = await openPollStream();

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/event-stream');
    expect(res.headers['x-accel-buffering']).toBe('no');
    expect(stream(res)).toContain('event: connected');
    expect(stream(res)).toContain('"pollId":12');
  });

  it('соединение попадает в счётчик и уходит из него после разрыва', async () => {
    const { req } = await openPollStream();

    expect(getSSEConnectionCount()).toMatchObject({
      total: 1,
      byPoll: { 12: 1 },
    });

    emitRequest(req, 'close');

    expect(getSSEConnectionCount()).toMatchObject({ total: 0, byPoll: {} });
  });

  it('повторный разрыв не ломает реестр (cleanup идемпотентен)', async () => {
    const { req, res } = await openPollStream();

    emitRequest(req, 'close');
    emitRequest(req, 'close');

    expect(res.end).toHaveBeenCalledTimes(1);
    expect(getSSEConnectionCount().total).toBe(0);
  });

  it('ошибка соединения тоже закрывает поток', async () => {
    const { req } = await openPollStream();

    emitRequest(req, 'error');

    expect(getSSEConnectionCount().total).toBe(0);
  });

  it('heartbeat уходит по таймеру', async () => {
    const { res } = await openPollStream();

    jest.advanceTimersByTime(25_000);

    expect(stream(res)).toContain('event: heartbeat');
  });

  it('после разрыва heartbeat больше не пишется', async () => {
    const { req, res } = await openPollStream();

    emitRequest(req, 'close');
    const before = res.written.length;
    jest.advanceTimersByTime(75_000);

    expect(res.written).toHaveLength(before);
  });

  it('мёртвое соединение закрывается на первом heartbeat', async () => {
    const { res } = await openPollStream();

    markStreamClosed(res, 'ended');
    jest.advanceTimersByTime(25_000);

    expect(getSSEConnectionCount().total).toBe(0);
  });

  it('событие голосования доходит до подписчика', async () => {
    const { res } = await openPollStream();

    eventBus.emit('poll_updated', { pollId: 12, reason: 'vote' } as never);

    expect(stream(res)).toContain('event: poll_updated');
  });

  it('событие другого голосования отфильтровано', async () => {
    const { res } = await openPollStream();
    const before = res.written.length;

    eventBus.emit('poll_updated', { pollId: 999 } as never);

    expect(res.written).toHaveLength(before);
  });

  it.each(['category_order_updated', 'responsible_selected'])(
    'событие %s доставляется',
    async eventName => {
      const { res } = await openPollStream();

      eventBus.emit(eventName as never, { pollId: 12 } as never);

      expect(stream(res)).toContain(`event: ${eventName}`);
    }
  );

  it('после разрыва подписка снята — событие никуда не пишется', async () => {
    const { req, res } = await openPollStream();
    emitRequest(req, 'close');
    const before = res.written.length;

    eventBus.emit('poll_updated', { pollId: 12 } as never);

    expect(res.written).toHaveLength(before);
  });

  it.each([
    ['нечисловой', 'нет'],
    ['ноль', '0'],
    ['отрицательный', '-1'],
  ])('%s pollId — 400', async (_label, pollId) => {
    const req = mockRequest({ user: USER, params: { pollId } });
    const res = mockResponse();

    await SSEController.stream(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.written).toHaveLength(0);
  });

  it('голосования нет — 404', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const req = mockRequest({ user: USER, params: { pollId: '12' } });
    const res = mockResponse();

    await SSEController.stream(req, res);

    expect(res.statusCode).toBe(404);
  });

  it('не участник группы — 403 и поток не открывается', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const req = mockRequest({ user: USER, params: { pollId: '12' } });
    const res = mockResponse();

    await SSEController.stream(req, res);

    expect(res.statusCode).toBe(403);
    expect(getSSEConnectionCount().total).toBe(0);
  });

  /* Поток событий голосования — данные группы. Прежний обход по глобальному
     флагу удалён: не участник не подключается, кем бы он ни был. */
  it('не участник не подключается, даже с прежним глобальным флагом', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const { res } = await openPollStream({ user: { id: 9, isAdmin: true } });

    expect(res.statusCode).toBe(403);
    expect(groupService.isUserGroupMember).toHaveBeenCalled();
    expect(getSSEConnectionCount().total).toBe(0);
  });

  it('шестое соединение одного пользователя отклоняется с Retry-After', async () => {
    for (let i = 0; i < 5; i += 1) {
      await openPollStream();
    }

    const req = mockRequest({ user: USER, params: { pollId: '12' } });
    const res = mockResponse();
    await SSEController.stream(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.headers['retry-after']).toBe('30');
    expect(res.body).toMatchObject({ code: 'CONNECTION_LIMIT' });
  });
});

describe('GET /api/sse/me/stream', () => {
  it('открывает персональный поток', async () => {
    const { res } = await openPersonalStream();

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/event-stream');
    expect(stream(res)).toContain('"userId":1');
  });

  it('персональные соединения входят в общий счётчик', async () => {
    await openPersonalStream();

    expect(getSSEConnectionCount()).toMatchObject({ total: 1, personal: 1 });
  });

  it('без аутентификации — 401', async () => {
    const req = mockRequest();
    const res = mockResponse();

    await SSEController.streamMe(req, res);

    expect(res.statusCode).toBe(401);
  });

  it.each(['debt_updated', 'store_run_updated'])(
    'адресное событие %s доходит до адресата',
    async eventName => {
      const { res } = await openPersonalStream();

      eventBus.emit(eventName as never, { audience: [1] } as never);

      expect(stream(res)).toContain(`event: ${eventName}`);
    }
  );

  it('событие для другого человека в поток не попадает', async () => {
    const { res } = await openPersonalStream();
    const before = res.written.length;

    eventBus.emit('debt_updated', { audience: [42] } as never);

    expect(res.written).toHaveLength(before);
  });

  it('heartbeat идёт и останавливается после разрыва', async () => {
    const { req, res } = await openPersonalStream();

    jest.advanceTimersByTime(25_000);
    expect(stream(res)).toContain('event: heartbeat');

    emitRequest(req, 'close');
    const before = res.written.length;
    jest.advanceTimersByTime(50_000);

    expect(res.written).toHaveLength(before);
  });

  it('мёртвое соединение убирается на heartbeat', async () => {
    const { res } = await openPersonalStream();

    markStreamClosed(res, 'destroyed');
    jest.advanceTimersByTime(25_000);

    expect(getSSEConnectionCount().total).toBe(0);
  });

  it('после разрыва подписки на адресные события снимаются', async () => {
    const { req, res } = await openPersonalStream();
    emitRequest(req, 'close');
    const before = res.written.length;

    eventBus.emit('debt_updated', { audience: [1] } as never);

    expect(res.written).toHaveLength(before);
  });

  it('лимит считает и поток опроса, и персональный', async () => {
    // Три поток опроса + два персональных = пять открытых у одного человека.
    await openPollStream();
    await openPollStream();
    await openPollStream();
    await openPersonalStream();
    await openPersonalStream();

    const req = mockRequest({ user: USER });
    const res = mockResponse();
    await SSEController.streamMe(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.headers['retry-after']).toBe('30');
  });

  it('разные пользователи не мешают друг другу', async () => {
    await openPersonalStream({ id: 1 });
    const { res } = await openPersonalStream({ id: 2 });

    expect(res.statusCode).toBe(200);
    expect(getSSEConnectionCount().personal).toBe(2);
  });
});

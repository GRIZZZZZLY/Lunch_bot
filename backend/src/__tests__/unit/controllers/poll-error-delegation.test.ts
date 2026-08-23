/**
 * Что реально уходит клиенту, когда handler бросает, а не отвечает сам.
 *
 * Тесты контроллера соединяют handler с `errorHandler` напрямую — это быстро,
 * но доказывает только сам обработчик. Здесь проверяется механизм: handler'ы
 * голосований НЕ ловят исключения и полагаются на то, что Express 5 передаёт
 * отказ асинхронного обработчика в цепочку ошибок. Если это перестанет
 * работать (или проект вернётся на Express 4), запрос повиснет по таймауту, а
 * не отдаст 500 — и ни один тест с моками этого не увидит.
 *
 * Поэтому здесь настоящее приложение и настоящий HTTP-запрос.
 */
import express from 'express';
import request from 'supertest';

import { PollController } from '../../../api/controllers/poll.controller';
import { errorHandler } from '../../../api/middleware/error-handler';
import { PollService } from '../../../services/poll.service';
import { GroupService } from '../../../services/group.service';
import { asServiceMock } from '../../helpers/mocks';
import { PollQueryService } from '../../../services/poll-query.service';

jest.mock('../../../services/poll.service', () => ({
  PollService: { getPollById: jest.fn(), getPollGroupId: jest.fn() },
}));

jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: {
    getPollById: jest.fn(),
  },
}));


jest.mock('../../../services/vote.service', () => ({ VoteService: {} }));
jest.mock('../../../services/menu.service', () => ({ MenuService: {} }));
jest.mock('../../../services/poll-creation.service', () => ({
  createPollForGroup: jest.fn(),
  repeatPoll: jest.fn(),
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupMember: jest.fn(), isUserGroupAdmin: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const polls = asServiceMock(PollService);
const pollQuery = asServiceMock(PollQueryService);
const groups = asServiceMock(GroupService);

/** Приложение из одного маршрута: аутентификация подставлена, ошибки — как в проде. */
function appWithPollRoute(): express.Express {
  const app = express();

  app.use((req, _res, next) => {
    /* Настоящий `User` из Prisma здесь не нужен: handler читает только `id`.
       Приведение через unknown, а не `as User` с пятнадцатью полями-заглушками,
       которые ничего не проверяют. */
    (req as express.Request).user = { id: 1 } as never;
    next();
  });
  app.get('/api/polls/:id', PollController.getPollById);
  app.use(errorHandler);

  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  groups.isUserGroupMember.mockResolvedValue(true);
});

describe('ошибка из handler доходит до клиента через настоящий Express', () => {
  it('доменный отказ сохраняет свой статус и код', async () => {
    pollQuery.getPollById.mockResolvedValue(null);

    const res = await request(appWithPollRoute()).get('/api/polls/10');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      code: 'POLL_NOT_FOUND',
      // Legacy-зеркала: на них построен разбор ошибок на клиенте.
      success: false,
    });
    expect(typeof res.body.error).toBe('string');
  });

  it('отказ в доступе — 403 FORBIDDEN', async () => {
    pollQuery.getPollById.mockResolvedValue({
      id: 10,
      groupId: 100,
      startedAt: new Date(),
      endedAt: null,
      duration: 30,
      votes: [],
    });
    groups.isUserGroupMember.mockResolvedValue(false);

    const res = await request(appWithPollRoute()).get('/api/polls/10');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('непредвиденный сбой сервиса — 500 INTERNAL_ERROR, а не повисший запрос', async () => {
    pollQuery.getPollById.mockRejectedValue(new Error('db down'));

    const res = await request(appWithPollRoute()).get('/api/polls/10');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR', success: false });
  });

  it('плохой параметр остаётся 400 с кодом контракта', async () => {
    // Латиница, а не «нет»: supertest не принимает неэкранированный путь.
    const res = await request(appWithPollRoute()).get('/api/polls/abc');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_ID' });
    expect(pollQuery.getPollById).not.toHaveBeenCalled();
  });

  /* `errorHandler` распознаёт известные ошибки Prisma, и после перехода на
     проброс это касается и голосований: сбой БД получает осмысленный статус. */
  it('запись не найдена (P2025) — 404 NOT_FOUND', async () => {
    const prismaError = new Error('prisma failed');
    prismaError.name = 'PrismaClientKnownRequestError';
    (prismaError as Error & { code: string }).code = 'P2025';
    pollQuery.getPollById.mockRejectedValue(prismaError);

    const res = await request(appWithPollRoute()).get('/api/polls/10');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('ответ несёт traceId для сопоставления с логами', async () => {
    pollQuery.getPollById.mockRejectedValue(new Error('db down'));

    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request).user = { id: 1 } as never;
      (req as express.Request).requestId = 'req-42';
      next();
    });
    app.get('/api/polls/:id', PollController.getPollById);
    app.use(errorHandler);

    const res = await request(app).get('/api/polls/10');

    expect(res.body).toMatchObject({ traceId: 'req-42' });
  });
});

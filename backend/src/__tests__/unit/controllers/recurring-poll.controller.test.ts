/**
 * Расписание автоголосований. Читать его может любой участник группы (полезно
 * знать, когда стартует обед), менять — только админ группы. Отдельно
 * проверяется, что расписание нельзя тронуть, подставив id из чужой группы:
 * контроллер сверяет, что найденное по groupId расписание — то самое.
 */
import {
  getGroupSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  toggleSchedule,
  getExecutionHistory,
} from '../../../api/controllers/recurring-poll.controller';
import { RecurringPollService } from '../../../services/recurring-poll.service';
import { GroupService } from '../../../services/group.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';

jest.mock('../../../services/recurring-poll.service', () => ({
  RecurringPollService: {
    getByGroupId: jest.fn(),
    getById: jest.fn(),
    checkAdminAccess: jest.fn(),
    createRecurring: jest.fn(),
    updateRecurring: jest.fn(),
    deleteRecurring: jest.fn(),
    toggleEnabled: jest.fn(),
    getExecutionHistory: jest.fn(),
  },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupMember: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const service = asServiceMock(RecurringPollService);
const groupService = asServiceMock(GroupService);

const USER = { id: 1 };
const SCHEDULE = {
  id: 5,
  groupId: 100,
  daysOfWeek: [1, 2, 3],
  timeOfDay: '11:30',
  duration: 30,
  isEnabled: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  groupService.isUserGroupMember.mockResolvedValue(true);
  service.checkAdminAccess.mockResolvedValue(true);
  service.getByGroupId.mockResolvedValue(SCHEDULE);
  service.getById.mockResolvedValue(SCHEDULE);
});

describe('GET /api/recurring/:groupId', () => {
  it('участник группы читает расписание', async () => {
    const res = mockResponse();

    await getGroupSchedule(
      mockRequest({ user: USER, params: { groupId: '100' } }),
      res
    );

    expect(groupService.isUserGroupMember).toHaveBeenCalledWith(1, 100);
    expect(res.body).toMatchObject({ success: true, data: { id: 5 } });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await getGroupSchedule(mockRequest({ params: { groupId: '100' } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await getGroupSchedule(
      mockRequest({ user: USER, params: { groupId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await getGroupSchedule(
      mockRequest({ user: USER, params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(service.getByGroupId).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    service.getByGroupId.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await getGroupSchedule(
      mockRequest({ user: USER, params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/recurring', () => {
  const body = {
    groupId: 100,
    daysOfWeek: [1, 3, 5],
    timeOfDay: '11:30',
    duration: 30,
  };

  beforeEach(() => {
    service.createRecurring.mockResolvedValue(SCHEDULE);
  });

  it('админ создаёт расписание', async () => {
    const res = mockResponse();

    await createSchedule(mockRequest({ user: USER, body }), res);

    expect(service.createRecurring).toHaveBeenCalledWith({
      groupId: 100,
      daysOfWeek: [1, 3, 5],
      timeOfDay: '11:30',
      duration: 30,
      selectedMenuItemIds: null,
      createdBy: 1,
    });
    expect(res.statusCode).toBe(201);
  });

  it('список блюд сохраняется как есть', async () => {
    await createSchedule(
      mockRequest({ user: USER, body: { ...body, selectedMenuItemIds: [1, 2] } }),
      mockResponse()
    );

    expect(service.createRecurring).toHaveBeenCalledWith(
      expect.objectContaining({ selectedMenuItemIds: [1, 2] })
    );
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await createSchedule(mockRequest({ body }), res);

    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['groupId строкой', { groupId: '100' }],
    ['groupId ноль', { groupId: 0 }],
    ['пустой список дней', { daysOfWeek: [] }],
    ['день вне недели', { daysOfWeek: [7] }],
    ['больше семи дней', { daysOfWeek: [0, 1, 2, 3, 4, 5, 6, 0] }],
    ['время без двоеточия', { timeOfDay: '1130' }],
    ['час 24', { timeOfDay: '24:00' }],
    ['минута 60', { timeOfDay: '11:60' }],
    ['нулевая длительность', { duration: 0 }],
    ['длительность больше суток', { duration: 1441 }],
  ])('%s — 400 VALIDATION_ERROR', async (_label, override) => {
    const res = mockResponse();

    await createSchedule(
      mockRequest({ user: USER, body: { ...body, ...override } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(service.createRecurring).not.toHaveBeenCalled();
  });

  it('текст ошибки называет поле', async () => {
    const res = mockResponse();

    await createSchedule(
      mockRequest({ user: USER, body: { ...body, timeOfDay: '99:99' } }),
      res
    );

    expect(res.body).toMatchObject({
      error: expect.stringContaining('timeOfDay'),
    });
  });

  it('не админ группы — 403', async () => {
    service.checkAdminAccess.mockResolvedValue(false);
    const res = mockResponse();

    await createSchedule(mockRequest({ user: USER, body }), res);

    expect(res.statusCode).toBe(403);
    expect(service.createRecurring).not.toHaveBeenCalled();
  });

  it('расписание уже есть — 409', async () => {
    service.createRecurring.mockRejectedValue(
      new Error('Group already has a recurring poll')
    );
    const res = mockResponse();

    await createSchedule(mockRequest({ user: USER, body }), res);

    expect(res.statusCode).toBe(409);
  });

  it.each(['Invalid time format', 'Duration must be positive'])(
    'доменная ошибка «%s» — 400',
    async message => {
      service.createRecurring.mockRejectedValue(new Error(message));
      const res = mockResponse();

      await createSchedule(mockRequest({ user: USER, body }), res);

      expect(res.statusCode).toBe(400);
    }
  );

  it('прочая ошибка — 500', async () => {
    service.createRecurring.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await createSchedule(mockRequest({ user: USER, body }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('PATCH /api/recurring/:id', () => {
  beforeEach(() => {
    service.updateRecurring.mockResolvedValue({ ...SCHEDULE, duration: 45 });
  });

  it('админ меняет расписание', async () => {
    const res = mockResponse();

    await updateSchedule(
      mockRequest({
        user: USER,
        params: { id: '5' },
        body: { groupId: 100, duration: 45 },
      }),
      res
    );

    expect(service.updateRecurring).toHaveBeenCalledWith(5, {
      daysOfWeek: undefined,
      timeOfDay: undefined,
      duration: 45,
      selectedMenuItemIds: undefined,
      isEnabled: undefined,
    });
    expect(res.body).toMatchObject({ data: { duration: 45 } });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await updateSchedule(
      mockRequest({ params: { id: '5' }, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await updateSchedule(
      mockRequest({ user: USER, params: { id: 'нет' }, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('без groupId в теле — 400', async () => {
    const res = mockResponse();

    await updateSchedule(
      mockRequest({ user: USER, params: { id: '5' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('id из чужой группы не подойдёт — 404', async () => {
    // Расписание группы 100 имеет id 5; просим изменить id 99.
    const res = mockResponse();

    await updateSchedule(
      mockRequest({ user: USER, params: { id: '99' }, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(service.updateRecurring).not.toHaveBeenCalled();
  });

  it('у группы нет расписания — 404', async () => {
    service.getByGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await updateSchedule(
      mockRequest({ user: USER, params: { id: '5' }, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не админ — 403', async () => {
    service.checkAdminAccess.mockResolvedValue(false);
    const res = mockResponse();

    await updateSchedule(
      mockRequest({ user: USER, params: { id: '5' }, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('сервис не нашёл расписание — 404', async () => {
    service.updateRecurring.mockRejectedValue(new Error('Schedule not found'));
    const res = mockResponse();

    await updateSchedule(
      mockRequest({ user: USER, params: { id: '5' }, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('доменная ошибка формата — 400', async () => {
    service.updateRecurring.mockRejectedValue(new Error('Invalid time format'));
    const res = mockResponse();

    await updateSchedule(
      mockRequest({ user: USER, params: { id: '5' }, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('прочая ошибка — 500', async () => {
    service.updateRecurring.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await updateSchedule(
      mockRequest({ user: USER, params: { id: '5' }, body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('DELETE /api/recurring/:id', () => {
  it('админ удаляет расписание', async () => {
    service.deleteRecurring.mockResolvedValue(undefined);
    const res = mockResponse();

    await deleteSchedule(mockRequest({ user: USER, params: { id: '5' } }), res);

    expect(service.deleteRecurring).toHaveBeenCalledWith(5);
    expect(res.body).toMatchObject({ data: { deleted: true } });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await deleteSchedule(mockRequest({ params: { id: '5' } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await deleteSchedule(mockRequest({ user: USER, params: { id: 'нет' } }), res);

    expect(res.statusCode).toBe(400);
  });

  it('расписания нет — 404', async () => {
    service.getById.mockResolvedValue(null);
    const res = mockResponse();

    await deleteSchedule(mockRequest({ user: USER, params: { id: '5' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('не админ группы этого расписания — 403', async () => {
    service.checkAdminAccess.mockResolvedValue(false);
    const res = mockResponse();

    await deleteSchedule(mockRequest({ user: USER, params: { id: '5' } }), res);

    expect(res.statusCode).toBe(403);
    expect(service.deleteRecurring).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    service.deleteRecurring.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await deleteSchedule(mockRequest({ user: USER, params: { id: '5' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('PATCH /api/recurring/:id/toggle', () => {
  beforeEach(() => {
    service.toggleEnabled.mockResolvedValue({ ...SCHEDULE, isEnabled: false });
  });

  it('админ выключает расписание', async () => {
    const res = mockResponse();

    await toggleSchedule(
      mockRequest({ user: USER, params: { id: '5' }, body: { isEnabled: false } }),
      res
    );

    expect(service.toggleEnabled).toHaveBeenCalledWith(5, false);
    expect(res.body).toMatchObject({ data: { isEnabled: false } });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await toggleSchedule(
      mockRequest({ params: { id: '5' }, body: { isEnabled: true } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await toggleSchedule(
      mockRequest({
        user: USER,
        params: { id: 'нет' },
        body: { isEnabled: true },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it.each([
    ['строка', { isEnabled: 'true' }],
    ['отсутствует', {}],
  ])('isEnabled %s — 400', async (_label, body) => {
    const res = mockResponse();

    await toggleSchedule(
      mockRequest({ user: USER, params: { id: '5' }, body }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('расписания нет — 404', async () => {
    service.getById.mockResolvedValue(null);
    const res = mockResponse();

    await toggleSchedule(
      mockRequest({ user: USER, params: { id: '5' }, body: { isEnabled: true } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не админ — 403', async () => {
    service.checkAdminAccess.mockResolvedValue(false);
    const res = mockResponse();

    await toggleSchedule(
      mockRequest({ user: USER, params: { id: '5' }, body: { isEnabled: true } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(service.toggleEnabled).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    service.toggleEnabled.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await toggleSchedule(
      mockRequest({ user: USER, params: { id: '5' }, body: { isEnabled: true } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/recurring/:groupId/history', () => {
  beforeEach(() => {
    service.getExecutionHistory.mockResolvedValue([{ id: 1 }]);
  });

  it('админ смотрит историю запусков, по умолчанию 7 записей', async () => {
    const res = mockResponse();

    await getExecutionHistory(
      mockRequest({ user: USER, params: { groupId: '100' } }),
      res
    );

    expect(service.getExecutionHistory).toHaveBeenCalledWith(100, 7);
    expect(res.body).toMatchObject({ data: [{ id: 1 }] });
  });

  it('лимит берётся из запроса', async () => {
    await getExecutionHistory(
      mockRequest({
        user: USER,
        params: { groupId: '100' },
        query: { limit: '30' },
      }),
      mockResponse()
    );

    expect(service.getExecutionHistory).toHaveBeenCalledWith(100, 30);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await getExecutionHistory(mockRequest({ params: { groupId: '100' } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await getExecutionHistory(
      mockRequest({ user: USER, params: { groupId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('не админ — 403 (история доступна только админам)', async () => {
    service.checkAdminAccess.mockResolvedValue(false);
    const res = mockResponse();

    await getExecutionHistory(
      mockRequest({ user: USER, params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(service.getExecutionHistory).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    service.getExecutionHistory.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await getExecutionHistory(
      mockRequest({ user: USER, params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

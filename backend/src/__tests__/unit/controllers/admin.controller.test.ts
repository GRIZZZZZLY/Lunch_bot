/**
 * Админ-панель группы. И чтение статистики, и изменения (списать долг, снять
 * права, удалить старые голосования) требуют роли администратора в КОНКРЕТНОЙ
 * группе. Каждый мутирующий эндпоинт проверяется на то, что без прав группы
 * сервис не вызывается.
 *
 * Прежде чтение открывал ещё и глобальный флаг users.is_admin. Понятие удалено:
 * две системы прав на одном ресурсе расходились молча — интерфейс рисовал
 * кнопки по одному критерию, сервер отвечал по другому, и вместо ошибки человек
 * получал пустой список.
 */
import { AdminController } from '../../../api/controllers/admin.controller';
import { GroupService } from '../../../services/group.service';
import { PollService } from '../../../services/poll.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';
import { PollQueryService } from '../../../services/poll-query.service';

/* Сервисы создаются в конструкторе контроллера, поэтому мокаются как классы.
   Фабрика jest.mock поднимается выше объявлений — обращаться к заглушкам можно
   только через функцию (она hoisted целиком), иначе TDZ-ошибка. */
let adminStub: Record<string, jest.Mock>;
let reminderStub: Record<string, jest.Mock>;

function currentAdminStub(): Record<string, jest.Mock> {
  return adminStub;
}

function currentReminderStub(): Record<string, jest.Mock> {
  return reminderStub;
}

jest.mock('../../../services/admin.service', () => ({
  AdminService: jest.fn(() => currentAdminStub()),
}));

jest.mock('../../../services/reminder-settings.service', () => ({
  ReminderSettingsService: jest.fn(() => currentReminderStub()),
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupAdmin: jest.fn() },
}));

jest.mock('../../../services/poll.service', () => ({
  PollService: {
    checkQuorumAndComplete: jest.fn(),
  },
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

const GROUP_ADMIN = { id: 1, isAdmin: false };
const GLOBAL_ADMIN = { id: 9, isAdmin: true };

let controller: AdminController;

beforeEach(() => {
  jest.clearAllMocks();

  adminStub = {
    getAllUsers: jest.fn().mockResolvedValue([]),
    getUserStats: jest.fn().mockResolvedValue({}),
    toggleAdmin: jest.fn().mockResolvedValue({ id: 2 }),
    toggleActive: jest.fn().mockResolvedValue({ id: 2 }),
    toggleParticipatesInPolls: jest.fn().mockResolvedValue({ id: 2 }),
    getPollParticipants: jest.fn().mockResolvedValue([]),
    setPollParticipantStatus: jest.fn().mockResolvedValue({ status: 'EXCLUDED' }),
    getAllDebtors: jest.fn().mockResolvedValue([]),
    getDebtStats: jest.fn().mockResolvedValue({ total: 0 }),
    forgiveDebt: jest.fn().mockResolvedValue({ id: 5 }),
    remindAllDebtors: jest.fn().mockResolvedValue({ sent: 3 }),
    remindDebtor: jest.fn().mockResolvedValue(undefined),
    cleanupOldPolls: jest.fn().mockResolvedValue({ deleted: 4, skipped: 0 }),
    cleanupOldTransactions: jest.fn().mockResolvedValue({ deleted: 7 }),
    getCleanupStats: jest.fn().mockResolvedValue({ polls: 1 }),
    previewPollCleanup: jest.fn().mockResolvedValue({ polls: [] }),
    previewTransactionCleanup: jest.fn().mockResolvedValue({ transactions: [] }),
  };

  reminderStub = {
    getReminderSettings: jest.fn().mockResolvedValue({ enabled: true }),
    updateReminderSettings: jest.fn().mockResolvedValue({ enabled: false }),
    getAdminNotificationSettings: jest.fn().mockResolvedValue({ polls: true }),
    updateAdminNotificationSettings: jest.fn().mockResolvedValue({ polls: false }),
  };

  groupService.isUserGroupAdmin.mockResolvedValue(true);
  pollQuery.getPollGroupId.mockResolvedValue(100);
  pollService.checkQuorumAndComplete.mockResolvedValue(false);

  controller = new AdminController();
});

describe('определение группы', () => {
  it('groupId читается из query', async () => {
    await controller.getAllUsers(
      mockRequest({ user: GROUP_ADMIN, query: { groupId: '100' } }),
      mockResponse()
    );

    expect(adminStub.getAllUsers).toHaveBeenCalledWith(100);
  });

  it('groupId читается из params', async () => {
    await controller.getAllUsers(
      mockRequest({ user: GROUP_ADMIN, params: { groupId: '200' } }),
      mockResponse()
    );

    expect(adminStub.getAllUsers).toHaveBeenCalledWith(200);
  });

  it('groupId читается из тела запроса', async () => {
    await controller.getAllUsers(
      mockRequest({ user: GROUP_ADMIN, body: { groupId: '300' } }),
      mockResponse()
    );

    expect(adminStub.getAllUsers).toHaveBeenCalledWith(300);
  });

  it('без groupId — 400', async () => {
    const res = mockResponse();

    await controller.getAllUsers(mockRequest({ user: GROUP_ADMIN }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_GROUP_ID' });
  });

  it('нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await controller.getAllUsers(
      mockRequest({ user: GROUP_ADMIN, query: { groupId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getAllUsers(mockRequest({ query: { groupId: '100' } }), res);

    expect(res.statusCode).toBe(401);
    expect(adminStub.getAllUsers).not.toHaveBeenCalled();
  });
});

/* Прежде здесь проверялось, что глобальный флаг users.is_admin открывает
   чтение любой группы. Такого понятия больше нет: и чтение, и запись выводятся
   из одной роли в group_members, поэтому тесты «глобальный админ читает»
   удалены — соседние «не админ группы — 403» покрывают правило целиком. */
describe('чтение требует роль в группе', () => {
  it('getAllUsers: не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getAllUsers(
      mockRequest({ user: GROUP_ADMIN, query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(adminStub.getAllUsers).not.toHaveBeenCalled();
  });

  it('getAllUsers: ошибка сервиса — 500', async () => {
    adminStub.getAllUsers.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getAllUsers(
      mockRequest({ user: GROUP_ADMIN, query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/admin/users/:userId/stats', () => {
  it('отдаёт статистику пользователя в группе', async () => {
    adminStub.getUserStats.mockResolvedValue({ votes: 7 });
    const res = mockResponse();

    await controller.getUserStats(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
      }),
      res
    );

    expect(adminStub.getUserStats).toHaveBeenCalledWith(2, 100);
    expect(res.body).toMatchObject({ data: { votes: 7 } });
  });

  it('нечисловой userId — 400', async () => {
    const res = mockResponse();

    await controller.getUserStats(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: 'нет' },
        query: { groupId: '100' },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_USER_ID' });
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getUserStats(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
      }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    adminStub.getUserStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getUserStats(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
      }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('PUT /api/admin/users/:userId/admin', () => {
  it('назначает права и сообщает об этом', async () => {
    const res = mockResponse();

    await controller.toggleAdmin(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: { isAdmin: true },
      }),
      res
    );

    expect(adminStub.toggleAdmin).toHaveBeenCalledWith(2, true, 100);
    expect(res.body).toMatchObject({ message: 'Админ-права назначены' });
  });

  it('снимает права', async () => {
    const res = mockResponse();

    await controller.toggleAdmin(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: { isAdmin: false },
      }),
      res
    );

    expect(res.body).toMatchObject({ message: 'Админ-права сняты' });
  });

  it('нечисловой userId — 400', async () => {
    const res = mockResponse();

    await controller.toggleAdmin(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: 'нет' },
        body: { isAdmin: true },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it.each([
    ['строка', { isAdmin: 'true' }],
    ['отсутствует', {}],
  ])('isAdmin %s — 400 INVALID_BODY', async (_label, body) => {
    const res = mockResponse();

    await controller.toggleAdmin(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body,
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('глобальный админ БЕЗ прав в группе получает 403 — это мутация', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.toggleAdmin(
      mockRequest({
        user: GLOBAL_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: { isAdmin: true },
      }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(adminStub.toggleAdmin).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    adminStub.toggleAdmin.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.toggleAdmin(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: { isAdmin: true },
      }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('PUT /api/admin/users/:userId/active', () => {
  it('активирует пользователя', async () => {
    const res = mockResponse();

    await controller.toggleActive(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: { isActive: true },
      }),
      res
    );

    expect(adminStub.toggleActive).toHaveBeenCalledWith(2, true, 100);
    expect(res.body).toMatchObject({ message: 'Пользователь активирован' });
  });

  it('блокирует пользователя', async () => {
    const res = mockResponse();

    await controller.toggleActive(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: { isActive: false },
      }),
      res
    );

    expect(res.body).toMatchObject({ message: 'Пользователь заблокирован' });
  });

  it('нечисловой userId — 400', async () => {
    const res = mockResponse();

    await controller.toggleActive(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: 'нет' },
        body: { isActive: true },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('isActive не boolean — 400', async () => {
    const res = mockResponse();

    await controller.toggleActive(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: { isActive: 1 },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.toggleActive(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: { isActive: true },
      }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    adminStub.toggleActive.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.toggleActive(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: { isActive: true },
      }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('PUT /api/admin/users/:userId/participates-in-polls', () => {
  it('включает участие в голосованиях', async () => {
    const res = mockResponse();

    await controller.toggleParticipatesInPolls(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: { participates: true },
      }),
      res
    );

    expect(adminStub.toggleParticipatesInPolls).toHaveBeenCalledWith(2, true, 100);
    expect(res.body).toMatchObject({
      message: 'Пользователь участвует в голосованиях',
    });
  });

  it('исключает из голосований', async () => {
    const res = mockResponse();

    await controller.toggleParticipatesInPolls(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: { participates: false },
      }),
      res
    );

    expect(res.body).toMatchObject({
      message: 'Пользователь исключён из голосований',
    });
  });

  it('нечисловой userId — 400', async () => {
    const res = mockResponse();

    await controller.toggleParticipatesInPolls(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: 'нет' },
        body: { participates: true },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('participates не boolean — 400', async () => {
    const res = mockResponse();

    await controller.toggleParticipatesInPolls(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: {},
      }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.toggleParticipatesInPolls(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: { participates: true },
      }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    adminStub.toggleParticipatesInPolls.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.toggleParticipatesInPolls(
      mockRequest({
        user: GROUP_ADMIN,
        params: { userId: '2' },
        query: { groupId: '100' },
        body: { participates: true },
      }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/admin/polls/:pollId/participants', () => {
  it('группа берётся у голосования, а не из запроса', async () => {
    const res = mockResponse();

    await controller.getPollParticipants(
      mockRequest({ user: GROUP_ADMIN, params: { pollId: '12' } }),
      res
    );

    expect(pollQuery.getPollGroupId).toHaveBeenCalledWith(12);
    expect(groupService.isUserGroupAdmin).toHaveBeenCalledWith(1, 100);
    expect(adminStub.getPollParticipants).toHaveBeenCalledWith(12);
    expect(res.statusCode).toBe(200);
  });

  it('нечисловой pollId — 400', async () => {
    const res = mockResponse();

    await controller.getPollParticipants(
      mockRequest({ user: GROUP_ADMIN, params: { pollId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.getPollParticipants(
      mockRequest({ user: GROUP_ADMIN, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getPollParticipants(
      mockRequest({ user: GROUP_ADMIN, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    adminStub.getPollParticipants.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getPollParticipants(
      mockRequest({ user: GROUP_ADMIN, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('PUT /api/admin/polls/:pollId/participants/:userId', () => {
  const params = { pollId: '12', userId: '2' };

  it('исключает участника и проверяет кворум', async () => {
    pollService.checkQuorumAndComplete.mockResolvedValue(true);
    const res = mockResponse();

    await controller.setPollParticipantStatus(
      mockRequest({
        user: GROUP_ADMIN,
        params,
        body: { status: 'EXCLUDED', reason: 'в отпуске' },
      }),
      res
    );

    expect(adminStub.setPollParticipantStatus).toHaveBeenCalledWith(
      12,
      2,
      'EXCLUDED',
      'в отпуске'
    );
    // Исключение последнего непроголосовавшего закрывает голосование.
    expect(res.body).toMatchObject({ autoClosed: true });
  });

  /* Раньше нестроковая причина молча отбрасывалась и в сервис уходил
     `undefined`: администратор был уверен, что причину записали. Схема
     требует строку, поэтому теперь это 400 — вызывающий узнаёт, что его
     ввод не принят. */
  it('нестроковая причина — 400, а не молчаливое отбрасывание', async () => {
    const res = mockResponse();

    await controller.setPollParticipantStatus(
      mockRequest({
        user: GROUP_ADMIN,
        params,
        body: { status: 'EXPECTED', reason: 42 },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [expect.objectContaining({ field: 'reason' })],
    });
    expect(adminStub.setPollParticipantStatus).not.toHaveBeenCalled();
  });

  /* Код был общий (`VALIDATION_ERROR` с текстом «Invalid IDs») и не давал
     понять, какой из двух параметров неверен. Теперь код называет параметр,
     а поле приходит в `errors[]`. */
  it.each([
    ['нечисловой pollId', { pollId: 'нет', userId: '2' }, 'INVALID_POLL_ID', 'pollId'],
    ['нечисловой userId', { pollId: '12', userId: 'нет' }, 'INVALID_USER_ID', 'userId'],
  ])('%s — 400', async (_label, badParams, code, field) => {
    const res = mockResponse();

    await controller.setPollParticipantStatus(
      mockRequest({
        user: GROUP_ADMIN,
        params: badParams,
        body: { status: 'EXPECTED' },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      code,
      errors: [expect.objectContaining({ field })],
    });
  });

  it.each([
    ['неизвестный статус', { status: 'MAYBE' }],
    ['без статуса', {}],
  ])('%s — 400 INVALID_BODY', async (_label, body) => {
    const res = mockResponse();

    await controller.setPollParticipantStatus(
      mockRequest({ user: GROUP_ADMIN, params, body }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('голосования нет — 404', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.setPollParticipantStatus(
      mockRequest({ user: GROUP_ADMIN, params, body: { status: 'EXPECTED' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('глобальный админ без прав в группе — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.setPollParticipantStatus(
      mockRequest({ user: GLOBAL_ADMIN, params, body: { status: 'EXPECTED' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(adminStub.setPollParticipantStatus).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    adminStub.setPollParticipantStatus.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.setPollParticipantStatus(
      mockRequest({ user: GROUP_ADMIN, params, body: { status: 'EXPECTED' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('долги', () => {
  const query = { groupId: '100' };

  it('список должников: не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getAllDebtors(mockRequest({ user: GROUP_ADMIN, query }), res);

    expect(res.statusCode).toBe(403);
  });

  it('список должников: ошибка — 500', async () => {
    adminStub.getAllDebtors.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getAllDebtors(mockRequest({ user: GROUP_ADMIN, query }), res);

    expect(res.statusCode).toBe(500);
  });

  it('статистика долгов отдаётся', async () => {
    adminStub.getDebtStats.mockResolvedValue({ total: 1500 });
    const res = mockResponse();

    await controller.getDebtStats(mockRequest({ user: GROUP_ADMIN, query }), res);

    expect(res.body).toMatchObject({ data: { total: 1500 } });
  });

  it('статистика долгов: не админ — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getDebtStats(mockRequest({ user: GROUP_ADMIN, query }), res);

    expect(res.statusCode).toBe(403);
  });

  it('статистика долгов: ошибка — 500', async () => {
    adminStub.getDebtStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getDebtStats(mockRequest({ user: GROUP_ADMIN, query }), res);

    expect(res.statusCode).toBe(500);
  });

  it('списание долга передаёт id админа', async () => {
    const res = mockResponse();

    await controller.forgiveDebt(
      mockRequest({ user: GROUP_ADMIN, params: { debtId: '5' }, query }),
      res
    );

    expect(adminStub.forgiveDebt).toHaveBeenCalledWith(5, 1, 100);
    expect(res.body).toMatchObject({ message: 'Долг списан администратором' });
  });

  it('списание: нечисловой debtId — 400', async () => {
    const res = mockResponse();

    await controller.forgiveDebt(
      mockRequest({ user: GROUP_ADMIN, params: { debtId: 'нет' }, query }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_DEBT_ID' });
  });

  it('списание: глобальный админ без прав в группе — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.forgiveDebt(
      mockRequest({ user: GLOBAL_ADMIN, params: { debtId: '5' }, query }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(adminStub.forgiveDebt).not.toHaveBeenCalled();
  });

  it('списание: ошибка — 500', async () => {
    adminStub.forgiveDebt.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.forgiveDebt(
      mockRequest({ user: GROUP_ADMIN, params: { debtId: '5' }, query }),
      res
    );

    expect(res.statusCode).toBe(500);
  });

  it('массовое напоминание сообщает число отправленных', async () => {
    const res = mockResponse();

    await controller.remindAllDebtors(
      mockRequest({ user: GROUP_ADMIN, query }),
      res
    );

    expect(res.body).toMatchObject({ message: 'Отправлено 3 напоминаний' });
  });

  it('массовое напоминание: не админ — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.remindAllDebtors(
      mockRequest({ user: GROUP_ADMIN, query }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('массовое напоминание: ошибка — 500', async () => {
    adminStub.remindAllDebtors.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.remindAllDebtors(
      mockRequest({ user: GROUP_ADMIN, query }),
      res
    );

    expect(res.statusCode).toBe(500);
  });

  it('точечное напоминание', async () => {
    const res = mockResponse();

    await controller.remindDebtor(
      mockRequest({ user: GROUP_ADMIN, params: { debtId: '5' }, query }),
      res
    );

    expect(adminStub.remindDebtor).toHaveBeenCalledWith(5, 100);
    expect(res.body).toMatchObject({ message: 'Напоминание отправлено' });
  });

  it('точечное напоминание: нечисловой debtId — 400', async () => {
    const res = mockResponse();

    await controller.remindDebtor(
      mockRequest({ user: GROUP_ADMIN, params: { debtId: 'нет' }, query }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('точечное напоминание: не админ — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.remindDebtor(
      mockRequest({ user: GROUP_ADMIN, params: { debtId: '5' }, query }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('точечное напоминание: ошибка — 500', async () => {
    adminStub.remindDebtor.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.remindDebtor(
      mockRequest({ user: GROUP_ADMIN, params: { debtId: '5' }, query }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('очистка старых данных', () => {
  const query = { groupId: '100' };

  it('удаление голосований по умолчанию за 30 дней', async () => {
    const res = mockResponse();

    await controller.cleanupOldPolls(mockRequest({ user: GROUP_ADMIN, query }), res);

    expect(adminStub.cleanupOldPolls).toHaveBeenCalledWith(30, 100);
    expect(res.body).toMatchObject({
      message: 'Удалено 4 голосований старше 30 дней',
    });
  });

  it('пропущенные из-за долгов называются вслух', async () => {
    adminStub.cleanupOldPolls.mockResolvedValue({ deleted: 2, skipped: 3 });
    const res = mockResponse();

    await controller.cleanupOldPolls(
      mockRequest({ user: GROUP_ADMIN, query: { ...query, daysOld: '45' } }),
      res
    );

    expect(res.body).toMatchObject({
      message:
        'Удалено 2 голосований старше 45 дней, пропущено 3 — за ними ещё висят непогашенные долги',
    });
  });

  it('удаление голосований: не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.cleanupOldPolls(mockRequest({ user: GLOBAL_ADMIN, query }), res);

    expect(res.statusCode).toBe(403);
    expect(adminStub.cleanupOldPolls).not.toHaveBeenCalled();
  });

  it('удаление голосований: ошибка — 500', async () => {
    adminStub.cleanupOldPolls.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.cleanupOldPolls(mockRequest({ user: GROUP_ADMIN, query }), res);

    expect(res.statusCode).toBe(500);
  });

  it('удаление транзакций по умолчанию за 90 дней', async () => {
    const res = mockResponse();

    await controller.cleanupOldTransactions(
      mockRequest({ user: GROUP_ADMIN, query }),
      res
    );

    expect(adminStub.cleanupOldTransactions).toHaveBeenCalledWith(90, 100);
    expect(res.body).toMatchObject({
      message: 'Удалено 7 транзакций старше 90 дней',
    });
  });

  it('удаление транзакций: не админ — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.cleanupOldTransactions(
      mockRequest({ user: GROUP_ADMIN, query }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('удаление транзакций: ошибка — 500', async () => {
    adminStub.cleanupOldTransactions.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.cleanupOldTransactions(
      mockRequest({ user: GROUP_ADMIN, query }),
      res
    );

    expect(res.statusCode).toBe(500);
  });

  it('статистика очистки: не админ — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getCleanupStats(mockRequest({ user: GROUP_ADMIN, query }), res);

    expect(res.statusCode).toBe(403);
  });

  it('статистика очистки: ошибка — 500', async () => {
    adminStub.getCleanupStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getCleanupStats(mockRequest({ user: GROUP_ADMIN, query }), res);

    expect(res.statusCode).toBe(500);
  });

  it('предпросмотр по умолчанию считает голосования за 30 дней', async () => {
    const res = mockResponse();

    await controller.previewCleanup(mockRequest({ user: GROUP_ADMIN, query }), res);

    expect(adminStub.previewPollCleanup).toHaveBeenCalledWith(30, 100);
    expect(adminStub.previewTransactionCleanup).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('предпросмотр транзакций за произвольный срок', async () => {
    await controller.previewCleanup(
      mockRequest({
        user: GROUP_ADMIN,
        query: { ...query, kind: 'transactions', daysOld: '45' },
      }),
      mockResponse()
    );

    expect(adminStub.previewTransactionCleanup).toHaveBeenCalledWith(45, 100);
    expect(adminStub.previewPollCleanup).not.toHaveBeenCalled();
  });

  /* `kind` раньше сваливался в 'polls' на любом непонятном значении, то есть
     `?kind=transaction` (без s) показывал предпросмотр не того, что админ
     собирался удалять. Теперь — 400. */
  it('неизвестный kind — 400, а не тихая подстановка polls', async () => {
    const res = mockResponse();

    await controller.previewCleanup(
      mockRequest({ user: GROUP_ADMIN, query: { ...query, kind: 'что-то' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(adminStub.previewPollCleanup).not.toHaveBeenCalled();
  });

  it('предпросмотр: не админ — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.previewCleanup(mockRequest({ user: GROUP_ADMIN, query }), res);

    expect(res.statusCode).toBe(403);
  });

  it('предпросмотр: ошибка — 500', async () => {
    adminStub.previewPollCleanup.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.previewCleanup(mockRequest({ user: GROUP_ADMIN, query }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('настройки напоминаний', () => {
  const params = { groupId: '100' };

  it('чтение передаёт id запрашивающего (для персональных настроек)', async () => {
    const res = mockResponse();

    await controller.getReminderSettings(
      mockRequest({ user: GROUP_ADMIN, params }),
      res
    );

    expect(reminderStub.getReminderSettings).toHaveBeenCalledWith(100, 1);
    expect(res.body).toMatchObject({ data: { enabled: true } });
  });

  it('чтение: нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await controller.getReminderSettings(
      mockRequest({ user: GROUP_ADMIN, params: { groupId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('чтение: не админ — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getReminderSettings(
      mockRequest({ user: GROUP_ADMIN, params }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('чтение: ошибка — 500', async () => {
    reminderStub.getReminderSettings.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getReminderSettings(
      mockRequest({ user: GROUP_ADMIN, params }),
      res
    );

    expect(res.statusCode).toBe(500);
  });

  const REMINDER_SETTINGS = {
    isEnabled: false,
    intervalDays: 3,
    messageTemplate: 'Напоминаю про долг',
    minDebtAge: 1,
    maxReminders: 5,
  };

  it('запись передаёт тело и id админа', async () => {
    const res = mockResponse();

    await controller.updateReminderSettings(
      mockRequest({ user: GROUP_ADMIN, params, body: { ...REMINDER_SETTINGS } }),
      res
    );

    expect(reminderStub.updateReminderSettings).toHaveBeenCalledWith(
      100,
      REMINDER_SETTINGS,
      1
    );
    expect(res.body).toMatchObject({ message: 'Настройки напоминаний обновлены' });
  });

  /* Ключевая проверка этой пары эндпоинтов: тело уходит в Prisma целиком
     (`update: data`). Незаявленное поле раньше означало исключение Prisma и
     500, а поле, совпавшее с колонкой (`groupId` есть в типе на клиенте —
     `Partial<ReminderSettings>`), переписало бы настройки ЧУЖОЙ группы.
     Поэтому здесь единственная в проекте строгая схема тела. */
  it('лишнее поле в теле — 400, а не запись в Prisma', async () => {
    const res = mockResponse();

    await controller.updateReminderSettings(
      mockRequest({
        user: GROUP_ADMIN,
        params,
        body: { ...REMINDER_SETTINGS, groupId: 999 },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(reminderStub.updateReminderSettings).not.toHaveBeenCalled();
  });

  /* Частичное тело — законный ввод: `strict` запрещает ЛИШНИЕ поля, но не
     делает объявленные обязательными. Смешать эти два свойства значит сломать
     рабочий экран. */
  it('частичное тело сохраняется', async () => {
    const res = mockResponse();

    await controller.updateReminderSettings(
      mockRequest({ user: GROUP_ADMIN, params, body: { intervalDays: 7 } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(reminderStub.updateReminderSettings).toHaveBeenCalledWith(
      100,
      { intervalDays: 7 },
      1
    );
  });

  it('запись: нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await controller.updateReminderSettings(
      mockRequest({ user: GROUP_ADMIN, params: { groupId: 'нет' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('запись: глобальный админ без прав в группе — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.updateReminderSettings(
      mockRequest({ user: GLOBAL_ADMIN, params, body: { ...REMINDER_SETTINGS } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(reminderStub.updateReminderSettings).not.toHaveBeenCalled();
  });

  it('запись: ошибка — 500', async () => {
    reminderStub.updateReminderSettings.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.updateReminderSettings(
      mockRequest({ user: GROUP_ADMIN, params, body: { ...REMINDER_SETTINGS } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('настройки уведомлений админов', () => {
  const params = { groupId: '100' };

  it('чтение отдаёт настройки', async () => {
    const res = mockResponse();

    await controller.getAdminNotificationSettings(
      mockRequest({ user: GROUP_ADMIN, params }),
      res
    );

    expect(reminderStub.getAdminNotificationSettings).toHaveBeenCalledWith(100);
    expect(res.body).toMatchObject({ data: { polls: true } });
  });

  it('чтение: нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await controller.getAdminNotificationSettings(
      mockRequest({ user: GROUP_ADMIN, params: { groupId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('чтение: не админ — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getAdminNotificationSettings(
      mockRequest({ user: GROUP_ADMIN, params }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('чтение: ошибка — 500', async () => {
    reminderStub.getAdminNotificationSettings.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getAdminNotificationSettings(
      mockRequest({ user: GROUP_ADMIN, params }),
      res
    );

    expect(res.statusCode).toBe(500);
  });

  const NOTIFICATION_SETTINGS = {
    notifyOnNewUser: true,
    notifyOnNewPoll: false,
    notifyOnPollEnd: false,
    notifyOnDebtPaid: false,
  };

  it('запись передаёт тело', async () => {
    const res = mockResponse();

    await controller.updateAdminNotificationSettings(
      mockRequest({ user: GROUP_ADMIN, params, body: { ...NOTIFICATION_SETTINGS } }),
      res
    );

    expect(reminderStub.updateAdminNotificationSettings).toHaveBeenCalledWith(
      100,
      NOTIFICATION_SETTINGS
    );
    expect(res.body).toMatchObject({ message: 'Настройки уведомлений обновлены' });
  });

  /**
   * Тумблеры уведомлений отправляют ПО ОДНОМУ полю — так написан
   * `ReminderSettingsCard.tsx`. Первая версия схемы требовала все четыре и
   * выключила все четыре переключателя; поймало это ревью, а не тест. Теперь
   * закреплено: частичное тело проходит.
   */
  it.each([
    'notifyOnNewUser',
    'notifyOnNewPoll',
    'notifyOnPollEnd',
    'notifyOnDebtPaid',
  ])('одно поле %s сохраняется без остальных', async field => {
    const res = mockResponse();

    await controller.updateAdminNotificationSettings(
      mockRequest({ user: GROUP_ADMIN, params, body: { [field]: true } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(reminderStub.updateAdminNotificationSettings).toHaveBeenCalledWith(100, {
      [field]: true,
    });
  });

  /* Тело так же уходит в Prisma целиком — см. парную проверку у настроек
     напоминаний. Поле `polls` из прежнего теста колонкой не является: до схемы
     такой запрос давал 500. */
  it('поле не из схемы — 400, а не 500 из Prisma', async () => {
    const res = mockResponse();

    await controller.updateAdminNotificationSettings(
      mockRequest({ user: GROUP_ADMIN, params, body: { polls: false } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(reminderStub.updateAdminNotificationSettings).not.toHaveBeenCalled();
  });

  it('запись: нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await controller.updateAdminNotificationSettings(
      mockRequest({ user: GROUP_ADMIN, params: { groupId: 'нет' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('запись: не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.updateAdminNotificationSettings(
      mockRequest({ user: GROUP_ADMIN, params, body: {} }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('запись: ошибка — 500', async () => {
    reminderStub.updateAdminNotificationSettings.mockRejectedValue(
      new Error('boom')
    );
    const res = mockResponse();

    await controller.updateAdminNotificationSettings(
      mockRequest({ user: GROUP_ADMIN, params, body: { ...NOTIFICATION_SETTINGS } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

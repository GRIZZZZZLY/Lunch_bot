/**
 * Админ-сервис группы. Права, деньги, напоминания и очистку проверяет
 * integration/api/admin.redis.test.ts на настоящей БД; здесь остались крайние
 * случаи агрегаций, до которых эндпоинтом дотянуться неудобно.
 */
import { AdminService } from '../../../services/admin.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/group.service', () => ({
  GroupService: {
    setMemberRole: jest.fn(),
    addMemberToGroup: jest.fn(),
    removeMemberFromGroup: jest.fn(),
  },
}));

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

let service: AdminService;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  service = new AdminService();
});

describe('getAllUsers', () => {
  it('участник без голосов не получает даты активности', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { userId: 1, role: 'MEMBER', isActive: false, participatesInPolls: false },
    ] as never);
    asMock(prismaMock.user.findMany).mockResolvedValue([
      {
        id: 1,
        _count: { votes: 0, debts: 0, credits: 0 },
        votes: [],
        debts: [],
        credits: [],
      },
    ] as never);

    const users = await service.getAllUsers(100);

    expect(users[0]).toMatchObject({
      isAdmin: false,
      isActive: false,
      participatesInPolls: false,
      lastActivity: null,
    });
  });
});

describe('getUserStats', () => {
  it('без фамилии имя не обрастает пробелом', async () => {
    asMock(prismaMock.groupMember.findFirst).mockResolvedValue({ id: 1 });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      firstName: 'Игорь',
      lastName: null,
      _count: { votes: 0, debts: 0, credits: 0, createdPolls: 0 },
      debts: [],
      credits: [],
    } as never);

    const stats = await service.getUserStats(1, 100);

    expect(stats.userName).toBe('Игорь');
  });
});

describe('должники', () => {
  it('без долгов статистика нулевая, без деления на ноль', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);

    await expect(service.getDebtStats(100)).resolves.toEqual({
      totalDebtors: 0,
      totalDebtAmount: 0,
      avgDebtPerUser: 0,
      oldestDebtAge: 0,
    });
  });
});

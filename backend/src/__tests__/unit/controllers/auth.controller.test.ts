/**
 * Вход в Mini App с deep-link: сбой при добавлении членства по start_param
 * не должен ломать сам вход. Остальное поведение входа проверяют
 * интеграционные тесты эндпоинта.
 */
import { AuthController } from '../../../api/controllers/auth.controller';
import { UserService } from '../../../services/user.service';
import { GroupService } from '../../../services/group.service';
import { validateTelegramInitData } from '../../../utils/telegram-auth';
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

const initDataWith = (startParam: string): string =>
  `user=%7B%22id%22%3A555%7D&auth_date=1&hash=abc&start_param=${startParam}`;

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  envBackup = { ...process.env };
  process.env.NODE_ENV = 'test';
  delete process.env.SKIP_TELEGRAM_VALIDATION;

  userService.upsertUser.mockResolvedValue(STORED_USER);
  validateInitData.mockReturnValue({ id: 555, username: 'igor', first_name: 'Игорь' });
  groupService.getGroupById.mockResolvedValue({ id: 100, telegramId: BigInt(-1001) });
  groupService.addMemberFromStartParam.mockResolvedValue(true);
});

afterEach(() => {
  process.env = envBackup;
});

describe('POST /api/auth/validate — членство по deep-link', () => {
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
    expect(res.body).toMatchObject({ success: true });
  });
});

/**
 * Профиль и реквизиты. Два места, где ошибка видна другим людям:
 *
 * 1. Реквизит для перевода показывается ДРУГИМ участникам кнопкой «перевести».
 *    Схема ссылки проверяется на сервере, иначе `javascript:`-адрес из чужого
 *    профиля исполнится под пальцем того, кто платит.
 * 2. Аватарки: список id приходит от клиента, и без проверки общей группы
 *    можно было бы вытащить фото любого пользователя по перебору id.
 */
import { UserController } from '../../../api/controllers/user.controller';
import { UserService } from '../../../services/user.service';
import { GroupService } from '../../../services/group.service';
import { AvatarService } from '../../../services/avatar.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';

jest.mock('../../../services/user.service', () => ({
  UserService: {
    getPaymentInfo: jest.fn(),
    updatePaymentInfo: jest.fn(),
    getUserById: jest.fn(),
    getUsersByIds: jest.fn(),
  },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: {
    getGroupsForUser: jest.fn(),
    getUsersSharingActiveGroup: jest.fn(),
  },
}));

jest.mock('../../../services/avatar.service', () => ({
  AvatarService: {
    getUserAvatar: jest.fn(),
    getUserAvatarsBatch: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const userService = asServiceMock(UserService);
const groupService = asServiceMock(GroupService);
const avatarService = asServiceMock(AvatarService);

const USER = {
  id: 1,
  telegramId: BigInt(555),
  username: 'igor',
  firstName: 'Игорь',
  lastName: null,
  photoUrl: null,
  isAdmin: false,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const ADMIN = { ...USER, id: 9, isAdmin: true };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/user/me', () => {
  it('отдаёт профиль с telegramId строкой', async () => {
    const res = mockResponse();

    await UserController.getCurrentUser(mockRequest({ user: USER }), res);

    expect(res.body).toMatchObject({
      success: true,
      data: { id: 1, telegramId: '555', firstName: 'Игорь' },
    });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await UserController.getCurrentUser(mockRequest(), res);

    expect(res.statusCode).toBe(401);
  });

  it('внутренний сбой — 500', async () => {
    const res = mockResponse();
    (res.json as jest.Mock).mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await UserController.getCurrentUser(mockRequest({ user: USER }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/user/payment-info', () => {
  it('отдаёт реквизиты владельца', async () => {
    userService.getPaymentInfo.mockResolvedValue({
      paymentPhone: '+79990001122',
      paymentCard: 'https://pay.example/igor',
      paymentDetails: 'СБП',
    });
    const res = mockResponse();

    await UserController.getPaymentInfo(mockRequest({ user: USER }), res);

    expect(userService.getPaymentInfo).toHaveBeenCalledWith(1);
    expect(res.body).toMatchObject({ data: { paymentDetails: 'СБП' } });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await UserController.getPaymentInfo(mockRequest(), res);

    expect(res.statusCode).toBe(401);
  });

  it('ошибка сервиса — 500', async () => {
    userService.getPaymentInfo.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await UserController.getPaymentInfo(mockRequest({ user: USER }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('PUT /api/user/payment-info', () => {
  beforeEach(() => {
    userService.updatePaymentInfo.mockResolvedValue({
      paymentCard: 'https://pay.example/igor',
      paymentPhone: '+79990001122',
      paymentDetails: 'СБП',
    });
  });

  it('сохраняет корректные реквизиты', async () => {
    const res = mockResponse();

    await UserController.updatePaymentInfo(
      mockRequest({
        user: USER,
        body: {
          paymentPhone: '+7 999 000-11-22',
          paymentCard: 'https://pay.example/igor',
          paymentDetails: 'СБП',
        },
      }),
      res
    );

    expect(userService.updatePaymentInfo).toHaveBeenCalledWith(1, {
      paymentPhone: '+7 999 000-11-22',
      paymentCard: 'https://pay.example/igor',
      paymentDetails: 'СБП',
    });
    expect(res.body).toMatchObject({
      message: 'Payment info updated successfully',
    });
  });

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,<script>1</script>'],
    ['без схемы', 'pay.example/igor'],
    ['мусор', 'не ссылка'],
  ])('ссылка %s отклоняется — 400', async (_label, paymentCard) => {
    const res = mockResponse();

    await UserController.updatePaymentInfo(
      mockRequest({ user: USER, body: { paymentCard } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_PAYMENT_INFO' });
    expect(userService.updatePaymentInfo).not.toHaveBeenCalled();
  });

  it('http-ссылка допускается (локальные платёжные шлюзы)', async () => {
    const res = mockResponse();

    await UserController.updatePaymentInfo(
      mockRequest({ user: USER, body: { paymentCard: 'http://pay.local/igor' } }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('слишком длинная ссылка — 400', async () => {
    const res = mockResponse();

    await UserController.updatePaymentInfo(
      mockRequest({
        user: USER,
        body: { paymentCard: `https://pay.example/${'x'.repeat(500)}` },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it.each([
    ['слишком короткий номер', '+7999'],
    ['слишком длинный номер', '1234567890123456'],
  ])('телефон: %s — 400', async (_label, paymentPhone) => {
    const res = mockResponse();

    await UserController.updatePaymentInfo(
      mockRequest({ user: USER, body: { paymentPhone } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('пустая строка доходит до сервиса как очистка поля', async () => {
    await UserController.updatePaymentInfo(
      mockRequest({
        user: USER,
        body: { paymentCard: '', paymentPhone: '', paymentDetails: '' },
      }),
      mockResponse()
    );

    expect(userService.updatePaymentInfo).toHaveBeenCalledWith(1, {
      paymentCard: '',
      paymentPhone: '',
      paymentDetails: '',
    });
  });

  it('null от клиента тоже означает очистку', async () => {
    await UserController.updatePaymentInfo(
      mockRequest({
        user: USER,
        body: { paymentCard: null, paymentPhone: null, paymentDetails: null },
      }),
      mockResponse()
    );

    expect(userService.updatePaymentInfo).toHaveBeenCalledWith(1, {
      paymentCard: '',
      paymentPhone: '',
      paymentDetails: '',
    });
  });

  it('отсутствующий ключ оставляет поле нетронутым', async () => {
    await UserController.updatePaymentInfo(
      mockRequest({ user: USER, body: { paymentDetails: 'СБП' } }),
      mockResponse()
    );

    expect(userService.updatePaymentInfo).toHaveBeenCalledWith(1, {
      paymentCard: undefined,
      paymentPhone: undefined,
      paymentDetails: 'СБП',
    });
  });

  it('слишком длинное описание — 400', async () => {
    const res = mockResponse();

    await UserController.updatePaymentInfo(
      mockRequest({ user: USER, body: { paymentDetails: 'x'.repeat(201) } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await UserController.updatePaymentInfo(mockRequest({ body: {} }), res);

    expect(res.statusCode).toBe(401);
  });

  it('пользователя нет — 404', async () => {
    userService.updatePaymentInfo.mockRejectedValue(new Error('User not found'));
    const res = mockResponse();

    await UserController.updatePaymentInfo(
      mockRequest({ user: USER, body: { paymentDetails: 'СБП' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('ошибка сервиса — 500', async () => {
    userService.updatePaymentInfo.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await UserController.updatePaymentInfo(
      mockRequest({ user: USER, body: { paymentDetails: 'СБП' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/user/groups', () => {
  it('отдаёт только активные членства с ролью', async () => {
    groupService.getGroupsForUser.mockResolvedValue([
      {
        role: 'ADMIN',
        group: {
          id: 100,
          title: 'Команда',
          telegramId: BigInt(-1001),
          type: 'supergroup',
          isActive: true,
        },
      },
    ]);
    const res = mockResponse();

    await UserController.getUserGroups(mockRequest({ user: USER }), res);

    // Второй аргумент true — только активные членства.
    expect(groupService.getGroupsForUser).toHaveBeenCalledWith(1, true);
    expect(res.body).toMatchObject({
      total: 1,
      data: [{ id: 100, telegramId: '-1001', role: 'ADMIN' }],
    });
  });

  it('глобальный админ тоже видит только свои группы', async () => {
    groupService.getGroupsForUser.mockResolvedValue([]);
    const res = mockResponse();

    await UserController.getUserGroups(mockRequest({ user: ADMIN }), res);

    expect(groupService.getGroupsForUser).toHaveBeenCalledWith(9, true);
    expect(res.body).toMatchObject({ total: 0, data: [] });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await UserController.getUserGroups(mockRequest(), res);

    expect(res.statusCode).toBe(401);
  });

  it('ошибка сервиса — 500', async () => {
    groupService.getGroupsForUser.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await UserController.getUserGroups(mockRequest({ user: USER }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/user/:userId/avatar', () => {
  beforeEach(() => {
    groupService.getUsersSharingActiveGroup.mockResolvedValue(new Set([2]));
    userService.getUserById.mockResolvedValue({ id: 2, telegramId: BigInt(777) });
    avatarService.getUserAvatar.mockResolvedValue('https://cdn/avatar.jpg');
  });

  it('отдаёт аватар участника общей группы', async () => {
    const res = mockResponse();

    await UserController.getUserAvatar(
      mockRequest({ user: USER, params: { userId: '2' } }),
      res
    );

    expect(avatarService.getUserAvatar).toHaveBeenCalledWith(BigInt(777));
    expect(res.body).toMatchObject({
      data: { userId: 2, avatarUrl: 'https://cdn/avatar.jpg' },
    });
  });

  it('чужой пользователь маскируется под 404, а не 403', async () => {
    groupService.getUsersSharingActiveGroup.mockResolvedValue(new Set());
    const res = mockResponse();

    await UserController.getUserAvatar(
      mockRequest({ user: USER, params: { userId: '2' } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(userService.getUserById).not.toHaveBeenCalled();
  });

  it('глобальный админ проверку общей группы не проходит', async () => {
    const res = mockResponse();

    await UserController.getUserAvatar(
      mockRequest({ user: ADMIN, params: { userId: '2' } }),
      res
    );

    expect(groupService.getUsersSharingActiveGroup).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it.each([
    ['без параметра', {}],
    ['нечисловой', { userId: 'нет' }],
    ['ноль', { userId: '0' }],
    ['отрицательный', { userId: '-3' }],
  ])('%s — 400', async (_label, params) => {
    const res = mockResponse();

    await UserController.getUserAvatar(mockRequest({ user: USER, params }), res);

    expect(res.statusCode).toBe(400);
  });

  it('пользователя нет в базе — 404', async () => {
    userService.getUserById.mockResolvedValue(null);
    const res = mockResponse();

    await UserController.getUserAvatar(
      mockRequest({ user: USER, params: { userId: '2' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('ошибка сервиса аватарок — 500', async () => {
    avatarService.getUserAvatar.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await UserController.getUserAvatar(
      mockRequest({ user: USER, params: { userId: '2' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/user/avatars/batch', () => {
  beforeEach(() => {
    groupService.getUsersSharingActiveGroup.mockResolvedValue(new Set([2, 3]));
    userService.getUsersByIds.mockResolvedValue([
      { id: 2, telegramId: BigInt(777) },
      { id: 3, telegramId: BigInt(888) },
    ]);
    avatarService.getUserAvatarsBatch.mockResolvedValue(
      new Map([['777', 'https://cdn/2.jpg']])
    );
  });

  it('отдаёт аватарки в порядке запроса, без аватара — null', async () => {
    const res = mockResponse();

    await UserController.getUserAvatarsBatch(
      mockRequest({ user: USER, body: { userIds: [2, 3] } }),
      res
    );

    expect(res.body).toMatchObject({
      total: 2,
      data: [
        { userId: 2, avatarUrl: 'https://cdn/2.jpg' },
        { userId: 3, avatarUrl: null },
      ],
    });
  });

  it('чужие id отбрасываются до запроса в базу', async () => {
    groupService.getUsersSharingActiveGroup.mockResolvedValue(new Set([2]));

    await UserController.getUserAvatarsBatch(
      mockRequest({ user: USER, body: { userIds: [2, 3] } }),
      mockResponse()
    );

    expect(userService.getUsersByIds).toHaveBeenCalledWith([2]);
  });

  it('мусорные id отфильтровываются', async () => {
    await UserController.getUserAvatarsBatch(
      mockRequest({ user: USER, body: { userIds: [2, 'нет', -1, 0, 3] } }),
      mockResponse()
    );

    expect(groupService.getUsersSharingActiveGroup).toHaveBeenCalledWith(1, [2, 3]);
  });

  it('глобальный админ получает аватарки без проверки общей группы', async () => {
    const res = mockResponse();

    await UserController.getUserAvatarsBatch(
      mockRequest({ user: ADMIN, body: { userIds: [2, 3] } }),
      res
    );

    expect(groupService.getUsersSharingActiveGroup).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it.each([
    ['не массив', { userIds: 2 }],
    ['пустой массив', { userIds: [] }],
    ['без поля', {}],
  ])('%s — 400 INVALID_PARAMS', async (_label, body) => {
    const res = mockResponse();

    await UserController.getUserAvatarsBatch(
      mockRequest({ user: USER, body }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_PARAMS' });
  });

  it('больше 100 id — 400 TOO_MANY_IDS', async () => {
    const res = mockResponse();

    await UserController.getUserAvatarsBatch(
      mockRequest({
        user: USER,
        body: { userIds: Array.from({ length: 101 }, (_, i) => i + 1) },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'TOO_MANY_IDS' });
    expect(userService.getUsersByIds).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    avatarService.getUserAvatarsBatch.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await UserController.getUserAvatarsBatch(
      mockRequest({ user: USER, body: { userIds: [2] } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

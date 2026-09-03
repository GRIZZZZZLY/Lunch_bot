/**
 * Личный список товаров. Главное свойство — владение: чужой пресет отвечает
 * 404, и контроллер не должен давать способа это обойти.
 */
import { ItemPresetController } from '../../../api/controllers/item-preset.controller';
import { UserItemPresetService } from '../../../services/user-item-preset.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';

jest.mock('../../../services/user-item-preset.service', () => {
  class UserItemPresetError extends Error {
    constructor(
      public readonly code: string,
      message: string
    ) {
      super(message);
      this.name = 'UserItemPresetError';
    }
  }

  return {
    UserItemPresetError,
    UserItemPresetService: {
      listForUser: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    },
  };
});

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  UserItemPresetError,
}: { UserItemPresetError: new (code: string, message: string) => Error } =
  jest.requireMock('../../../services/user-item-preset.service');

const service = asServiceMock(UserItemPresetService);
const controller = new ItemPresetController();
const USER = { id: 7 } as never;

beforeEach(() => jest.clearAllMocks());

describe('GET /api/user/item-presets', () => {
  it('отдаёт список текущего пользователя', async () => {
    service.listForUser.mockResolvedValue([{ id: 1, name: 'Молоко' }]);
    const res = mockResponse();

    await controller.list(mockRequest({ user: USER, query: {} }), res);

    expect(service.listForUser).toHaveBeenCalledWith(7, null);
    expect(res.body).toMatchObject({ success: true, data: [{ id: 1, name: 'Молоко' }] });
  });

  it('storeId из query доходит до сервиса числом', async () => {
    service.listForUser.mockResolvedValue([]);
    const res = mockResponse();

    await controller.list(mockRequest({ user: USER, query: { storeId: '5' } }), res);

    expect(service.listForUser).toHaveBeenCalledWith(7, 5);
  });

  it('пустой storeId не превращается в ноль', async () => {
    service.listForUser.mockResolvedValue([]);
    const res = mockResponse();

    await controller.list(mockRequest({ user: USER, query: { storeId: '' } }), res);

    expect(service.listForUser).toHaveBeenCalledWith(7, null);
    expect(res.statusCode).not.toBe(400);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.list(mockRequest({ query: {} }), res);

    expect(res.statusCode).toBe(401);
    expect(service.listForUser).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/user/item-presets/:id', () => {
  it('закрепляет пресет', async () => {
    service.update.mockResolvedValue({ id: 1, pinned: true });
    const res = mockResponse();

    await controller.update(
      mockRequest({ user: USER, params: { id: '1' }, body: { pinned: true } }),
      res
    );

    expect(service.update).toHaveBeenCalledWith(1, 7, {
      name: undefined,
      quantity: undefined,
      notes: undefined,
      pinned: true,
    });
    expect(res.body).toMatchObject({ success: true, data: { pinned: true } });
  });

  it('чужой пресет — 404', async () => {
    service.update.mockRejectedValue(
      new UserItemPresetError('NOT_FOUND', 'Preset not found')
    );
    const res = mockResponse();

    await controller.update(
      mockRequest({ user: USER, params: { id: '1' }, body: { pinned: true } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it.each([
    ['количество нулём', { quantity: 0 }],
    ['количество больше 99', { quantity: 100 }],
    ['имя длиннее 200', { name: 'м'.repeat(201) }],
    ['заметка длиннее 500', { notes: 'з'.repeat(501) }],
    ['pinned строкой', { pinned: 'yes' }],
  ])('%s — 400 до сервиса', async (_label, body) => {
    const res = mockResponse();

    await controller.update(
      mockRequest({ user: USER, params: { id: '1' }, body }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(service.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/user/item-presets/:id', () => {
  it('удаляет свой пресет', async () => {
    service.remove.mockResolvedValue(undefined);
    const res = mockResponse();

    await controller.remove(mockRequest({ user: USER, params: { id: '1' } }), res);

    expect(service.remove).toHaveBeenCalledWith(1, 7);
    expect(res.body).toMatchObject({ success: true });
  });

  it('чужой пресет — 404', async () => {
    service.remove.mockRejectedValue(new UserItemPresetError('NOT_FOUND', 'nope'));
    const res = mockResponse();

    await controller.remove(mockRequest({ user: USER, params: { id: '1' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('неожиданный сбой — 500 без текста ошибки', async () => {
    service.remove.mockRejectedValue(new Error('db down'));
    const res = mockResponse();

    await controller.remove(mockRequest({ user: USER, params: { id: '1' } }), res);

    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('db down');
  });
});

/**
 * Справочник магазинов. Контроллер тонкий, и проверять в нём стоит ровно две
 * вещи: доменная ошибка сервиса превращается в осмысленный HTTP-код, а не в
 * 500, и невалидный вход отбивается до сервиса.
 */
import { GroupStoreController } from '../../../api/controllers/group-store.controller';
import { GroupStoreService } from '../../../services/group-store.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';

jest.mock('../../../services/group-store.service', () => {
  class GroupStoreError extends Error {
    constructor(
      public readonly code: string,
      message: string
    ) {
      super(message);
      this.name = 'GroupStoreError';
    }
  }

  return {
    GroupStoreError,
    GroupStoreService: {
      listForGroup: jest.fn(),
      rename: jest.fn(),
      archive: jest.fn(),
    },
  };
});

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  GroupStoreError,
}: { GroupStoreError: new (code: string, message: string) => Error } =
  jest.requireMock('../../../services/group-store.service');

const service = asServiceMock(GroupStoreService);
const controller = new GroupStoreController();
const USER = { id: 7 } as never;

beforeEach(() => jest.clearAllMocks());

describe('GET /api/groups/:groupId/stores', () => {
  it('отдаёт список магазинов группы', async () => {
    service.listForGroup.mockResolvedValue([{ id: 1, name: 'Лента' }]);
    const res = mockResponse();

    await controller.list(mockRequest({ user: USER, params: { groupId: '9' } }), res);

    expect(service.listForGroup).toHaveBeenCalledWith(9, 7);
    expect(res.body).toMatchObject({ success: true, data: [{ id: 1, name: 'Лента' }] });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.list(mockRequest({ params: { groupId: '9' } }), res);

    expect(res.statusCode).toBe(401);
    expect(service.listForGroup).not.toHaveBeenCalled();
  });

  it('нечисловой groupId — 400 до сервиса', async () => {
    const res = mockResponse();

    await controller.list(mockRequest({ user: USER, params: { groupId: 'abc' } }), res);

    expect(res.statusCode).toBe(400);
    expect(service.listForGroup).not.toHaveBeenCalled();
  });

  it('не участник группы — 403', async () => {
    service.listForGroup.mockRejectedValue(
      new GroupStoreError('FORBIDDEN', 'Not a member of this group')
    );
    const res = mockResponse();

    await controller.list(mockRequest({ user: USER, params: { groupId: '9' } }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('PATCH /api/groups/:groupId/stores/:id', () => {
  const params = { groupId: '9', id: '5' };

  it('переименовывает магазин', async () => {
    service.rename.mockResolvedValue({ id: 5, name: 'Лента на углу' });
    const res = mockResponse();

    await controller.rename(
      mockRequest({ user: USER, params, body: { name: 'Лента на углу' } }),
      res
    );

    expect(service.rename).toHaveBeenCalledWith(5, 7, 'Лента на углу');
    expect(res.body).toMatchObject({ success: true, data: { name: 'Лента на углу' } });
  });

  it('занятое имя — 409', async () => {
    service.rename.mockRejectedValue(
      new GroupStoreError('STORE_EXISTS', 'Магазин с таким названием уже есть')
    );
    const res = mockResponse();

    await controller.rename(
      mockRequest({ user: USER, params, body: { name: 'Магнит' } }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: 'STORE_EXISTS' });
  });

  it('несуществующий магазин — 404', async () => {
    service.rename.mockRejectedValue(new GroupStoreError('NOT_FOUND', 'Store not found'));
    const res = mockResponse();

    await controller.rename(
      mockRequest({ user: USER, params, body: { name: 'Магнит' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it.each([
    ['пустое имя', { name: '' }],
    ['имя длиннее 100', { name: 'м'.repeat(101) }],
    ['имя не строкой', { name: 42 }],
  ])('%s — 400 до сервиса', async (_label, body) => {
    const res = mockResponse();

    await controller.rename(mockRequest({ user: USER, params, body }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(service.rename).not.toHaveBeenCalled();
  });

  it('неожиданный сбой — 500, а не утечка текста ошибки', async () => {
    service.rename.mockRejectedValue(new Error('db down'));
    const res = mockResponse();

    await controller.rename(
      mockRequest({ user: USER, params, body: { name: 'Магнит' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('db down');
  });
});

describe('DELETE /api/groups/:groupId/stores/:id', () => {
  it('скрывает магазин', async () => {
    service.archive.mockResolvedValue(undefined);
    const res = mockResponse();

    await controller.archive(
      mockRequest({ user: USER, params: { groupId: '9', id: '5' } }),
      res
    );

    expect(service.archive).toHaveBeenCalledWith(5, 7);
    expect(res.body).toMatchObject({ success: true });
  });

  it('не участник группы — 403', async () => {
    service.archive.mockRejectedValue(new GroupStoreError('FORBIDDEN', 'nope'));
    const res = mockResponse();

    await controller.archive(
      mockRequest({ user: USER, params: { groupId: '9', id: '5' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });
});

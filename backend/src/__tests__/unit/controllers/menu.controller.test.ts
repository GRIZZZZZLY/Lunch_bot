/**
 * Меню группы. Каждый read-эндпоинт обязан требовать groupId и проверять
 * членство: без этого участник одной команды видел бы меню всех остальных.
 * Отдельно проверяем, что цена (Prisma Decimal) уезжает клиенту числом, а не
 * объектом {s,e,d}.
 */
import { MenuController } from '../../../api/controllers/menu.controller';
import { MenuService } from '../../../services/menu.service';
import { GroupService } from '../../../services/group.service';
import { memberRequest, mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';

jest.mock('../../../services/menu.service', () => ({
  MenuService: {
    getAllMenuItems: jest.fn(),
    getActiveMenuItems: jest.fn(),
    getPopularMenuItems: jest.fn(),
    getMenuStats: jest.fn(),
    searchMenuItems: jest.fn(),
    getMenuItemById: jest.fn(),
    createMenuItemForGroups: jest.fn(),
    updateMenuItem: jest.fn(),
    toggleMenuItemStatus: jest.fn(),
    deleteMenuItem: jest.fn(),
    bulkUpdateStatus: jest.fn(),
  },
}));

jest.mock('../../../services/group.service', () => {
  class GroupAccessError extends Error {
    constructor(
      public readonly code: string,
      message: string
    ) {
      super(message);
      this.name = 'GroupAccessError';
    }
  }

  return {
    GroupAccessError,
    GroupService: { assertMember: jest.fn() },
  };
});

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  GroupAccessError,
}: { GroupAccessError: new (code: string, message: string) => Error } =
  jest.requireMock('../../../services/group.service');

const menuService = asServiceMock(MenuService);
const groupService = asServiceMock(GroupService);

/**
 * Цена приходит из Prisma объектом Decimal, а не числом. utils/decimal.toNumber
 * читает его через toString(), поэтому у заглушки он обязателен — без него
 * получился бы NaN, и тест проверял бы не то, что заявлено.
 */
const decimal = (value: number) => ({
  s: 1,
  e: 2,
  d: [value],
  toNumber: () => value,
  toString: () => String(value),
});

const ITEM = { id: 1, name: 'Плов', groupId: 100, price: decimal(450), isActive: true };

beforeEach(() => {
  jest.clearAllMocks();
  groupService.assertMember.mockResolvedValue(undefined);
});

describe('GET /api/menu', () => {
  it('отдаёт меню группы с ценой числом', async () => {
    menuService.getAllMenuItems.mockResolvedValue([ITEM]);
    const res = mockResponse();

    await MenuController.getAllItems(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(groupService.assertMember).toHaveBeenCalledWith(1, 100);
    expect(res.body).toMatchObject({
      success: true,
      count: 1,
      data: [{ id: 1, price: 450 }],
    });
  });

  it('блюдо без цены отдаётся как есть', async () => {
    menuService.getAllMenuItems.mockResolvedValue([
      { id: 2, name: 'Хлеб', price: null },
    ]);
    const res = mockResponse();

    await MenuController.getAllItems(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.body).toMatchObject({ data: [{ id: 2, price: null }] });
  });

  it('groupId можно передать в теле запроса', async () => {
    menuService.getAllMenuItems.mockResolvedValue([]);

    await MenuController.getAllItems(
      memberRequest({ body: { groupId: 100 } }),
      mockResponse()
    );

    expect(menuService.getAllMenuItems).toHaveBeenCalledWith(100);
  });

  it.each([
    ['без groupId', {}],
    ['нечисловой groupId', { groupId: 'нет' }],
    ['нулевой groupId', { groupId: '0' }],
  ])('%s — 400 MISSING_GROUP_ID', async (_label, query) => {
    const res = mockResponse();

    await MenuController.getAllItems(memberRequest({ query }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'MISSING_GROUP_ID' });
    expect(menuService.getAllMenuItems).not.toHaveBeenCalled();
  });

  it('не участник группы — 403 с кодом сервиса', async () => {
    groupService.assertMember.mockRejectedValue(
      new GroupAccessError('NOT_A_MEMBER', 'Нет доступа к группе')
    );
    const res = mockResponse();

    await MenuController.getAllItems(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'NOT_A_MEMBER' });
    expect(menuService.getAllMenuItems).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    menuService.getAllMenuItems.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await MenuController.getAllItems(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/menu/active', () => {
  it('отдаёт только активные блюда', async () => {
    menuService.getActiveMenuItems.mockResolvedValue([ITEM]);
    const res = mockResponse();

    await MenuController.getActiveItems(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(menuService.getActiveMenuItems).toHaveBeenCalledWith(100);
    expect(res.body).toMatchObject({ count: 1 });
  });

  it('без groupId — 400', async () => {
    const res = mockResponse();

    await MenuController.getActiveItems(memberRequest(), res);

    expect(res.statusCode).toBe(400);
  });

  it('не участник — 403', async () => {
    groupService.assertMember.mockRejectedValue(
      new GroupAccessError('NOT_A_MEMBER', 'Нет доступа')
    );
    const res = mockResponse();

    await MenuController.getActiveItems(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    menuService.getActiveMenuItems.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await MenuController.getActiveItems(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/menu/popular', () => {
  it('передаёт лимит и группу', async () => {
    menuService.getPopularMenuItems.mockResolvedValue([ITEM]);
    const res = mockResponse();

    await MenuController.getPopularItems(
      memberRequest({ query: { groupId: '100', limit: '5' } }),
      res
    );

    expect(menuService.getPopularMenuItems).toHaveBeenCalledWith(5, 100);
    expect(res.body).toMatchObject({ limit: 5, count: 1 });
  });

  it('без лимита берёт 10', async () => {
    menuService.getPopularMenuItems.mockResolvedValue([]);

    await MenuController.getPopularItems(
      memberRequest({ query: { groupId: '100' } }),
      mockResponse()
    );

    expect(menuService.getPopularMenuItems).toHaveBeenCalledWith(10, 100);
  });

  it('без groupId — 400', async () => {
    const res = mockResponse();

    await MenuController.getPopularItems(memberRequest(), res);

    expect(res.statusCode).toBe(400);
  });

  it('не участник — 403', async () => {
    groupService.assertMember.mockRejectedValue(
      new GroupAccessError('NOT_A_MEMBER', 'Нет доступа')
    );
    const res = mockResponse();

    await MenuController.getPopularItems(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    menuService.getPopularMenuItems.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await MenuController.getPopularItems(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/menu/stats', () => {
  it('отдаёт статистику меню', async () => {
    menuService.getMenuStats.mockResolvedValue({ total: 12, active: 9 });
    const res = mockResponse();

    await MenuController.getMenuStats(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.body).toMatchObject({ data: { total: 12, active: 9 } });
  });

  it('без groupId — 400', async () => {
    const res = mockResponse();

    await MenuController.getMenuStats(memberRequest(), res);

    expect(res.statusCode).toBe(400);
  });

  it('не участник — 403', async () => {
    groupService.assertMember.mockRejectedValue(
      new GroupAccessError('NOT_A_MEMBER', 'Нет доступа')
    );
    const res = mockResponse();

    await MenuController.getMenuStats(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    menuService.getMenuStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await MenuController.getMenuStats(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/menu/search', () => {
  it('ищет по обрезанному запросу', async () => {
    menuService.searchMenuItems.mockResolvedValue([ITEM]);
    const res = mockResponse();

    await MenuController.searchItems(
      memberRequest({ query: { q: '  плов  ', groupId: '100' } }),
      res
    );

    expect(menuService.searchMenuItems).toHaveBeenCalledWith('плов', 100);
    expect(res.body).toMatchObject({ query: 'плов', count: 1 });
  });

  it.each([
    ['без запроса', {}],
    ['один символ', { q: 'п' }],
    ['пробелы', { q: '  ' }],
  ])('%s — 400 INVALID_QUERY', async (_label, query) => {
    const res = mockResponse();

    await MenuController.searchItems(
      memberRequest({ query: { ...query, groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_QUERY' });
  });

  it('без groupId — 400', async () => {
    const res = mockResponse();

    await MenuController.searchItems(memberRequest({ query: { q: 'плов' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'MISSING_GROUP_ID' });
  });

  it('не участник — 403', async () => {
    groupService.assertMember.mockRejectedValue(
      new GroupAccessError('NOT_A_MEMBER', 'Нет доступа')
    );
    const res = mockResponse();

    await MenuController.searchItems(
      memberRequest({ query: { q: 'плов', groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(menuService.searchMenuItems).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    menuService.searchMenuItems.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await MenuController.searchItems(
      memberRequest({ query: { q: 'плов', groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/menu/:id', () => {
  it('отдаёт блюдо участнику его группы', async () => {
    menuService.getMenuItemById.mockResolvedValue(ITEM);
    const res = mockResponse();

    await MenuController.getItemById(memberRequest({ params: { id: '1' } }), res);

    expect(groupService.assertMember).toHaveBeenCalledWith(1, 100);
    expect(res.body).toMatchObject({ data: { id: 1, price: 450 } });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await MenuController.getItemById(
      memberRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('блюда нет — 404', async () => {
    menuService.getMenuItemById.mockResolvedValue(null);
    const res = mockResponse();

    await MenuController.getItemById(memberRequest({ params: { id: '1' } }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'ITEM_NOT_FOUND' });
  });

  it('блюдо чужой группы — 403', async () => {
    menuService.getMenuItemById.mockResolvedValue(ITEM);
    groupService.assertMember.mockRejectedValue(
      new GroupAccessError('NOT_A_MEMBER', 'Нет доступа')
    );
    const res = mockResponse();

    await MenuController.getItemById(memberRequest({ params: { id: '1' } }), res);

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    menuService.getMenuItemById.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await MenuController.getItemById(memberRequest({ params: { id: '1' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/menu', () => {
  it('создаёт блюдо сразу в нескольких группах', async () => {
    menuService.createMenuItemForGroups.mockResolvedValue([
      ITEM,
      { ...ITEM, id: 2, groupId: 200 },
    ]);
    const res = mockResponse();

    await MenuController.createItem(
      memberRequest({
        body: {
          groupIds: [100, 200],
          name: 'Плов',
          description: 'вкусно',
          price: 450,
          isActive: true,
        },
      }),
      res
    );

    expect(menuService.createMenuItemForGroups).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Плов', price: 450 }),
      1,
      [100, 200]
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ count: 2 });
  });

  it.each([
    ['без groupIds', {}],
    ['пустой groupIds', { groupIds: [] }],
    ['groupIds не массив', { groupIds: 100 }],
  ])('%s — 400', async (_label, body) => {
    const res = mockResponse();

    await MenuController.createItem(memberRequest({ body }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'MISSING_GROUP_ID' });
  });

  it('не админ группы — 403 с кодом сервиса', async () => {
    menuService.createMenuItemForGroups.mockRejectedValue(
      new GroupAccessError('NOT_A_GROUP_ADMIN', 'Только админ группы')
    );
    const res = mockResponse();

    await MenuController.createItem(
      memberRequest({ body: { groupIds: [100], name: 'Плов' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'NOT_A_GROUP_ADMIN' });
  });

  it('ошибка сервиса — 500', async () => {
    menuService.createMenuItemForGroups.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await MenuController.createItem(
      memberRequest({ body: { groupIds: [100], name: 'Плов' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('PUT /api/menu/:id', () => {
  it('обновляет блюдо', async () => {
    menuService.updateMenuItem.mockResolvedValue({ ...ITEM, name: 'Плов XL' });
    const res = mockResponse();

    await MenuController.updateItem(
      memberRequest({ params: { id: '1' }, body: { name: 'Плов XL' } }),
      res
    );

    expect(menuService.updateMenuItem).toHaveBeenCalledWith(
      1,
      { name: 'Плов XL' },
      1
    );
    expect(res.body).toMatchObject({
      message: 'Menu item updated successfully',
    });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await MenuController.updateItem(
      memberRequest({ params: { id: 'нет' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('блюда нет — 404', async () => {
    menuService.updateMenuItem.mockRejectedValue(new Error('Menu item not found'));
    const res = mockResponse();

    await MenuController.updateItem(
      memberRequest({ params: { id: '1' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('нет прав на группу — 403', async () => {
    menuService.updateMenuItem.mockRejectedValue(
      new GroupAccessError('NOT_A_GROUP_ADMIN', 'Только админ группы')
    );
    const res = mockResponse();

    await MenuController.updateItem(
      memberRequest({ params: { id: '1' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    menuService.updateMenuItem.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await MenuController.updateItem(
      memberRequest({ params: { id: '1' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('PATCH /api/menu/:id/toggle', () => {
  it('включает блюдо и сообщает об этом', async () => {
    menuService.toggleMenuItemStatus.mockResolvedValue({
      ...ITEM,
      isActive: true,
    });
    const res = mockResponse();

    await MenuController.toggleItemStatus(
      memberRequest({ params: { id: '1' } }),
      res
    );

    expect(res.body).toMatchObject({
      message: 'Menu item activated successfully',
    });
  });

  it('выключает блюдо и сообщает об этом', async () => {
    menuService.toggleMenuItemStatus.mockResolvedValue({
      ...ITEM,
      isActive: false,
    });
    const res = mockResponse();

    await MenuController.toggleItemStatus(
      memberRequest({ params: { id: '1' } }),
      res
    );

    expect(res.body).toMatchObject({
      message: 'Menu item deactivated successfully',
    });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await MenuController.toggleItemStatus(
      memberRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('блюда нет — 404', async () => {
    menuService.toggleMenuItemStatus.mockRejectedValue(
      new Error('Menu item not found')
    );
    const res = mockResponse();

    await MenuController.toggleItemStatus(
      memberRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('нет прав — 403', async () => {
    menuService.toggleMenuItemStatus.mockRejectedValue(
      new GroupAccessError('NOT_A_GROUP_ADMIN', 'Только админ')
    );
    const res = mockResponse();

    await MenuController.toggleItemStatus(
      memberRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    menuService.toggleMenuItemStatus.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await MenuController.toggleItemStatus(
      memberRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('DELETE /api/menu/:id', () => {
  it('удаляет блюдо', async () => {
    menuService.deleteMenuItem.mockResolvedValue(undefined);
    const res = mockResponse();

    await MenuController.deleteItem(memberRequest({ params: { id: '1' } }), res);

    expect(menuService.deleteMenuItem).toHaveBeenCalledWith(1, 1);
    expect(res.body).toMatchObject({
      message: 'Menu item deleted successfully',
    });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await MenuController.deleteItem(
      memberRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('блюда нет — 404', async () => {
    menuService.deleteMenuItem.mockRejectedValue(new Error('Menu item not found'));
    const res = mockResponse();

    await MenuController.deleteItem(memberRequest({ params: { id: '1' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('нет прав — 403', async () => {
    menuService.deleteMenuItem.mockRejectedValue(
      new GroupAccessError('NOT_A_GROUP_ADMIN', 'Только админ')
    );
    const res = mockResponse();

    await MenuController.deleteItem(memberRequest({ params: { id: '1' } }), res);

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    menuService.deleteMenuItem.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await MenuController.deleteItem(memberRequest({ params: { id: '1' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('PATCH /api/menu/bulk-status', () => {
  it('массово включает блюда', async () => {
    menuService.bulkUpdateStatus.mockResolvedValue(3);
    const res = mockResponse();

    await MenuController.bulkUpdateStatus(
      memberRequest({ body: { ids: [1, 2, 3], isActive: true } }),
      res
    );

    expect(menuService.bulkUpdateStatus).toHaveBeenCalledWith([1, 2, 3], true, 1);
    expect(res.body).toMatchObject({
      updatedCount: 3,
      message: '3 menu items activated successfully',
    });
  });

  it('массово выключает блюда', async () => {
    menuService.bulkUpdateStatus.mockResolvedValue(2);
    const res = mockResponse();

    await MenuController.bulkUpdateStatus(
      memberRequest({ body: { ids: [1, 2], isActive: false } }),
      res
    );

    expect(res.body).toMatchObject({
      message: '2 menu items deactivated successfully',
    });
  });

  it.each([
    ['ids не массив', { ids: 1, isActive: true }],
    ['пустой ids', { ids: [], isActive: true }],
  ])('%s — 400 INVALID_IDS', async (_label, body) => {
    const res = mockResponse();

    await MenuController.bulkUpdateStatus(memberRequest({ body }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_IDS' });
  });

  it.each([
    ['isActive строкой', { ids: [1], isActive: 'true' }],
    ['без isActive', { ids: [1] }],
  ])('%s — 400 INVALID_STATUS', async (_label, body) => {
    const res = mockResponse();

    await MenuController.bulkUpdateStatus(memberRequest({ body }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_STATUS' });
  });

  it('нет прав — 403', async () => {
    menuService.bulkUpdateStatus.mockRejectedValue(
      new GroupAccessError('NOT_A_GROUP_ADMIN', 'Только админ')
    );
    const res = mockResponse();

    await MenuController.bulkUpdateStatus(
      memberRequest({ body: { ids: [1], isActive: true } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    menuService.bulkUpdateStatus.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await MenuController.bulkUpdateStatus(
      memberRequest({ body: { ids: [1], isActive: true } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

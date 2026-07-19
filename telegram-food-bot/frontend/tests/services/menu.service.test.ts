import { beforeEach, describe, expect, it, vi } from 'vitest';
import { menuService } from '../../src/services/menu.service';

const { apiDelete, apiGet, apiPatch, apiPost, apiPut } = vi.hoisted(() => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock('../../src/services/api.service', () => ({
  apiService: {
    delete: apiDelete,
    get: apiGet,
    patch: apiPatch,
    post: apiPost,
    put: apiPut,
  },
}));

describe('menuService routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads all menu items for a selected group', async () => {
    apiGet.mockResolvedValue({
      success: true,
      data: [{ id: 1, groupId: 2, name: 'Borscht' }],
    });

    const response = await menuService.getAllItems(2);

    expect(response.data).toHaveLength(1);
    expect(apiGet).toHaveBeenCalledWith('/menu?groupId=2');
  });

  it('searches menu items inside a selected group', async () => {
    apiGet.mockResolvedValue({
      success: true,
      data: [{ id: 1, groupId: 2, name: 'Borscht' }],
    });

    const response = await menuService.searchItems('борщ & soup', 2);

    expect(response.data).toHaveLength(1);
    expect(apiGet).toHaveBeenCalledWith(
      '/menu/search?q=%D0%B1%D0%BE%D1%80%D1%89%20%26%20soup&groupId=2'
    );
  });

  it('creates a menu item for one or more selected groups', async () => {
    apiPost.mockResolvedValue({
      success: true,
      data: [
        { id: 1, groupId: 1, name: 'Borscht' },
        { id: 2, groupId: 2, name: 'Borscht' },
      ],
    });

    const response = await menuService.createItem(
      { name: 'Borscht', description: 'Soup', price: 320, isActive: true },
      [1, 2]
    );

    expect(response.data).toHaveLength(2);
    expect(apiPost).toHaveBeenCalledWith('/menu', {
      name: 'Borscht',
      description: 'Soup',
      price: 320,
      isActive: true,
      groupIds: [1, 2],
    });
  });

  it('updates a menu item in the selected group without create-only groupIds', async () => {
    apiPut.mockResolvedValue({
      success: true,
      data: { id: 7, groupId: 2, name: 'Updated Borscht' },
    });

    const response = await menuService.updateItem(
      7,
      {
        name: 'Updated Borscht',
        description: 'Soup',
        price: 350,
        isActive: true,
        groupIds: [2],
      } as any,
      2
    );

    expect(response.data?.name).toBe('Updated Borscht');
    expect(apiPut).toHaveBeenCalledWith('/menu/7?groupId=2', {
      name: 'Updated Borscht',
      description: 'Soup',
      price: 350,
      isActive: true,
      groupId: 2,
    });
  });

  it('deletes a menu item from the selected group', async () => {
    apiDelete.mockResolvedValue({ success: true });

    await menuService.deleteItem(7, 2);

    expect(apiDelete).toHaveBeenCalledWith('/menu/7?groupId=2');
  });

  it('toggles a menu item status in the selected group', async () => {
    apiPatch.mockResolvedValue({
      success: true,
      data: { id: 7, groupId: 2, name: 'Borscht', isActive: false },
    });

    await menuService.toggleItemStatus(7, 2);

    expect(apiPatch).toHaveBeenCalledWith('/menu/7/toggle?groupId=2', {
      groupId: 2,
    });
  });

  it('loads popular menu items and menu stats inside the selected group', async () => {
    apiGet
      .mockResolvedValueOnce({ success: true, data: [{ id: 7, name: 'Borscht' }] })
      .mockResolvedValueOnce({
        success: true,
        data: { total: 3, active: 2, averagePrice: 340 },
      });

    await menuService.getPopularItems(5, 2);
    await menuService.getMenuStats(2);

    expect(apiGet).toHaveBeenNthCalledWith(1, '/menu/popular?limit=5&groupId=2');
    expect(apiGet).toHaveBeenNthCalledWith(2, '/menu/stats?groupId=2');
  });
});

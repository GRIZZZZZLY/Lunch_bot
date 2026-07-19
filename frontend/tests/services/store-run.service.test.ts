import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storeRunService } from '../../src/services/store-run.service';

const { apiDelete, apiGet, apiPatch, apiPost } = vi.hoisted(() => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('../../src/services/api.service', () => ({
  apiService: {
    delete: apiDelete,
    get: apiGet,
    patch: apiPatch,
    post: apiPost,
  },
}));

describe('storeRunService routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads active store runs', async () => {
    apiGet.mockResolvedValue({ success: true, data: [] });

    await storeRunService.getActive();

    expect(apiGet).toHaveBeenCalledWith('/store-runs/active');
  });

  it('creates a store run for the selected group', async () => {
    apiPost.mockResolvedValue({ success: true, data: { id: 7 } });

    await storeRunService.createRun({
      groupId: 2,
      storeName: 'Market',
      collectMinutes: 10,
    });

    expect(apiPost).toHaveBeenCalledWith('/store-runs', {
      groupId: 2,
      storeName: 'Market',
      collectMinutes: 10,
    });
  });

  it('adds and deletes participant items', async () => {
    apiPost.mockResolvedValue({ success: true, data: [] });
    apiDelete.mockResolvedValue({ success: true });

    await storeRunService.addItems(7, [
      { name: 'Milk', quantity: 2, notes: 'Low fat' },
    ]);
    await storeRunService.deleteItem(7, 11);

    expect(apiPost).toHaveBeenCalledWith('/store-runs/7/items', {
      items: [{ name: 'Milk', quantity: 2, notes: 'Low fat' }],
    });
    expect(apiDelete).toHaveBeenCalledWith('/store-runs/7/items/11');
  });

  it('starts shopping and marks item outcomes', async () => {
    apiPost.mockResolvedValue({ success: true, data: {} });

    await storeRunService.startShopping(7);
    await storeRunService.setItemPrice(7, 11, {
      price: 120,
      status: 'BOUGHT',
    });
    await storeRunService.setItemPrice(7, 12, {
      price: null,
      status: 'NOT_FOUND',
    });

    expect(apiPost).toHaveBeenNthCalledWith(1, '/store-runs/7/start-shopping', {});
    expect(apiPost).toHaveBeenNthCalledWith(2, '/store-runs/7/items/11/price', {
      price: 120,
      status: 'BOUGHT',
    });
    expect(apiPost).toHaveBeenNthCalledWith(3, '/store-runs/7/items/12/price', {
      price: null,
      status: 'NOT_FOUND',
    });
  });

  it('settles and cancels a store run', async () => {
    apiPost.mockResolvedValue({ success: true, data: {} });

    await storeRunService.settle(7);
    await storeRunService.cancel(7);

    expect(apiPost).toHaveBeenNthCalledWith(1, '/store-runs/7/settle', {});
    expect(apiPost).toHaveBeenNthCalledWith(2, '/store-runs/7/cancel', {});
  });

  it('updates participant item text before shopping starts', async () => {
    apiPatch.mockResolvedValue({ success: true, data: { id: 11 } });

    await storeRunService.updateItem(7, 11, {
      name: 'Milk',
      quantity: 3,
      notes: '2 percent',
    });

    expect(apiPatch).toHaveBeenCalledWith('/store-runs/7/items/11', {
      name: 'Milk',
      quantity: 3,
      notes: '2 percent',
    });
  });
});

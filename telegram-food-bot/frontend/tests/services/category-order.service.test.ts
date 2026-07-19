import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categoryOrderService } from '../../src/services/category-order.service';

const { apiDelete, apiGet, apiPost, apiPut } = vi.hoisted(() => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock('../../src/services/api.service', () => ({
  apiService: {
    delete: apiDelete,
    get: apiGet,
    post: apiPost,
    put: apiPut,
  },
}));

const categoryOrder = {
  id: 3,
  pollId: 7,
  category: 'Soup',
  responsibleUserId: 9,
  selectionStatus: 'SELECTED_VOLUNTEER',
  calculationStatus: 'IN_PROGRESS',
  selectionMode: 'volunteer',
  participantCount: 2,
  deliveryCost: '90',
  serviceFee: null,
  tip: '0',
  notes: null,
  totalItemsAmount: '600',
  totalAdditionalCosts: '90',
  totalAmount: '690',
  createdAt: '2026-06-22T09:00:00.000Z',
  updatedAt: '2026-06-22T09:00:00.000Z',
  calculationStartedAt: null,
  calculationCompletedAt: null,
  poll: { id: 7, groupId: 2, status: 'COMPLETED' },
  responsibleUser: null,
  orderItems: [
    {
      id: 11,
      categoryOrderId: 3,
      userId: 5,
      itemName: 'Soup',
      price: '300',
      notes: null,
      enteredBy: 9,
      createdAt: '2026-06-22T09:00:00.000Z',
      updatedAt: '2026-06-22T09:00:00.000Z',
    },
  ],
  _count: { orderItems: 1 },
} as any;

describe('categoryOrderService routing and normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads category orders for poll and normalizes decimal-like values', async () => {
    apiGet.mockResolvedValue({ success: true, data: [categoryOrder] });

    const response = await categoryOrderService.getCategoryOrdersForPoll(7);

    expect(apiGet).toHaveBeenCalledWith('/polls/7/category-orders');
    expect(response.data?.[0].deliveryCost).toBe(90);
    expect(response.data?.[0].totalAmount).toBe(690);
    expect(response.data?.[0].orderItems[0].price).toBe(300);
  });

  it('uses Mini App endpoints for order item calculation flow', async () => {
    apiPost.mockResolvedValue({ success: true, data: categoryOrder.orderItems[0] });
    apiPut.mockResolvedValue({ success: true, data: categoryOrder });
    apiGet.mockResolvedValue({ success: true, data: [] });
    apiDelete.mockResolvedValue({ success: true });

    await categoryOrderService.saveOrderItem(3, {
      userId: 5,
      itemName: 'Soup',
      price: 300,
      notes: 'hot',
    });
    await categoryOrderService.updateCosts(3, {
      deliveryCost: 90,
      serviceFee: 0,
      tip: 0,
    });
    await categoryOrderService.finalizeCalculation(3);
    await categoryOrderService.getParticipants(3);
    await categoryOrderService.getOrderItems(3);
    await categoryOrderService.getProgress(3);
    await categoryOrderService.deleteOrderItem(11);

    expect(apiPost).toHaveBeenNthCalledWith(1, '/category-orders/3/order-items', {
      userId: 5,
      itemName: 'Soup',
      price: 300,
      notes: 'hot',
    });
    expect(apiPut).toHaveBeenCalledWith('/category-orders/3/costs', {
      deliveryCost: 90,
      serviceFee: 0,
      tip: 0,
    });
    expect(apiPost).toHaveBeenNthCalledWith(2, '/category-orders/3/finalize');
    expect(apiGet).toHaveBeenNthCalledWith(1, '/category-orders/3/participants');
    expect(apiGet).toHaveBeenNthCalledWith(2, '/category-orders/3/order-items');
    expect(apiGet).toHaveBeenNthCalledWith(3, '/category-orders/3/progress');
    expect(apiDelete).toHaveBeenCalledWith('/order-items/11');
  });

  it('volunteers for a category and reads edit history', async () => {
    apiPost.mockResolvedValue({ success: true, data: categoryOrder });
    apiGet.mockResolvedValue({ success: true, data: [] });

    await categoryOrderService.volunteerForCategory(3);
    await categoryOrderService.getEditHistory(11);

    expect(apiPost).toHaveBeenCalledWith('/category-orders/3/volunteer');
    expect(apiGet).toHaveBeenCalledWith('/order-items/11/edit-history');
  });
});

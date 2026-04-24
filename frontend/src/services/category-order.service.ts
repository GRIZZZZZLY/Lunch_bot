import { apiService, ApiResponse } from './api.service';

// Types
export interface CategoryOrder {
  id: number;
  pollId: number;
  category: string;
  responsibleUserId: number | null;
  selectionStatus:
    | 'PENDING'
    | 'VOLUNTEER_OPEN'
    | 'SELECTED_AUTO'
    | 'SELECTED_VOLUNTEER'
    | 'SELECTED_ROULETTE';
  calculationStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  selectionMode: 'volunteer' | 'roulette' | 'auto' | null;
  participantCount: number;
  deliveryCost: number | null;
  serviceFee: number | null;
  tip: number | null;
  notes: string | null;
  totalItemsAmount: number | null;
  totalAdditionalCosts: number | null;
  totalAmount: number | null;
  createdAt: string;
  updatedAt: string;
  calculationStartedAt: string | null;
  calculationCompletedAt: string | null;
  poll: {
    id: number;
    groupId: number;
    status: string;
  };
  responsibleUser: {
    id: number;
    telegramId: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
  } | null;
  orderItems: OrderItem[];
  _count: {
    orderItems: number;
  };
}

export interface OrderItem {
  id: number;
  categoryOrderId: number;
  userId: number;
  itemName: string;
  price: number;
  notes: string | null;
  enteredBy: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    firstName: string;
    lastName: string | null;
    username: string | null;
  };
}

export interface SaveOrderItemData {
  userId: number;
  itemName: string;
  price: number;
  notes?: string;
}

export interface UpdateCostsData {
  deliveryCost?: number;
  serviceFee?: number;
  tip?: number;
  notes?: string;
}

export interface CalculationProgress {
  total: number;
  filled: number;
  isComplete: boolean;
  percentage: number;
}

export interface OrderItemEditLog {
  id: number;
  orderItemId: number;
  editedBy: number;
  fieldChanged: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  timestamp: string;
  editor: {
    id: number;
    firstName: string;
    lastName: string | null;
    username: string | null;
  };
}

export interface Participant {
  id: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
}

class CategoryOrderService {
  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeOrderItem(orderItem: OrderItem): OrderItem {
    return {
      ...orderItem,
      price: this.toNumberOrNull(orderItem.price) ?? 0,
    };
  }

  private normalizeCategoryOrder(categoryOrder: CategoryOrder): CategoryOrder {
    return {
      ...categoryOrder,
      deliveryCost: this.toNumberOrNull(categoryOrder.deliveryCost),
      serviceFee: this.toNumberOrNull(categoryOrder.serviceFee),
      tip: this.toNumberOrNull(categoryOrder.tip),
      totalItemsAmount: this.toNumberOrNull(categoryOrder.totalItemsAmount),
      totalAdditionalCosts: this.toNumberOrNull(categoryOrder.totalAdditionalCosts),
      totalAmount: this.toNumberOrNull(categoryOrder.totalAmount),
      orderItems: (categoryOrder.orderItems || []).map(item =>
        this.normalizeOrderItem(item)
      ),
    };
  }

  /**
   * Get all CategoryOrders for a poll
   */
  async getCategoryOrdersForPoll(pollId: number): Promise<ApiResponse<CategoryOrder[]>> {
    const response = await apiService.get<CategoryOrder[]>(
      `/polls/${pollId}/category-orders`
    );

    if (response.success && response.data) {
      return {
        ...response,
        data: response.data.map(order => this.normalizeCategoryOrder(order)),
      };
    }

    return response;
  }

  async getMyCategoryOrdersForPoll(
    pollId: number
  ): Promise<ApiResponse<CategoryOrder[]>> {
    const response = await apiService.get<CategoryOrder[]>(
      `/polls/${pollId}/category-orders/my`
    );

    if (response.success && response.data) {
      return {
        ...response,
        data: response.data.map(order => this.normalizeCategoryOrder(order)),
      };
    }

    return response;
  }

  /**
   * Get a single CategoryOrder by ID
   */
  async getCategoryOrder(id: number): Promise<ApiResponse<CategoryOrder>> {
    const response = await apiService.get<CategoryOrder>(`/category-orders/${id}`);

    if (response.success && response.data) {
      return {
        ...response,
        data: this.normalizeCategoryOrder(response.data),
      };
    }

    return response;
  }

  /**
   * Save or update an OrderItem (autosave)
   */
  async saveOrderItem(
    categoryOrderId: number,
    data: SaveOrderItemData
  ): Promise<ApiResponse<OrderItem>> {
    const response = await apiService.post<OrderItem>(
      `/category-orders/${categoryOrderId}/order-items`,
      data
    );

    if (response.success && response.data) {
      return {
        ...response,
        data: this.normalizeOrderItem(response.data),
      };
    }

    return response;
  }

  /**
   * Delete an OrderItem
   */
  async deleteOrderItem(orderItemId: number): Promise<ApiResponse<void>> {
    return apiService.delete(`/order-items/${orderItemId}`);
  }

  /**
   * Get calculation progress
   */
  async getProgress(categoryOrderId: number): Promise<ApiResponse<CalculationProgress>> {
    return apiService.get<CalculationProgress>(
      `/category-orders/${categoryOrderId}/progress`
    );
  }

  /**
   * Finalize calculation and create transactions
   */
  async finalizeCalculation(
    categoryOrderId: number
  ): Promise<
    ApiResponse<{
      transactionsCreated: number;
      participantCount: number;
      orderItemsCount: number;
    }>
  > {
    return apiService.post(`/category-orders/${categoryOrderId}/finalize`);
  }

  /**
   * Update additional costs
   */
  async updateCosts(
    categoryOrderId: number,
    costs: UpdateCostsData
  ): Promise<ApiResponse<CategoryOrder>> {
    return apiService.put<CategoryOrder>(
      `/category-orders/${categoryOrderId}/costs`,
      costs
    );
  }

  /**
   * Get edit history for an OrderItem (admin only)
   */
  async getEditHistory(orderItemId: number): Promise<ApiResponse<OrderItemEditLog[]>> {
    return apiService.get<OrderItemEditLog[]>(
      `/order-items/${orderItemId}/edit-history`
    );
  }

  /**
   * Get all OrderItems for a CategoryOrder
   */
  async getOrderItems(categoryOrderId: number): Promise<ApiResponse<OrderItem[]>> {
    const response = await apiService.get<OrderItem[]>(
      `/category-orders/${categoryOrderId}/order-items`
    );

    if (response.success && response.data) {
      return {
        ...response,
        data: response.data.map(item => this.normalizeOrderItem(item)),
      };
    }

    return response;
  }

  /**
   * Get participants (users who voted for this category)
   */
  async getParticipants(categoryOrderId: number): Promise<ApiResponse<Participant[]>> {
    return apiService.get<Participant[]>(
      `/category-orders/${categoryOrderId}/participants`
    );
  }

  async volunteerForCategory(
    categoryOrderId: number
  ): Promise<ApiResponse<CategoryOrder | null>> {
    const response = await apiService.post<CategoryOrder | null>(
      `/category-orders/${categoryOrderId}/volunteer`
    );

    if (response.success && response.data) {
      return {
        ...response,
        data: this.normalizeCategoryOrder(response.data),
      };
    }

    return response;
  }
}

export const categoryOrderService = new CategoryOrderService();
export default categoryOrderService;

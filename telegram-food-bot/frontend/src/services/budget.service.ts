import { sanitizeURL } from '../lib/sanitize';
import { apiService } from './api.service';

export interface Transaction {
  id: number;
  pollId: number | null;
  storeRunId?: number | null;
  storeItemId?: number | null;
  fromUserId: number;
  toUserId: number;
  amount: number;
  menuItemId: number | null;
  // Cost breakdown fields
  itemPrice?: number | null;
  deliveryShare?: number | null;
  serviceShare?: number | null;
  tipShare?: number | null;
  status: 'PENDING' | 'PAID' | 'CONFIRMED';
  createdAt: string;
  paidAt: string | null;
  confirmedAt: string | null;
  fromUser: {
    id: number;
    telegramId: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
  };
  toUser: {
    id: number;
    telegramId: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    paymentCard: string | null;
    paymentPhone: string | null;
    paymentDetails: string | null;
  };
  menuItem: {
    id: number;
    name: string;
    price: number;
    category: string;
  } | null;
  storeItem?: {
    id: number;
    name: string;
    quantity: number;
  } | null;
  storeRun?: {
    id: number;
    storeName: string;
    status: string;
  } | null;
  poll: {
    id: number;
    groupId: number;
    status: string;
    startedAt: string;
    endedAt: string | null;
    group: {
      id: number;
      telegramId: string;
      title: string;
    };
  } | null;
}

export interface FailedUser {
  id: number;
  firstName: string;
  lastName?: string;
  reason: string;
  errorCode: 'bot_blocked' | 'no_chat' | 'user_deactivated' | 'unknown';
}

export interface SendRemindersResult {
  sentCount: number;
  failedCount: number;
  totalCount: number;
  failedUsers: FailedUser[];
}

export interface BudgetStats {
  totalSpent: number;
  totalReceived: number;
  balance: number;
  averagePerOrder: number;
  timesResponsible: number;
  totalOrders: number;
  confirmedOrders: number;
  pendingOrders: number;
  topDishes: Array<{
    name: string;
    count: number;
    total: number;
  }>;
}

class BudgetService {
  /**
   * Получить все долги пользователя
   */
  async getDebts(
    userId: number,
    status?: 'PENDING' | 'PAID' | 'CONFIRMED',
    options?: { activeOnly?: boolean }
  ): Promise<Transaction[]> {
    try {
      const params = new URLSearchParams({ userId: String(userId) });
      if (status) {
        params.append('status', status);
      }
      if (options?.activeOnly) {
        params.append('activeOnly', 'true');
      }
      
      const response = await apiService.get<Transaction[]>(`/budget/debts?${params}`);
      if (import.meta.env.DEV) {
        console.log('[BudgetService.getDebts] ✅ Success:', response.data?.length || 0);
      }
      
      // apiService.get возвращает { success: true, data: [...] }
      if (response.success && response.data) {
        return response.data;
      }
      
      if (import.meta.env.DEV) {
        console.warn('[BudgetService.getDebts] ⚠️ No data returned, using empty array');
      }
      return [];
    } catch (error) {
      console.error('[BudgetService.getDebts] ❌ Request failed:', error);
      // Graceful degradation - возвращаем пустой массив вместо throw
      return [];
    }
  }

  /**
   * Получить все кредиты (кто должен пользователю)
   */
  async getCredits(
    userId: number,
    status?: 'PENDING' | 'PAID' | 'CONFIRMED',
    options?: { activeOnly?: boolean }
  ): Promise<Transaction[]> {
    try {
      const params = new URLSearchParams({ userId: String(userId) });
      if (status) {
        params.append('status', status);
      }
      if (options?.activeOnly) {
        params.append('activeOnly', 'true');
      }
      
      const response = await apiService.get<Transaction[]>(`/budget/credits?${params}`);
      if (import.meta.env.DEV) {
        console.log('[BudgetService.getCredits] ✅ Success:', response.data?.length || 0);
      }
      
      // apiService.get возвращает { success: true, data: [...] }
      if (response.success && response.data) {
        return response.data;
      }
      
      if (import.meta.env.DEV) {
        console.warn('[BudgetService.getCredits] ⚠️ No data returned, using empty array');
      }
      return [];
    } catch (error) {
      console.error('[BudgetService.getCredits] ❌ Request failed:', error);
      // Graceful degradation - возвращаем пустой массив вместо throw
      return [];
    }
  }

  /**
   * Пометить транзакцию как оплаченную
   */
  async markAsPaid(transactionId: number): Promise<void> {
    await apiService.post('/budget/mark-paid', { transactionId });
  }

  /**
   * Подтвердить получение платежа (для ответственного)
   */
  async confirmPayment(transactionId: number): Promise<void> {
    await apiService.post('/budget/confirm-payment', { transactionId });
  }

  /**
   * Отменить пометку оплаты
   */
  async cancelMark(transactionId: number): Promise<void> {
    await apiService.post('/budget/cancel-mark', { transactionId });
  }

  /**
   * Получить статистику пользователя
   */
  async getStats(userId: number, from?: Date, to?: Date): Promise<BudgetStats> {
    const params = new URLSearchParams({ userId: String(userId) });
    if (from) {
      params.append('from', from.toISOString());
    }
    if (to) {
      params.append('to', to.toISOString());
    }
    
    const response = await apiService.get<BudgetStats>(`/budget/stats?${params}`);
    
    // apiService.get возвращает { success: true, data: {...} }
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error('Failed to get budget stats');
  }

  /**
   * Открыть СБП для оплаты
   */
  openSBP(phone: string, amount: number): void {
    // Формируем ссылку на СБП
    const cleanPhone = phone.replace(/\D/g, '');
    const sbpUrl = `https://qr.nspk.ru/proxyapp.html?type=02&bank=100000000111&sum=${amount}&cur=RUB&payeeId=${cleanPhone}`;
    const safeUrl = sanitizeURL(sbpUrl);

    if (!safeUrl) {
      return;
    }
    
    // Открываем в новом окне или текущем (в зависимости от платформы)
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openLink(safeUrl);
    } else {
      window.open(safeUrl, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Отправить напоминание должнику
   */
  async sendReminder(transactionId: number): Promise<void> {
    await apiService.post('/budget/send-reminder', { transactionId });
  }

  /**
   * Отправить напоминания всем должникам по заказу
   */
  async sendRemindersToAll(pollId: number): Promise<SendRemindersResult> {
    const response = await apiService.post<SendRemindersResult>('/budget/send-reminders-all', { pollId });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error('Failed to send reminders');
  }

  /**
   * Получить итоговые суммы по заказу
   */
  async getPollTotals(pollId: number): Promise<{
    totalOrder: number;
    totalToReturn: number;
    responsibleShare: number;
  }> {
    const response = await apiService.get<{
      totalOrder: number;
      totalToReturn: number;
      responsibleShare: number;
    }>(`/budget/poll-totals/${pollId}`);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error('Failed to get poll totals');
  }

  // ============================================
  // COST SPLITTING METHODS
  // ============================================

  /**
   * Установить расходы на заказ (доставка, комиссия, чаевые)
   * Только для ответственного лица
   */
  async setOrderCosts(
    pollId: number,
    costs: {
      deliveryCost: number;
      serviceFee: number;
      tip: number;
      notes?: string;
    }
  ): Promise<OrderCosts> {
    const response = await apiService.post<OrderCosts>(
      `/budget/order-costs/${pollId}`,
      costs
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error('Failed to set order costs');
  }

  /**
   * Получить расходы на заказ
   */
  async getOrderCosts(pollId: number): Promise<OrderCosts | null> {
    try {
      const response = await apiService.get<OrderCosts>(`/budget/order-costs/${pollId}`);

      if (response.success && response.data) {
        return response.data;
      }

      return null;
    } catch (error: any) {
      // 404 означает что расходы еще не введены
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Получить детальную разбивку расходов по заказу
   */
  async getPollCostBreakdown(pollId: number): Promise<PollCostBreakdown> {
    const response = await apiService.get<PollCostBreakdown>(
      `/budget/poll-breakdown/${pollId}`
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error('Failed to get poll cost breakdown');
  }
}

// ============================================
// COST SPLITTING INTERFACES
// ============================================

export interface OrderCosts {
  id: number;
  pollId: number;
  deliveryCost: number;
  serviceFee: number;
  tip: number;
  notes?: string | null;
  enteredBy: number;
  enteredAt: string;
  updatedAt: string;
}

export interface TransactionBreakdown {
  transactionId: number;
  userId: number;
  userName: string;
  menuItemName: string;
  itemPrice: number;
  deliveryShare: number;
  serviceShare: number;
  tipShare: number;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'CONFIRMED';
}

export interface PollCostBreakdown {
  pollId: number;
  totalItemsCost: number;
  totalDeliveryCost: number;
  totalServiceFee: number;
  totalTip: number;
  grandTotal: number;
  participantsCount: number;
  transactions: TransactionBreakdown[];
  orderCosts?: OrderCosts;
}

export const budgetService = new BudgetService();

import { apiService } from './api.service';

export interface Transaction {
  id: number;
  pollId: number;
  fromUserId: number;
  toUserId: number;
  amount: number;
  menuItemId: number | null;
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
  };
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
  async getDebts(userId: number, status?: 'PENDING' | 'PAID' | 'CONFIRMED'): Promise<Transaction[]> {
    try {
      const params = new URLSearchParams({ userId: String(userId) });
      if (status) {
        params.append('status', status);
      }
      
      const response = await apiService.get<Transaction[]>(`/budget/debts?${params}`);
      console.log('[BudgetService.getDebts] ✅ Success:', response.data?.length || 0);
      
      // apiService.get возвращает { success: true, data: [...] }
      if (response.success && response.data) {
        return response.data;
      }
      
      console.warn('[BudgetService.getDebts] ⚠️ No data returned, using empty array');
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
  async getCredits(userId: number, status?: 'PENDING' | 'PAID' | 'CONFIRMED'): Promise<Transaction[]> {
    try {
      const params = new URLSearchParams({ userId: String(userId) });
      if (status) {
        params.append('status', status);
      }
      
      const response = await apiService.get<Transaction[]>(`/budget/credits?${params}`);
      console.log('[BudgetService.getCredits] ✅ Success:', response.data?.length || 0);
      
      // apiService.get возвращает { success: true, data: [...] }
      if (response.success && response.data) {
        return response.data;
      }
      
      console.warn('[BudgetService.getCredits] ⚠️ No data returned, using empty array');
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
    
    // Открываем в новом окне или текущем (в зависимости от платформы)
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openLink(sbpUrl);
    } else {
      window.open(sbpUrl, '_blank');
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
  async sendRemindersToAll(pollId: number): Promise<{ sentCount: number }> {
    const response = await apiService.post<{ sentCount: number }>('/budget/send-reminders-all', { pollId });
    
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
}

export const budgetService = new BudgetService();

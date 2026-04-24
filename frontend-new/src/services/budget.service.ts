import { apiService } from './api.service';
import type { Transaction } from '@/types/models';

export interface BudgetStats {
  totalDebts: number;
  totalCredits: number;
  balance: number;
  pendingTransactions: number;
}

class BudgetService {
  getDebts(params?: { status?: string }) {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    return apiService.get<Transaction[]>(`/budget/debts${q.toString() ? `?${q}` : ''}`);
  }

  getCredits(params?: { status?: string }) {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    return apiService.get<Transaction[]>(`/budget/credits${q.toString() ? `?${q}` : ''}`);
  }

  markPaid(transactionId: number) {
    return apiService.post<void>('/budget/mark-paid', { transactionId });
  }

  confirmPayment(transactionId: number) {
    return apiService.post<void>('/budget/confirm-payment', { transactionId });
  }

  cancelMark(transactionId: number) {
    return apiService.post<void>('/budget/cancel-mark', { transactionId });
  }

  getStats(params?: { from?: string; to?: string }) {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    return apiService.get<BudgetStats>(`/budget/stats${q.toString() ? `?${q}` : ''}`);
  }

  sendReminder(transactionId: number) {
    return apiService.post<void>('/budget/send-reminder', { transactionId });
  }

  sendRemindersAll(pollId: number) {
    return apiService.post<{ sent: number }>('/budget/send-reminders-all', { pollId });
  }
}

export const budgetService = new BudgetService();

import { apiService } from './api.service';
import type { Transaction } from '@/types/models';

export interface BudgetStats {
  totalDebts: number;
  totalCredits: number;
  balance: number;
  pendingTransactions: number;
}

class BudgetService {
  /**
   * Долги. `groupId` передаётся явно и попадает в query здесь же: сервер без
   * него отдаёт личный итог по ВСЕМ командам человека, и командный экран
   * бюджета показывал долги чужих команд рядом с выбранной.
   */
  getDebts(params?: { status?: string; groupId?: string }) {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.groupId) q.set('groupId', params.groupId);
    return apiService.get<Transaction[]>(`/budget/debts${q.toString() ? `?${q}` : ''}`);
  }

  getCredits(params?: { status?: string; groupId?: string }) {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.groupId) q.set('groupId', params.groupId);
    return apiService.get<Transaction[]>(`/budget/credits${q.toString() ? `?${q}` : ''}`);
  }

  markPaid(transactionId: number) {
    return apiService.post<void>('/budget/mark-paid', { transactionId });
  }

  confirmPayment(transactionId: number) {
    return apiService.post<void>('/budget/confirm-payment', { transactionId });
  }

  /** Отмена своего подтверждения. Окно — сутки, проверяет сервер. */
  undoConfirmation(transactionId: number) {
    return apiService.post<void>('/budget/undo-confirmation', { transactionId });
  }

  cancelMark(transactionId: number) {
    return apiService.post<void>('/budget/cancel-mark', { transactionId });
  }

  getStats(params?: { from?: string; to?: string; groupId?: string }) {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.groupId) q.set('groupId', params.groupId);
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

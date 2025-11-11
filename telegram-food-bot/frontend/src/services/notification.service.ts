import { apiService } from './api.service';

export interface RemindAdminRequest {
  groupId: number;
}

export interface RemindAdminResponse {
  success: boolean;
  data?: {
    sentCount: number;
    message: string;
  };
  error?: string;
  cooldownEndsAt?: string;
  minutesLeft?: number;
}

export interface CooldownStatusResponse {
  success: boolean;
  data?: {
    isActive: boolean;
    cooldownEndsAt: string | null;
    secondsLeft: number;
    minutesLeft: number;
    lastReminderBy: {
      id: number;
      name: string;
    } | null;
  };
  error?: string;
}

class NotificationService {
  /**
   * Отправить напоминание администраторам о создании голосования
   */
  async remindAdmin(groupId: number): Promise<RemindAdminResponse> {
    try {
      const response = await apiService.post<RemindAdminResponse>('/notifications/remind-admin', {
        groupId,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  }

  /**
   * Получить статус cooldown для группы
   */
  async getCooldownStatus(groupId: number): Promise<CooldownStatusResponse> {
    try {
      const response = await apiService.get<CooldownStatusResponse>(`/notifications/cooldown/${groupId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  }
}

export const notificationService = new NotificationService();

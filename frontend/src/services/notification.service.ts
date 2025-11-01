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
}

export const notificationService = new NotificationService();

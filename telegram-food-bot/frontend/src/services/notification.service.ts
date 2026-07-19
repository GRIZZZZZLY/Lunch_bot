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
  private isNestedResponse<T>(value: T | undefined): value is T & { success: boolean } {
    return typeof value === 'object' && value !== null && 'success' in value;
  }

  /**
   * Отправить напоминание администраторам о создании голосования
   */
  async remindAdmin(groupId: number): Promise<RemindAdminResponse> {
    try {
      const response = await apiService.post<NonNullable<RemindAdminResponse['data']>>('/notifications/remind-admin', {
        groupId,
      });
      const nestedResponse: unknown = response.data;
      return this.isNestedResponse(nestedResponse)
        ? (nestedResponse)
        : response;
    } catch (error: unknown) {
      if (this.isNestedResponse(error)) {
        return error;
      }
      throw error;
    }
  }

  /**
   * Получить статус cooldown для группы
   */
  async getCooldownStatus(groupId: number): Promise<CooldownStatusResponse> {
    try {
      const response = await apiService.get<NonNullable<CooldownStatusResponse['data']>>(`/notifications/cooldown/${groupId}`);
      const nestedResponse: unknown = response.data;
      return this.isNestedResponse(nestedResponse)
        ? (nestedResponse)
        : response;
    } catch (error: unknown) {
      if (this.isNestedResponse(error)) {
        return error;
      }
      throw error;
    }
  }
}

export const notificationService = new NotificationService();

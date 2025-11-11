import { apiService, ApiResponse } from './api.service';

export interface RecurringPoll {
  id: number;
  groupId: number;
  isEnabled: boolean;
  daysOfWeek: number[] | string; // [1,2,3,4,5] for Mon-Fri or JSON string from API
  timeOfDay: string; // "11:00"
  duration: number; // minutes
  selectedMenuItemIds: number[] | string | null; // null = all active, can be JSON string from API
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastRunStatus: string | null;
  lastRunMessage: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  group: {
    id: number;
    telegramId: string;
    title: string;
  };
  creator: {
    id: number;
    firstName: string;
    lastName: string | null;
    telegramId: string;
  };
}

export interface CreateRecurringPollData {
  groupId: number;
  daysOfWeek: number[];
  timeOfDay: string;
  duration: number;
  selectedMenuItemIds?: number[] | null;
}

export interface UpdateRecurringPollData {
  daysOfWeek?: number[];
  timeOfDay?: string;
  duration?: number;
  selectedMenuItemIds?: number[] | null;
  isEnabled?: boolean;
}

export interface ExecutionHistoryItem {
  date: string;
  status: string;
  pollId?: number;
  voteCount?: number;
}

class RecurringPollService {
  /**
   * Получение расписания группы
   */
  async getGroupSchedule(groupId: number): Promise<ApiResponse<RecurringPoll | null>> {
    try {
      return await apiService.get<RecurringPoll | null>(`/recurring/${groupId}`);
    } catch (error: any) {
      console.error('[RecurringPollService] Error getting schedule:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to get schedule',
      };
    }
  }

  /**
   * Создание нового расписания
   */
  async createSchedule(data: CreateRecurringPollData): Promise<ApiResponse<RecurringPoll>> {
    try {
      return await apiService.post<RecurringPoll>('/recurring', data);
    } catch (error: any) {
      console.error('[RecurringPollService] Error creating schedule:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to create schedule',
      };
    }
  }

  /**
   * Обновление расписания
   */
  async updateSchedule(
    scheduleId: number,
    groupId: number,
    data: UpdateRecurringPollData
  ): Promise<ApiResponse<RecurringPoll>> {
    try {
      return await apiService.patch<RecurringPoll>(`/recurring/${scheduleId}`, { ...data, groupId });
    } catch (error: any) {
      console.error('[RecurringPollService] Error updating schedule:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to update schedule',
      };
    }
  }

  /**
   * Удаление расписания
   */
  async deleteSchedule(scheduleId: number, groupId: number): Promise<ApiResponse> {
    try {
      return await apiService.delete(`/recurring/${scheduleId}?groupId=${groupId}`);
    } catch (error: any) {
      console.error('[RecurringPollService] Error deleting schedule:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to delete schedule',
      };
    }
  }

  /**
   * Включение/выключение расписания
   */
  async toggleSchedule(
    scheduleId: number,
    groupId: number,
    isEnabled: boolean
  ): Promise<ApiResponse<RecurringPoll>> {
    try {
      return await apiService.patch<RecurringPoll>(`/recurring/${scheduleId}/toggle`, { isEnabled, groupId });
    } catch (error: any) {
      console.error('[RecurringPollService] Error toggling schedule:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to toggle schedule',
      };
    }
  }

  /**
   * Получение истории запусков
   */
  async getExecutionHistory(groupId: number, limit: number = 7): Promise<ApiResponse<ExecutionHistoryItem[]>> {
    try {
      return await apiService.get<ExecutionHistoryItem[]>(`/recurring/${groupId}/history?limit=${limit}`);
    } catch (error: any) {
      console.error('[RecurringPollService] Error getting history:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to get history',
      };
    }
  }

  /**
   * Форматирование расписания для отображения
   */
  formatSchedule(schedule: RecurringPoll): string {
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    
    // Парсим daysOfWeek если это строка (из API)
    const daysOfWeek = typeof schedule.daysOfWeek === 'string'
      ? JSON.parse(schedule.daysOfWeek)
      : schedule.daysOfWeek;
    
    let daysStr: string;
    if (daysOfWeek.length === 7) {
      daysStr = 'Каждый день';
    } else if (JSON.stringify(daysOfWeek) === JSON.stringify([1, 2, 3, 4, 5])) {
      daysStr = 'Пн-Пт';
    } else if (JSON.stringify(daysOfWeek) === JSON.stringify([6, 0])) {
      daysStr = 'Выходные';
    } else {
      daysStr = daysOfWeek.map((d: number) => dayNames[d]).join(', ');
    }

    return `${daysStr} в ${schedule.timeOfDay} (${schedule.duration} мин)`;
  }

  /**
   * Получение информации о следующем запуске
   */
  getNextRunInfo(schedule: RecurringPoll): string {
    if (!schedule.nextRunAt) {
      return 'Не запланировано';
    }

    const now = new Date();
    const nextRun = new Date(schedule.nextRunAt);
    const diffMs = nextRun.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) {
      return 'Просрочено';
    } else if (diffHours < 1) {
      return `Через ${diffMinutes} мин`;
    } else if (diffHours < 24) {
      return `Через ${diffHours} ч`;
    } else if (diffDays === 1) {
      return `Завтра в ${schedule.timeOfDay}`;
    } else {
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
      return nextRun.toLocaleDateString('ru-RU', options);
    }
  }
}

export const recurringPollService = new RecurringPollService();

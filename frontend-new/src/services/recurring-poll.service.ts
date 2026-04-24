import { apiService } from './api.service';

export interface RecurringPoll {
  id: number;
  groupId: number;
  isEnabled: boolean;
  daysOfWeek: number[] | string;
  timeOfDay: string;
  duration: number;
  selectedMenuItemIds: number[] | string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastRunStatus: string | null;
  lastRunMessage: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringPollInput {
  groupId: number;
  daysOfWeek: number[];
  timeOfDay: string;
  duration: number;
  selectedMenuItemIds?: number[] | null;
}

export interface UpdateRecurringPollInput {
  groupId: number;
  daysOfWeek?: number[];
  timeOfDay?: string;
  duration?: number;
  selectedMenuItemIds?: number[] | null;
  isEnabled?: boolean;
}

class RecurringPollService {
  getByGroup(groupId: number) {
    return apiService.get<RecurringPoll | null>(`/recurring/${groupId}`);
  }

  create(input: CreateRecurringPollInput) {
    return apiService.post<RecurringPoll>('/recurring', input);
  }

  update(id: number, input: UpdateRecurringPollInput) {
    return apiService.patch<RecurringPoll>(`/recurring/${id}`, input);
  }

  remove(id: number) {
    return apiService.delete<void>(`/recurring/${id}`);
  }

  toggle(id: number, groupId: number) {
    return apiService.patch<RecurringPoll>(`/recurring/${id}/toggle`, { groupId });
  }
}

export const recurringPollService = new RecurringPollService();

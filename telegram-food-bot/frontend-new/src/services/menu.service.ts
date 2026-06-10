import { apiService } from './api.service';
import type { MenuItem } from '@/types/models';

export interface UpsertMenuItemInput {
  name: string;
  price: number;
  category?: string;
  emoji?: string;
  description?: string;
  deliveryMinutes?: number;
  isActive?: boolean;
}

// Явный groupId перекрывает currentGroupId, который interceptor подставляет
// в query — нужно для редактирования меню не-текущей группы.
const groupParams = (groupId?: string) => (groupId ? { params: { groupId } } : undefined);

class MenuService {
  getAll(groupId?: string) {
    return apiService.get<MenuItem[]>('/menu', groupParams(groupId));
  }

  getActive(groupId?: string) {
    return apiService.get<MenuItem[]>('/menu/active', groupParams(groupId));
  }

  getById(id: number) {
    return apiService.get<MenuItem>(`/menu/${id}`);
  }

  create(data: UpsertMenuItemInput, groupId?: string) {
    return apiService.post<MenuItem>('/menu', data, groupParams(groupId));
  }

  update(id: number, data: Partial<UpsertMenuItemInput>, groupId?: string) {
    return apiService.put<MenuItem>(`/menu/${id}`, data, groupParams(groupId));
  }

  remove(id: number, groupId?: string) {
    return apiService.delete<void>(`/menu/${id}`, groupParams(groupId));
  }

  toggle(id: number) {
    return apiService.patch<MenuItem>(`/menu/${id}/toggle`);
  }

  search(query: string) {
    return apiService.get<MenuItem[]>(`/menu/search?q=${encodeURIComponent(query)}`);
  }
}

export const menuService = new MenuService();

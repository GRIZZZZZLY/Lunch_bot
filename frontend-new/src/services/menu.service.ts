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

class MenuService {
  getAll() {
    return apiService.get<MenuItem[]>('/menu');
  }

  getActive() {
    return apiService.get<MenuItem[]>('/menu/active');
  }

  getById(id: number) {
    return apiService.get<MenuItem>(`/menu/${id}`);
  }

  create(data: UpsertMenuItemInput) {
    return apiService.post<MenuItem>('/menu', data);
  }

  update(id: number, data: Partial<UpsertMenuItemInput>) {
    return apiService.put<MenuItem>(`/menu/${id}`, data);
  }

  remove(id: number) {
    return apiService.delete<void>(`/menu/${id}`);
  }

  toggle(id: number) {
    return apiService.patch<MenuItem>(`/menu/${id}/toggle`);
  }

  search(query: string) {
    return apiService.get<MenuItem[]>(`/menu/search?q=${encodeURIComponent(query)}`);
  }
}

export const menuService = new MenuService();
